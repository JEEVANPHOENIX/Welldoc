window.MRP = window.MRP || {};

(function(){
  const races = ['caucasian','african_american','hispanic','asian','other'];
  const sexes = ['male','female'];
  const dmTypes = ['none','type1','type2','prediabetes'];
  function sanitize(p) {
    // Clamp values to humane/clinical ranges
    p.age = MRP.clamp(p.age, 18, 90);
    p.systolic_bp = MRP.clamp(p.systolic_bp, 80, 200);
    p.diastolic_bp = MRP.clamp(p.diastolic_bp, 50, 120);
    p.heart_rate = MRP.clamp(p.heart_rate, 40, 150);
    p.ejection_fraction = MRP.clamp(p.ejection_fraction, 15, 70);
    p.bnp = MRP.clamp(p.bnp, 0, 5000);
    p.nt_pro_bnp = MRP.clamp(p.nt_pro_bnp, 0, 35000);
    p.hba1c = +MRP.clamp(p.hba1c, 4.0, 15.0).toFixed(1);
    p.fasting_glucose = MRP.clamp(p.fasting_glucose, 70, 400);
    p.random_glucose = MRP.clamp(p.random_glucose, 70, 500);
    p.insulin_units_daily = MRP.clamp(p.insulin_units_daily, 0, 200);
    p.diabetes_duration_years = MRP.clamp(p.diabetes_duration_years, 0, 50);
    p.creatinine = +MRP.clamp(p.creatinine, 0.5, 8.0).toFixed(2);
    p.egfr = MRP.clamp(p.egfr, 5, 150);
    p.albumin_creatinine_ratio = MRP.clamp(p.albumin_creatinine_ratio, 0, 3000);
    p.total_cholesterol = MRP.clamp(p.total_cholesterol, 100, 400);
    p.ldl_cholesterol = MRP.clamp(p.ldl_cholesterol, 50, 300);
    p.hdl_cholesterol = MRP.clamp(p.hdl_cholesterol, 20, 100);
    p.triglycerides = MRP.clamp(p.triglycerides, 50, 1000);
    p.weight_kg = MRP.clamp(p.weight_kg, 40, 200);
    p.height_cm = MRP.clamp(p.height_cm, 140, 210);
    p.bmi = +MRP.clamp(MRP.FeatureEngine.computeBMI(p.weight_kg, p.height_cm), 14, 60).toFixed(1);
    p.waist_circumference = MRP.clamp(p.waist_circumference, 60, 150);
    p.alcohol_drinks_weekly = MRP.clamp(p.alcohol_drinks_weekly, 0, 50);
    p.exercise_minutes_weekly = MRP.clamp(p.exercise_minutes_weekly, 0, 1000);
    p.sleep_hours_nightly = MRP.clamp(p.sleep_hours_nightly, 3, 12);
    p.stress_level = MRP.clamp(p.stress_level, 1, 10);
    ['ace_inhibitor_adherence','beta_blocker_adherence','statin_adherence','diabetes_med_adherence','diuretic_adherence'].forEach(k=>{ p[k] = +MRP.clamp(p[k]||0, 0, 1).toFixed(2); });
    p.hospitalizations_6mo = MRP.clamp(p.hospitalizations_6mo||0, 0, 10);
    p.er_visits_6mo = MRP.clamp(p.er_visits_6mo||0, 0, 20);
    p.missed_appointments_6mo = MRP.clamp(p.missed_appointments_6mo||0, 0, 10);
    return p;
  }

  function genOne() {
    const age = MRP.randInt(18, 90);
    const sex = sexes[MRP.randInt(0, sexes.length - 1)];
    const race = races[MRP.randInt(0, races.length - 1)];
    const height_cm = MRP.randInt(150, 195);
    const weight_kg = +(MRP.rand(50, 140)).toFixed(1);
    const systolic_bp = MRP.randInt(90, 180);
    const diastolic_bp = MRP.randInt(60, 110);
    const heart_rate = MRP.randInt(50, 120);
    const ejection_fraction = MRP.randInt(25, 65);
    const bnp = MRP.randInt(20, 2000);
    const nt_pro_bnp = MRP.randInt(50, 8000);
    const hba1c = +(MRP.rand(4.5, 12.5)).toFixed(1);
    const fasting_glucose = MRP.randInt(70, 260);
    const random_glucose = MRP.randInt(80, 380);
    const diabetes_type = dmTypes[MRP.randInt(0, dmTypes.length - 1)];
    const insulin_units_daily = diabetes_type === 'none' ? 0 : MRP.randInt(0, 100);
    const diabetes_duration_years = diabetes_type === 'none' ? 0 : MRP.randInt(0, 30);
    const creatinine = +(MRP.rand(0.6, 3.2)).toFixed(2);
    const egfr = MRP.randInt(15, 120);
    const albumin_creatinine_ratio = MRP.randInt(10, 1200);
    const total_cholesterol = MRP.randInt(130, 320);
    const ldl_cholesterol = MRP.randInt(60, 220);
    const hdl_cholesterol = MRP.randInt(25, 80);
    const triglycerides = MRP.randInt(60, 500);
    const waist_circumference = MRP.randInt(70, 130);
    const smoking_status = ['never','former','current'][MRP.randInt(0,2)];
    const alcohol_drinks_weekly = MRP.randInt(0, 25);
    const exercise_minutes_weekly = MRP.randInt(0, 400);
    const sleep_hours_nightly = MRP.randInt(4, 10);
    const stress_level = MRP.randInt(1, 10);
    const ace_inhibitor_adherence = +(MRP.rand(0.2, 1)).toFixed(2);
    const beta_blocker_adherence = +(MRP.rand(0.2, 1)).toFixed(2);
    const statin_adherence = +(MRP.rand(0.2, 1)).toFixed(2);
    const diabetes_med_adherence = +(MRP.rand(0.2, 1)).toFixed(2);
    const diuretic_adherence = +(MRP.rand(0.2, 1)).toFixed(2);
    const hospitalizations_6mo = MRP.randInt(0, 3);
    const er_visits_6mo = MRP.randInt(0, 6);
    const missed_appointments_6mo = MRP.randInt(0, 5);

    const patient_id = MRP.uuid('P');
    const bmi = MRP.FeatureEngine.computeBMI(weight_kg, height_cm);
    return sanitize({
      patient_id, age, sex, race,
      systolic_bp, diastolic_bp, heart_rate, ejection_fraction, bnp, nt_pro_bnp,
      hba1c, fasting_glucose, random_glucose, diabetes_type, insulin_units_daily, diabetes_duration_years,
      creatinine, egfr, albumin_creatinine_ratio,
      total_cholesterol, ldl_cholesterol, hdl_cholesterol, triglycerides,
      weight_kg, height_cm, bmi, waist_circumference,
      smoking_status, alcohol_drinks_weekly, exercise_minutes_weekly, sleep_hours_nightly, stress_level,
      ace_inhibitor_adherence, beta_blocker_adherence, statin_adherence, diabetes_med_adherence, diuretic_adherence,
      hospitalizations_6mo, er_visits_6mo, missed_appointments_6mo
    });
  }

  function labelAndProbs(model, p) {
    const features = MRP.FeatureEngine.deriveFeatures(p);
    const prediction = model.predict(features);
    const probs = prediction.risk_probabilities;
    const risk_level = prediction.risk_level;
    return { ...p, risk_level, risk_probabilities: probs };
  }

  MRP.generatePatients = function(count = 1000) {
    const model = new MRP.MedicalEnsemblePredictor();
    const rows = [];
    for (let i = 0; i < count; i++) rows.push(labelAndProbs(model, genOne()));
    return rows;
  };

  MRP.exportPatientsCSV = function(rows) {
    const flat = rows.map(r => ({
      ...r,
      risk_prob_low: r.risk_probabilities.low.toFixed(4),
      risk_prob_moderate: r.risk_probabilities.moderate.toFixed(4),
      risk_prob_high: r.risk_probabilities.high.toFixed(4),
      risk_prob_critical: r.risk_probabilities.critical.toFixed(4)
    }));
    ['risk_probabilities'].forEach(k => flat.forEach(obj => delete obj[k]));
    MRP.csv.downloadCSV('patients.csv', flat);
  };

  // Convenience to regenerate a fresh, sanitized dataset and download
  MRP.regenerateAndExportCSV = function(count = 1000) {
    const rows = MRP.generatePatients(count);
    MRP.exportPatientsCSV(rows);
  };
})();

