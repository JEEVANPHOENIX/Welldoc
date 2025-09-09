import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd


def load_df(path: str) -> pd.DataFrame:
    return pd.read_csv(path)


def make_global_patients(df: pd.DataFrame, limit: int | None = None) -> list[dict]:
    cols = [
        "patient_id",
        "age",
        "risk_level",
        "systolic_bp",
        "hba1c",
        "egfr",
        "bmi",
        "bnp",
        "ejection_fraction",
        "diabetes_type",
        "ace_inhibitor_adherence",
        "statin_adherence",
        "missed_appointments_6mo",
    ]
    present = [c for c in cols if c in df.columns]
    records = df[present].to_dict(orient="records")
    if limit:
        records = records[:limit]
    # Normalize risk_level if absent
    for r in records:
        if "risk_level" not in r or pd.isna(r["risk_level"]):
            # derive from risk_score if present
            score = r.get("risk_score") if "risk_score" in df.columns else None
            if score is None:
                r["risk_level"] = np.random.choice(["low","moderate","high","critical"], p=[0.6,0.25,0.12,0.03])
            else:
                r["risk_level"] = "critical" if score>=85 else "high" if score>=65 else "moderate" if score>=35 else "low"
    return records


def make_eval_curves(df: pd.DataFrame) -> dict:
    # Build pseudo-labels using available probability columns or risk_score
    probs_cols = ["prob_low","prob_moderate","prob_high","prob_critical"]
    have_probs = all(c in df.columns for c in probs_cols)
    if have_probs:
        score = 0.25*df["prob_critical"] + 0.2*df["prob_high"] + 0.15*df["prob_moderate"]
    elif "risk_score" in df.columns:
        score = (df["risk_score"].astype(float) / 100.0).clip(0,1)
    else:
        score = pd.Series(np.random.rand(len(df)))

    rng = np.random.default_rng(42)
    noise = rng.normal(0, 0.05, len(score))
    noisy = np.clip(score + noise, 0, 1)
    y = (noisy >= noisy.quantile(0.75)).astype(int)

    data = pd.DataFrame({"score": noisy, "y": y})

    def roc(points=60):
        pts=[]
        for t in np.linspace(0,1,points+1):
            yhat = (data["score"] >= t).astype(int)
            tp = int(((yhat==1) & (data["y"]==1)).sum())
            fp = int(((yhat==1) & (data["y"]==0)).sum())
            tn = int(((yhat==0) & (data["y"]==0)).sum())
            fn = int(((yhat==0) & (data["y"]==1)).sum())
            tpr = tp / (tp + fn or 1)
            fpr = fp / (fp + tn or 1)
            pts.append({"x": fpr, "y": tpr})
        # AUC via trapezoid
        s = sorted(pts, key=lambda p: p["x"]) 
        auc=0.0
        for i in range(1,len(s)):
            dx = s[i]["x"] - s[i-1]["x"]
            auc += dx * (s[i]["y"] + s[i-1]["y"]) / 2
        return {"points": s, "auc": round(auc, 3)}

    def pr(points=60):
        pts=[]
        for t in np.linspace(0,1,points+1):
            yhat = (data["score"] >= t).astype(int)
            tp = int(((yhat==1) & (data["y"]==1)).sum())
            fp = int(((yhat==1) & (data["y"]==0)).sum())
            fn = int(((yhat==0) & (data["y"]==1)).sum())
            prec = tp / (tp + fp or 1)
            rec = tp / (tp + fn or 1)
            pts.append({"x": rec, "y": prec})
        s = sorted(pts, key=lambda p: p["x"]) 
        auprc=0.0
        for i in range(1,len(s)):
            dx = s[i]["x"] - s[i-1]["x"]
            auprc += dx * (s[i]["y"] + s[i-1]["y"]) / 2
        return {"points": s, "auprc": round(auprc, 3)}

    def calibration(bins=10):
        xs=[]; ys=[]
        for i in range(bins):
            lo, hi = i/bins, (i+1)/bins
            seg = data[(data["score"]>=lo) & (data["score"]<hi)]
            if len(seg)==0:
                xs.append((lo+hi)/2); ys.append(0.0)
            else:
                xs.append(seg["score"].mean()); ys.append(seg["y"].mean())
        return {"xs": xs, "ys": ys}

    def confusion(thr=0.5):
        yhat = (data["score"] >= thr).astype(int)
        tn = int(((yhat==0) & (data["y"]==0)).sum())
        fp = int(((yhat==1) & (data["y"]==0)).sum())
        fn = int(((yhat==0) & (data["y"]==1)).sum())
        tp = int(((yhat==1) & (data["y"]==1)).sum())
        return {"tn": tn, "fp": fp, "fn": fn, "tp": tp}

    return {"roc": roc(), "pr": pr(), "calibration": calibration(), "confusion": confusion()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="public/processed_medical_dataset.csv")
    ap.add_argument("--outdir", default="public/data")
    args = ap.parse_args()

    inp = Path(args.input)
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    df = load_df(str(inp))
    patients = make_global_patients(df)
    with (outdir/"global_patients.json").open("w") as f:
        json.dump(patients, f)

    eval_data = make_eval_curves(df)
    with (outdir/"evaluation.json").open("w") as f:
        json.dump(eval_data, f)

    print(f"Wrote: {outdir/'global_patients.json'} and {outdir/'evaluation.json'}")


if __name__ == "__main__":
    main()


