window.WD = window.WD || {};

// Simple Naive Bayes over selected features with Gaussian likelihoods
WD.NaiveBayesRisk = class {
  constructor() {
    this.classes = ['low','moderate','high','critical'];
    this.priors = { low: 0.5, moderate: 0.25, high: 0.18, critical: 0.07 };
    // Means/stds are illustrative; in production, learn from data
    this.params = {
      systolic_bp: { low:[118,10], moderate:[132,12], high:[146,14], critical:[165,18] },
      hba1c: { low:[5.6,0.4], moderate:[6.6,0.5], high:[7.8,0.7], critical:[9.5,1.0] },
      egfr: { low:[90,15], moderate:[65,12], high:[45,10], critical:[25,8] },
      bnp: { low:[80,60], moderate:[250,120], high:[600,250], critical:[1400,600] },
      bmi: { low:[24,3], moderate:[29,3], high:[33,4], critical:[39,5] }
    };
  }

  gaussian(x, mean, sd) {
    const z = (x - mean) / (sd || 1);
    return Math.exp(-0.5 * z * z) / ((sd || 1) * Math.sqrt(2 * Math.PI));
  }

  predict(features) {
    const logPost = {};
    this.classes.forEach(c => { logPost[c] = Math.log(this.priors[c] || 1e-6); });
    Object.keys(this.params).forEach(k => {
      const v = Number(features[k]);
      if (Number.isFinite(v)) {
        this.classes.forEach(c => {
          const [m, s] = this.params[k][c];
          const p = this.gaussian(v, m, s) || 1e-12;
          logPost[c] += Math.log(p);
        });
      }
    });
    // Normalize
    const maxLog = Math.max(...Object.values(logPost));
    const exp = {}; let sum = 0;
    this.classes.forEach(c => { exp[c] = Math.exp(logPost[c] - maxLog); sum += exp[c]; });
    const probs = {}; this.classes.forEach(c => probs[c] = exp[c] / (sum || 1));
    const risk_level = Object.entries(probs).sort((a,b)=>b[1]-a[1])[0][0];
    return { probabilities: probs, risk_level, confidence: 0.7 };
  }
};

// Actionable recommendation engine with constraints
WD.RecommendationEngine = class {
  constructor() {
    this.reducible = {
      systolic_bp: { min: 120, step: 2, unit: 'mmHg' },
      hba1c: { min: 7.0, step: 0.1, unit: '%' },
      triglycerides: { min: 150, step: 10, unit: 'mg/dL' },
      weight_kg: { min: null, step: 1, unit: 'kg' },
      alcohol_drinks_weekly: { min: 0, step: 1, unit: 'drinks/wk' },
      stress_level: { min: 1, step: 1, unit: '/10' }
    };
    this.nonReducible = ['age','sex','race'];
  }

  suggest(features) {
    const recs = [];
    // BP
    const bp = Number(features.systolic_bp);
    if (Number.isFinite(bp) && bp > 140) {
      const target = Math.max(130, this.reducible.systolic_bp.min);
      const delta = Math.max(0, Math.min(bp - target, 20));
      if (delta > 0) recs.push({
        factor: 'systolic_bp',
        text: `Reduce systolic BP by ${delta.toFixed(0)} ${this.reducible.systolic_bp.unit} to reach <= ${target} mmHg (Stage 1 range).`,
        impact: 'high'
      });
    }
    // HbA1c
    const a1c = Number(features.hba1c);
    if (Number.isFinite(a1c) && a1c > 7.0) {
      const target = 7.0;
      const delta = Math.max(0, Math.min(a1c - target, 2.0));
      if (delta > 0) recs.push({ factor: 'hba1c', text: `Lower HbA1c by ${delta.toFixed(1)}% towards target ${target}% via adherence and lifestyle.`, impact: 'high' });
    }
    // Triglycerides
    const tg = Number(features.triglycerides);
    if (Number.isFinite(tg) && tg > 200) {
      const target = 150; const delta = Math.min(tg - target, 80);
      recs.push({ factor: 'triglycerides', text: `Reduce triglycerides by ${delta} mg/dL via diet/omega-3, target ${target} mg/dL.`, impact: 'moderate' });
    }
    // Weight
    const bmi = Number(features.bmi);
    const weight = Number(features.weight_kg);
    if (Number.isFinite(bmi) && bmi >= 30 && Number.isFinite(weight)) {
      const targetBMI = 29.9;
      const heightM = Number(features.height_cm) / 100;
      if (heightM) {
        const targetWeight = targetBMI * heightM * heightM;
        const delta = Math.max(0, weight - targetWeight);
        if (delta >= 2) recs.push({ factor: 'weight_kg', text: `Aim to reduce weight by ~${delta.toFixed(1)} kg to move below BMI 30.`, impact: 'moderate' });
      }
    }
    // Alcohol
    const alc = Number(features.alcohol_drinks_weekly);
    if (Number.isFinite(alc) && alc > 7) recs.push({ factor: 'alcohol_drinks_weekly', text: `Cut alcohol by ${Math.min(alc - 7, 7)} drinks/week to stay within recommended limits.`, impact: 'low' });
    // Stress
    const stress = Number(features.stress_level);
    if (Number.isFinite(stress) && stress > 5) recs.push({ factor: 'stress_level', text: `Reduce stress score by ${Math.min(stress - 5, 2)} with sleep/exercise/CBT.`, impact: 'low' });

    return recs;
  }
};


