import argparse
import warnings
from typing import List, Tuple

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.feature_selection import mutual_info_regression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, RobustScaler


def bucketize_age(age_series: pd.Series) -> pd.Series:
    bins = [0, 30, 40, 50, 60, 70, 80, 200]
    labels = ["<30", "30-39", "40-49", "50-59", "60-69", "70-79", "80+"]
    return pd.cut(age_series.fillna(-1).clip(lower=0, upper=200), bins=bins, labels=labels, right=False)


def add_missing_flags(df: pd.DataFrame, cols: List[str]) -> pd.DataFrame:
    for col in cols:
        if col in df.columns:
            df[f"{col}_missing"] = df[col].isna().astype(int)
    return df


def median_impute_by_groups(df: pd.DataFrame, cols: List[str], group_cols: List[str]) -> pd.DataFrame:
    # Compute grouped medians for provided columns; fallback to global median
    grouped = df[group_cols + cols].groupby(group_cols).median(numeric_only=True)
    for col in cols:
        if col not in df.columns:
            continue
        def fill_func(row):
            if pd.notna(row[col]):
                return row[col]
            try:
                med = grouped.loc[tuple(row[g] for g in group_cols)][col]
                if pd.notna(med):
                    return med
            except Exception:
                pass
            return df[col].median(skipna=True)

        df[col] = df.apply(fill_func, axis=1)
    return df


def compute_adherence_pdc(df: pd.DataFrame, adherence_cols: List[str]) -> pd.DataFrame:
    present_cols = [c for c in adherence_cols if c in df.columns]
    if present_cols:
        df["pdc_mean_adherence"] = df[present_cols].mean(axis=1, skipna=True)
    return df


def compute_bp_control(df: pd.DataFrame) -> pd.DataFrame:
    if "systolic_bp" in df.columns:
        df["bp_control_indicator"] = (df["systolic_bp"] < 140).astype(int)
    return df


def validate_ranges(df: pd.DataFrame) -> pd.DataFrame:
    # Implausible vitals flags
    if "heart_rate" in df.columns:
        df["hr_implausible"] = ((df["heart_rate"] < 30) | (df["heart_rate"] > 220)).astype(int)
    if "systolic_bp" in df.columns:
        df["sbp_implausible"] = ((df["systolic_bp"] < 60) | (df["systolic_bp"] > 300)).astype(int)
    if "diastolic_bp" in df.columns:
        df["dbp_implausible"] = ((df["diastolic_bp"] < 30) | (df["diastolic_bp"] > 200)).astype(int)

    # BMI consistency check against height/weight
    if all(c in df.columns for c in ["height_cm", "weight_kg", "bmi"]):
        height_m = df["height_cm"] / 100.0
        with np.errstate(divide="ignore", invalid="ignore"):
            bmi_calc = df["weight_kg"] / (height_m ** 2)
        df["bmi_inconsistent"] = (np.abs(bmi_calc - df["bmi"]) > 6).astype(int)

    # Simple outlier flag via robust z-score
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    for col in numeric_cols:
        s = df[col]
        med = s.median(skipna=True)
        iqr = s.quantile(0.75) - s.quantile(0.25)
        if iqr == 0 or not np.isfinite(iqr):
            df[f"{col}_outlier"] = 0
            continue
        z = (s - med) / (iqr if iqr != 0 else 1)
        df[f"{col}_outlier"] = (z.abs() > 4).astype(int)
    return df


def robust_scale_columns(df: pd.DataFrame, cols: List[str]) -> Tuple[pd.DataFrame, List[str]]:
    present = [c for c in cols if c in df.columns]
    if not present:
        return df, []
    scaler = RobustScaler()
    scaled = scaler.fit_transform(df[present])
    scaled_cols = [f"{c}_robust" for c in present]
    df[scaled_cols] = scaled
    return df, scaled_cols


def target_encode(df: pd.DataFrame, cat_cols: List[str], target_col: str) -> pd.DataFrame:
    for col in cat_cols:
        if col not in df.columns:
            continue
        if target_col not in df.columns:
            continue
        means = df.groupby(col)[target_col].mean()
        df[f"{col}_te"] = df[col].map(means)
    return df


