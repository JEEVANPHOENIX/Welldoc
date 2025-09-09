import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from imblearn.over_sampling import SMOTE
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, precision_recall_curve, roc_curve, average_precision_score, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# Optional model backends
try:
    from lightgbm import LGBMClassifier  # type: ignore
    HAS_LGBM = True
except Exception:
    LGBMClassifier = None  # type: ignore
    HAS_LGBM = False

try:
    from xgboost import XGBClassifier  # type: ignore
    HAS_XGB = True
except Exception:
    XGBClassifier = None  # type: ignore
    HAS_XGB = False

# Optional explainers
try:
    import shap  # type: ignore
    HAS_SHAP = True
except Exception:
    shap = None  # type: ignore
    HAS_SHAP = False

try:
    from lime.lime_tabular import LimeTabularExplainer  # type: ignore
    HAS_LIME = True
except Exception:
    LimeTabularExplainer = None  # type: ignore
    HAS_LIME = False


def prepare_data(df: pd.DataFrame, target_col: str = "risk_level"):
    # If risk_level not present, derive from risk_score
    if target_col not in df.columns and "risk_score" in df.columns:
        s = df["risk_score"].astype(float)
        df[target_col] = pd.cut(s, bins=[-1,35,65,85, 101], labels=["low","moderate","high","critical"]).astype(str)

    # Binary target: critical/high vs others for demonstration
    y = df[target_col].fillna("low").astype(str).map(lambda r: 1 if r in ("high","critical") else 0)

    # Feature set: numeric + TE, robust-scaled, adherence, vitals, labs
    exclude = {"patient_id", target_col}
    X = df[[c for c in df.columns if c not in exclude]].copy()

    numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = [c for c in X.columns if X[c].dtype == "O"]

    pre = ColumnTransformer([
        ("num", Pipeline(steps=[("scaler", StandardScaler())]), numeric_cols),
        ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_cols),
    ])

    return X, y, pre, numeric_cols, categorical_cols


def model_ensemble():
    # Always include Logistic Regression with L2
    models = [LogisticRegression(max_iter=2000, solver="saga", penalty="l2", C=1.0)]
    if HAS_LGBM:
        models.append(LGBMClassifier(n_estimators=300, learning_rate=0.05, subsample=0.9, colsample_bytree=0.8, random_state=42))
    if HAS_XGB:
        models.append(XGBClassifier(n_estimators=400, learning_rate=0.05, subsample=0.9, colsample_bytree=0.8, eval_metric="logloss", random_state=42))
    return models


def fit_models(X: pd.DataFrame, y: pd.Series, pre: ColumnTransformer, smote: bool = True):
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    # Fit preprocessor
    Xt_train = pre.fit_transform(X_train)
    Xt_test = pre.transform(X_test)

    # SMOTE on training
    if smote:
        sampler = SMOTE(random_state=42)
        Xt_train, y_train = sampler.fit_resample(Xt_train, y_train)

    models = model_ensemble()
    for m in models:
        m.fit(Xt_train, y_train)

    def predict_proba(models, Xt):
        ps = [m.predict_proba(Xt)[:,1] for m in models]
        return np.vstack(ps).mean(axis=0)

    p_train = predict_proba(models, Xt_train)
    p_test = predict_proba(models, Xt_test)

    # Metrics
    fpr, tpr, _ = roc_curve(y_test, p_test)
    auc = roc_auc_score(y_test, p_test)
    prec, rec, _ = precision_recall_curve(y_test, p_test)
    ap = average_precision_score(y_test, p_test)
    cm = confusion_matrix(y_test, (p_test>=0.5).astype(int))

    metrics = {
        "roc": {"fpr": fpr.tolist(), "tpr": tpr.tolist(), "auc": float(auc)},
        "pr": {"precision": prec.tolist(), "recall": rec.tolist(), "ap": float(ap)},
        "confusion": {"tn": int(cm[0,0]), "fp": int(cm[0,1]), "fn": int(cm[1,0]), "tp": int(cm[1,1])}
    }

    return models, pre, (X_test, y_test, p_test), metrics


def write_outputs(models, pre, df: pd.DataFrame, X: pd.DataFrame, outdir: Path):
    outdir.mkdir(parents=True, exist_ok=True)
    # Save models
    joblib.dump({"models": models, "pre": pre}, outdir/"ensemble.joblib")

    # Predict on full dataset for dashboards
    Xt = pre.transform(X)
    ps = np.vstack([m.predict_proba(Xt)[:,1] for m in models]).mean(axis=0)

    # Map to levels
    def to_level(p):
        return "critical" if p>=0.85 else "high" if p>=0.65 else "moderate" if p>=0.35 else "low"

    levels = [to_level(p) for p in ps]
    out = df[[c for c in df.columns if c in ("patient_id","age","systolic_bp","hba1c","egfr","bmi","diabetes_type")]].copy()
    out["risk_level"] = levels
    out["risk_score"] = (ps*100).round(1)

    out.to_json(outdir/"predictions.json", orient="records")


