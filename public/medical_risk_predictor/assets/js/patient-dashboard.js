window.MRP = window.MRP || {};

class PatientDashboard {
  constructor(patient, prediction) {
    this.patient = patient;
    this.prediction = prediction;
  }

  renderPatientInfo() {
    const p = this.patient;
    return `<div class="card patient-info">
      <h3>${p.patient_id}</h3>
      <div>Age: ${p.age} • Sex: ${p.sex} • Race: ${p.race}</div>
      <div>BP: ${p.systolic_bp}/${p.diastolic_bp} • HR: ${p.heart_rate}</div>
      <div>EF: ${p.ejection_fraction}% • BNP: ${p.bnp} pg/mL</div>
      <div>HbA1c: ${p.hba1c}% • FPG: ${p.fasting_glucose} mg/dL</div>
      <div>eGFR: ${p.egfr} • BMI: ${p.bmi}</div>
    </div>`;
  }

  renderRiskAssessment() {
    const r = this.prediction;
    const probs = r.risk_probabilities;
    return `<div class="card risk-assessment">
      <h3>Risk Assessment</h3>
      <div><span class="risk-indicator risk-${r.risk_level}">${r.risk_level.toUpperCase()}</span></div>
      <div style="margin-top:0.5rem">
        <div>Critical: ${(probs.critical*100).toFixed(1)}%</div>
        <div>High: ${(probs.high*100).toFixed(1)}%</div>
        <div>Moderate: ${(probs.moderate*100).toFixed(1)}%</div>
        <div>Low: ${(probs.low*100).toFixed(1)}%</div>
      </div>
      <div style="margin-top:0.5rem">Ensemble Confidence: ${(r.ensemble_confidence*100).toFixed(1)}%</div>
    </div>`;
  }

  renderClinicalRules() {
    const rules = this.prediction.clinical_rules;
    return `<div class="clinical-rules card">
      <h3>Triggered Clinical Rules</h3>
      ${rules.map(rule => `
        <div class="rule-item ${rule.severity}">
          <div class="rule-condition">${rule.condition}</div>
          <div class="rule-values">Current: <strong>${rule.currentValue}</strong> | Threshold: <strong>${rule.threshold}</strong></div>
          <div class="rule-impact">Risk Impact: +${Math.round((rule.riskContribution||0)*100)}%</div>
          <div class="rule-guideline">${rule.guidelineReference}</div>
        </div>
      `).join('')}
    </div>`;
  }

  renderVitalTrends() { return `<div class="card">Vital Trends (stub)</div>`; }
  renderRiskFactors() { return `<div class="card">Risk Factors (stub)</div>`; }
  renderRecommendations() { return `<div class="card">Recommendations (stub)</div>`; }

  renderModelExplanation() {
    const items = Object.entries(this.prediction.model_contributions).map(([model, pred]) => `
      <div class="model-contribution">
        <span class="model-name">${model}</span>
        <div class="probability-bar">
          <div class="prob-segment critical" style="width:${(pred.critical*100).toFixed(1)}%"></div>
          <div class="prob-segment high" style="width:${(pred.high*100).toFixed(1)}%"></div>
          <div class="prob-segment moderate" style="width:${(pred.moderate*100).toFixed(1)}%"></div>
          <div class="prob-segment low" style="width:${(pred.low*100).toFixed(1)}%"></div>
        </div>
      </div>`).join('');
    return `<div class="card model-explanation">
      <h3>AI Model Explanation</h3>
      <div class="ensemble-breakdown">${items}</div>
      <div class="confidence-score">Ensemble Confidence: <strong>${(this.prediction.ensemble_confidence*100).toFixed(1)}%</strong></div>
    </div>`;
  }

  render() {
    if (!this.patient) return '<div>Loading patient data...</div>';
    return `
      <div class="patient-dashboard">
        <header class="patient-header">${this.renderPatientInfo()}${this.renderRiskAssessment()}</header>
        <div class="dashboard-grid">
          <div class="clinical-rules-panel">${this.renderClinicalRules()}</div>
          <div class="vital-trends-panel">${this.renderVitalTrends()}</div>
          <div class="risk-factors-panel">${this.renderRiskFactors()}</div>
          <div class="recommendations-panel">${this.renderRecommendations()}</div>
        </div>
        ${this.renderModelExplanation()}
      </div>
    `;
  }
}

window.MRP.PatientDashboard = PatientDashboard;