def drop_highly_correlated(df: pd.DataFrame, threshold: float = 0.95) -> pd.DataFrame:
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    corr = df[numeric_cols].corr().abs()
    upper = corr.where(np.triu(np.ones(corr.shape), k=1).astype(bool))
    to_drop = [column for column in upper.columns if any(upper[column] > threshold)]
    return df.drop(columns=to_drop)


def mutual_info_select(df: pd.DataFrame, target_col: str, keep_top_k: int = 50, mandatory: List[str] | None = None) -> List[str]:
    if target_col not in df.columns:
        return [c for c in df.columns]

    mandatory = mandatory or []
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    feature_cols = [c for c in numeric_cols if c != target_col]
    if not feature_cols:
        return [c for c in df.columns]

    X = df[feature_cols].fillna(df[feature_cols].median())
    y = df[target_col]
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        mi = mutual_info_regression(X, y, random_state=42)
    mi_series = pd.Series(mi, index=feature_cols).sort_values(ascending=False)
    selected = mi_series.head(keep_top_k).index.tolist()
    # Ensure mandatory are included if present
    selected = list(dict.fromkeys([*(c for c in selected), *(c for c in mandatory if c in df.columns)]))
    return selected


def main():
    parser = argparse.ArgumentParser(description="Process medical CSV with feature engineering and validation")
    parser.add_argument("--input", default="public/medical_dataset_realistic.csv", help="Path to input CSV")
    parser.add_argument("--output", default="public/processed_medical_dataset.csv", help="Path to write processed CSV")
    parser.add_argument("--top_k", type=int, default=50, help="Top K features by mutual information to keep")
    args = parser.parse_args()

    df = pd.read_csv(args.input)

    # Basic group columns for imputation
    df["age_bucket"] = bucketize_age(df.get("age", pd.Series(dtype=float)))
    group_cols = [c for c in ["sex", "age_bucket", "has_diabetes"] if c in df.columns]

    lab_cols = [
        "hba1c",
        "fasting_glucose",
        "egfr",
        "creatinine",
        "bnp",
        "total_cholesterol",
        "ldl_cholesterol",
        "hdl_cholesterol",
        "triglycerides",
    ]

    vital_cols = ["systolic_bp", "diastolic_bp", "heart_rate"]

    # Missing flags then median impute by groups
    df = add_missing_flags(df, lab_cols + vital_cols)
    if group_cols:
        df = median_impute_by_groups(df, lab_cols, group_cols)
    else:
        imputer = SimpleImputer(strategy="median")
        present_labs = [c for c in lab_cols if c in df.columns]
        if present_labs:
            df[present_labs] = imputer.fit_transform(df[present_labs])

    # Feature engineering
    adherence_cols = [
        "ace_inhibitor_adherence",
        "beta_blocker_adherence",
        "statin_adherence",
        "diabetes_med_adherence",
    ]
    df = compute_adherence_pdc(df, adherence_cols)
    df = compute_bp_control(df)

    # Data validation and outlier flags
    df = validate_ranges(df)

    # Scaling and encoding
    df, scaled_cols = robust_scale_columns(df, [*lab_cols])

    # Choose target for encoding; prefer risk_score if present
    target_col = "risk_score" if "risk_score" in df.columns else None
    categorical_for_te = [c for c in ["diabetes_type", "race", "smoking_status"] if c in df.columns]
    if target_col:
        df = target_encode(df, categorical_for_te, target_col)

    # Drop non-actionable identifiers
    drop_cols = [c for c in ["hospital_id"] if c in df.columns]
    df = df.drop(columns=drop_cols)

    # Drop highly correlated numeric features
    df = drop_highly_correlated(df, threshold=0.98)

    # Mutual information selection
    if target_col:
        mandatory = [c for c in ["age", "pdc_mean_adherence", "bp_control_indicator"] if c in df.columns]
        selected_numeric = mutual_info_select(df, target_col, keep_top_k=args.top_k, mandatory=mandatory)
        # Keep also the non-numeric columns commonly useful
        keep_always = [
            c for c in [
                "patient_id",
                "sex",
                "race",
                "smoking_status",
                "diabetes_type",
                target_col,
            ] if c in df.columns
        ]
        keep_set = set(selected_numeric + keep_always)
        df = df[[c for c in df.columns if c in keep_set or df[c].dtype == "O"]]

    df.to_csv(args.output, index=False)
    print(f"Wrote processed dataset to: {args.output}")


if __name__ == "__main__":
    main()


