window.MRP = window.MRP || {};

const FDA_MEDICAL_THRESHOLDS = {
  blood_pressure: {
    normal: { systolic: [0, 120], diastolic: [0, 80] },
    elevated: { systolic: [120, 129], diastolic: [0, 80] },
    stage1_htn: { systolic: [130, 139], diastolic: [80, 89] },
    stage2_htn: { systolic: [140, 999], diastolic: [90, 999] }
  },
  diabetes: {
    normal_hba1c: [0, 5.7],
    prediabetes_hba1c: [5.7, 6.5],
    diabetes_hba1c: [6.5, 15],
    target_hba1c: 7.0,
    high_risk_hba1c: 9.0
  },
  heart_failure: {
    reduced_ef: [0, 40],
    mid_range_ef: [41, 49],
    preserved_ef: [50, 100],
    elevated_bnp: 400,
    critical_bnp: 1000
  },
  kidney: {
    normal_egfr: [90, 999],
    mild_decrease: [60, 89],
    moderate_decrease: [30, 59],
    severe_decrease: [15, 29],
    kidney_failure: [0, 14]
  },
  obesity: {
    underweight: [0, 18.5],
    normal: [18.5, 25],
    overweight: [25, 30],
    obese_class1: [30, 35],
    obese_class2: [35, 40],
    obese_class3: [40, 999]
  }
};

class MedicalRulesClassifier {
  predict(features) {
    const rules = this.getTriggeredRules(features);
    let score = 0;
    rules.forEach(r => { score += r.riskContribution || 0; });
    score = MRP.clamp(score, 0, 1);
    const probs = MRP.normalizeProbs({
      low: 1 - score,
      moderate: score * 0.4,
      high: score * 0.35,
      critical: score * 0.25
    });
    return { probabilities: probs, confidence: 0.9 };
  }

  getTriggeredRules(f) {
    const rules = [];
    // BP
    const bp = f.systolic_bp;
    if (bp >= 140 || f.diastolic_bp >= 90) rules.push(this._rule('Stage 2 Hypertension', `${bp}/${f.diastolic_bp} mmHg`, '>=140/90', 0.25, 'AHA/ACC 2017'));
    else if (bp >= 130 || f.diastolic_bp >= 80) rules.push(this._rule('Stage 1 Hypertension', `${bp}/${f.diastolic_bp} mmHg`, '>=130/80', 0.15, 'AHA/ACC 2017'));
    // Diabetes
    if (f.hba1c >= FDA_MEDICAL_THRESHOLDS.diabetes.high_risk_hba1c) rules.push(this._rule('Very High HbA1c', f.hba1c, '>=9.0%', 0.25, 'ADA 2025'));
    else if (f.hba1c >= 7.0) rules.push(this._rule('Above HbA1c Target', f.hba1c, '>=7.0%', 0.12, 'ADA 2025'));
    // Heart failure
    if (f.ejection_fraction <= 40) rules.push(this._rule('HFrEF', f.ejection_fraction + '%', '<=40%', 0.2, 'AHA/ACC 2022'));
    if (f.bnp >= FDA_MEDICAL_THRESHOLDS.heart_failure.critical_bnp) rules.push(this._rule('Critical BNP', f.bnp + ' pg/mL', '>=1000', 0.25, 'AHA/ACC 2022'));
    else if (f.bnp >= FDA_MEDICAL_THRESHOLDS.heart_failure.elevated_bnp) rules.push(this._rule('Elevated BNP', f.bnp + ' pg/mL', '>=400', 0.12, 'AHA/ACC 2022'));
    // Kidney
    if (f.egfr < 30) rules.push(this._rule('Severe CKD', f.egfr + ' mL/min/1.73m²', '<30', 0.2, 'KDIGO 2024'));
    else if (f.egfr < 60) rules.push(this._rule('Moderate CKD', f.egfr + ' mL/min/1.73m²', '30-59', 0.1, 'KDIGO 2024'));
    // Obesity
    if (f.bmi >= 40) rules.push(this._rule('Obesity Class III', f.bmi, '>=40', 0.18, 'CDC'));
    else if (f.bmi >= 35) rules.push(this._rule('Obesity Class II', f.bmi, '35-39.9', 0.12, 'CDC'));
    else if (f.bmi >= 30) rules.push(this._rule('Obesity Class I', f.bmi, '30-34.9', 0.08, 'CDC'));
    // Adherence
    const lowAdh = ['ace_inhibitor_adherence','beta_blocker_adherence','statin_adherence','diabetes_med_adherence','diuretic_adherence']
      .map(k => f[k]).filter(v => v !== undefined && v < 0.5).length;
    if (lowAdh >= 2) rules.push(this._rule('Poor medication adherence', lowAdh + ' classes <50%', '>=2 classes', 0.08, 'Quality Measure'));
    // Events
    if ((f.hospitalizations_6mo || 0) >= 2) rules.push(this._rule('Recent hospitalizations', f.hospitalizations_6mo, '>=2', 0.1, 'Utilization Risk'));
    return rules;
  }

  _rule(condition, currentValue, threshold, contribution, guidelineReference) {
    return { condition, currentValue, threshold, riskContribution: contribution, guidelineReference, severity: contribution >= 0.2 ? 'critical' : contribution >= 0.12 ? 'high' : 'moderate' };
  }
}

window.MRP.FDA_MEDICAL_THRESHOLDS = FDA_MEDICAL_THRESHOLDS;
window.MRP.MedicalRulesClassifier = MedicalRulesClassifier;