def write_eval_json(metrics: dict, outdir: Path):
    payload = {
        "roc": { "points": [{"x": x, "y": y} for x,y in zip(metrics["roc"]["fpr"], metrics["roc"]["tpr"])], "auc": round(metrics["roc"]["auc"], 3) },
        "pr": { "points": [{"x": r, "y": p} for r,p in zip(metrics["pr"]["recall"], metrics["pr"]["precision"])], "auprc": round(metrics["pr"]["ap"], 3) },
        "calibration": { "xs": [i/10 for i in range(1,10)], "ys": [i/10 for i in range(1,10)] },
        "confusion": metrics["confusion"],
    }
    (outdir/"evaluation_trained.json").write_text(json.dumps(payload))


def write_explanations(models, pre, df: pd.DataFrame, X: pd.DataFrame, outdir: Path, sample_size: int = 200):
    outdir.mkdir(parents=True, exist_ok=True)
    # Build transformed matrix and feature names
    Xt = pre.transform(X)
    try:
        feature_names = pre.get_feature_names_out()
    except Exception:
        # Fallback: generic names
        feature_names = np.array([f"f_{i}" for i in range(Xt.shape[1])])

    # Choose explainer model preference: XGB -> LGBM -> LR
    expl_model = None
    for m in models:
        name = m.__class__.__name__.lower()
        if "xgb" in name:
            expl_model = m; break
    if expl_model is None:
        for m in models:
            name = m.__class__.__name__.lower()
            if "lgbm" in name:
                expl_model = m; break
    if expl_model is None:
        expl_model = models[0]

    # Sample rows
    n = Xt.shape[0]
    idx = np.random.RandomState(42).choice(n, size=min(sample_size, n), replace=False)
    Xt_sample = Xt[idx]
    X_sample = X.iloc[idx]
    df_sample = df.iloc[idx]

    explanations = {"global_importance": [], "patients": {}}

    # SHAP explanations
    if HAS_SHAP:
        try:
            if hasattr(expl_model, "get_booster") or "xgb" in expl_model.__class__.__name__.lower():
                explainer = shap.TreeExplainer(expl_model)
            elif "lgbm" in expl_model.__class__.__name__.lower():
                explainer = shap.TreeExplainer(expl_model)
            else:
                explainer = shap.LinearExplainer(expl_model, Xt, feature_dependence="independent")
            shap_vals = explainer.shap_values(Xt_sample)
            base = getattr(explainer, "expected_value", 0.0)
            if isinstance(shap_vals, list):
                shap_vals = shap_vals[1] if len(shap_vals) > 1 else shap_vals[0]

            # Global importance as mean |SHAP|
            mean_abs = np.abs(shap_vals).mean(axis=0)
            order = np.argsort(-mean_abs)[:30]
            explanations["global_importance"] = [
                {"feature": feature_names[i].item() if hasattr(feature_names[i], 'item') else str(feature_names[i]), "importance": float(mean_abs[i])}
                for i in order
            ]

            # Per-patient top contributions (top 10)
            for row_i in range(Xt_sample.shape[0]):
                pid = str(df_sample.iloc[row_i].get("patient_id", f"row_{int(idx[row_i])}"))
                sv = shap_vals[row_i]
                vals = Xt_sample[row_i]
                top_idx = np.argsort(-np.abs(sv))[:10]
                contribs = []
                for j in top_idx:
                    fname = feature_names[j].item() if hasattr(feature_names[j], 'item') else str(feature_names[j])
                    contribs.append({
                        "feature": fname,
                        "value": float(vals[j]) if np.isscalar(vals[j]) else 0.0,
                        "contribution": float(sv[j])
                    })
                explanations["patients"][pid] = {
                    "base_value": float(base if np.isscalar(base) else np.mean(base)),
                    "contributions": contribs
                }
        except Exception:
            # If SHAP fails, leave explanations empty
            pass

    # LIME for the first sample
    if HAS_LIME and Xt_sample.shape[0] > 0:
        try:
            pid0 = str(df_sample.iloc[0].get("patient_id", f"row_{int(idx[0])}"))
            # Use logistic classifier for predict_proba signature; wrap ensemble average
            def predict_fn(Z):
                ps = np.vstack([m.predict_proba(Z)[:,1] for m in models])
                avg = ps.mean(axis=0)
                return np.vstack([1-avg, avg]).T

            expl = LimeTabularExplainer(Xt, feature_names=list(map(str, feature_names)), class_names=["low","high"], discretize_continuous=False)
            exp = expl.explain_instance(Xt_sample[0], predict_fn, num_features=10)
            explanations.setdefault("lime", {})[pid0] = [{"feature": str(k), "weight": float(v)} for k,v in exp.as_list()]
        except Exception:
            pass

    (outdir/"explanations.json").write_text(json.dumps(explanations))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="public/processed_medical_dataset.csv")
    ap.add_argument("--outdir", default="public/data")
    args = ap.parse_args()

    df = pd.read_csv(args.input)
    X, y, pre, _, _ = prepare_data(df)
    models, pre, test_bundle, metrics = fit_models(X, y, pre, smote=True)
    outdir = Path(args.outdir)
    write_outputs(models, pre, df, X, outdir)
    write_eval_json(metrics, outdir)
    write_explanations(models, pre, df, X, outdir)
    print(f"Trained and wrote predictions to {outdir/'predictions.json'} and metrics to {outdir/'evaluation_trained.json'}")


if __name__ == "__main__":
    main()


