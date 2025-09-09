window.MRP = window.MRP || {};

class RandomForestClassifier {
  constructor(trees = 100) { this.trees = trees; }
  predict(f) {
    const base = (f.hypertension_flag + f.ckd_flag + f.hf_flag + f.diabetes_flag) / 8 + (1 - f.adherence_mean) * 0.3;
    const probs = MRP.normalizeProbs({ low: 1 - base, moderate: base * 0.4, high: base * 0.35, critical: base * 0.25 });
    return { probabilities: probs, confidence: 0.75 };
  }
}

class GradientBoostingClassifier {
  predict(f) {
    const signal = (f.hba1c - 5.5) * 0.03 + (f.systolic_bp - 120) * 0.002 + (f.bnp > 400 ? 0.2 : 0) + (f.egfr < 60 ? 0.1 : 0);
    const s = MRP.clamp(signal, 0, 1);
    const probs = MRP.normalizeProbs({ low: 1 - s, moderate: s * 0.45, high: s * 0.35, critical: s * 0.2 });
    return { probabilities: probs, confidence: 0.7 };
  }
}

class LogisticRegressionClassifier {
  predict(f) {
    const z = -2 + 0.02 * (f.age - 50) + 0.01 * (f.systolic_bp - 120) + 0.3 * (f.hba1c - 5.5) + 0.02 * (f.bmi - 25) + 0.003 * (f.triglycerides - 150);
    const sigmoid = 1 / (1 + Math.exp(-z));
    const probs = MRP.normalizeProbs({ low: 1 - sigmoid, moderate: sigmoid * 0.5, high: sigmoid * 0.35, critical: sigmoid * 0.15 });
    return { probabilities: probs, confidence: 0.65 };
  }
}

class SimpleNeuralNetwork {
  constructor(layers) { this.layers = layers; }
  predict(f) {
    const mix = 0.3 * (f.hf_flag) + 0.25 * (f.ckd_flag) + 0.2 * (f.diabetes_flag) + 0.1 * (f.hypertension_flag) + 0.15 * (1 - f.adherence_mean);
    const m = MRP.clamp(mix, 0, 1);
    const probs = MRP.normalizeProbs({ low: 1 - m, moderate: m * 0.4, high: m * 0.35, critical: m * 0.25 });
    return { probabilities: probs, confidence: 0.6 };
  }
}

class MedicalEnsemblePredictor {
  constructor() {
    this.models = {
      ruleBasedModel: new MRP.MedicalRulesClassifier(),
      randomForest: new RandomForestClassifier(100),
      gradientBoost: new GradientBoostingClassifier(),
      logisticRegression: new LogisticRegressionClassifier(),
      neuralNetwork: new SimpleNeuralNetwork([64, 32, 4])
    };
    this.weights = { ruleBasedModel: 0.3, randomForest: 0.25, gradientBoost: 0.25, logisticRegression: 0.1, neuralNetwork: 0.1 };
  }

  weightedEnsemble(predictions, confidences) {
    const agg = { low: 0, moderate: 0, high: 0, critical: 0 };
    Object.keys(predictions).forEach(name => {
      const w = (this.weights[name] || 0) * (confidences[name] || 1);
      const p = predictions[name];
      Object.keys(agg).forEach(k => { agg[k] += (p[k] || 0) * w; });
    });
    return MRP.normalizeProbs(agg);
  }

  calculateEnsembleConfidence(confidences) {
    const values = Object.values(confidences);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  getRiskLevel(probs) {
    let best = 'low'; let max = -1;
    Object.entries(probs).forEach(([k, v]) => { if (v > max) { max = v; best = k; } });
    return best;
  }

  predict(patientFeatures) {
    const predictions = {}; const confidences = {};
    Object.keys(this.models).forEach(modelName => {
      const result = this.models[modelName].predict(patientFeatures);
      predictions[modelName] = result.probabilities; confidences[modelName] = result.confidence;
    });
    const ensembleProbabilities = this.weightedEnsemble(predictions, confidences);
    return {
      risk_probabilities: ensembleProbabilities,
      risk_level: this.getRiskLevel(ensembleProbabilities),
      model_contributions: predictions,
      ensemble_confidence: this.calculateEnsembleConfidence(confidences),
      clinical_rules: this.models.ruleBasedModel.getTriggeredRules(patientFeatures)
    };
  }
}

window.MRP.MedicalEnsemblePredictor = MedicalEnsemblePredictor;

