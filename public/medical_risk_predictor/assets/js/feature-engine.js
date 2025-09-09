window.MRP = window.MRP || {};

MRP.FeatureEngine = {
  computeBMI(weight_kg, height_cm) {
    const h = Number(height_cm) / 100;
    if (!h) return 0;
    return +(Number(weight_kg) / (h * h)).toFixed(1);
  },

  deriveFeatures(patient) {
    const p = { ...patient };
    p.bmi = p.bmi || this.computeBMI(p.weight_kg, p.height_cm);
    p.hypertension_flag = (p.systolic_bp >= 130 || p.diastolic_bp >= 80) ? 1 : 0;
    p.ckd_flag = p.egfr < 60 ? 1 : 0;
    p.hf_flag = (p.ejection_fraction <= 40 || p.bnp >= 400) ? 1 : 0;
    p.diabetes_flag = (p.hba1c >= 6.5 || p.fasting_glucose >= 126) ? 1 : 0;
    p.adherence_mean = ['ace_inhibitor_adherence','beta_blocker_adherence','statin_adherence','diabetes_med_adherence','diuretic_adherence']
      .map(k => Number(p[k] ?? 1)).reduce((a, b) => a + b, 0) / 5;
    return p;
  }
};

