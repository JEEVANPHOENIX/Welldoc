window.MRP = window.MRP || {};

class GlobalDashboard {
  constructor(patients = []) {
    this.patients = patients;
    this.filters = { riskLevel: 'all', condition: 'all', ageRange: [18, 90], sortBy: 'risk_score', sortOrder: 'desc' };
  }

  setPatients(p) { this.patients = p; }

  calculatePopulationStats() {
    const totals = { low: 0, moderate: 0, high: 0, critical: 0 };
    this.patients.forEach(p => { totals[p.risk_level] = (totals[p.risk_level] || 0) + 1; });
    const n = this.patients.length || 1;
    return {
      ...totals,
      lowPercent: Math.round((totals.low * 100) / n),
      moderatePercent: Math.round((totals.moderate * 100) / n),
      highPercent: Math.round((totals.high * 100) / n),
      criticalPercent: Math.round((totals.critical * 100) / n)
    };
  }

  renderSummaryCards() {
    const stats = this.calculatePopulationStats();
    return `
      <div class="summary-card critical">
        <h3>Critical Risk</h3>
        <span class="count">${stats.critical}</span>
        <span class="percentage">${stats.criticalPercent}%</span>
      </div>
      <div class="summary-card high">
        <h3>High Risk</h3>
        <span class="count">${stats.high}</span>
        <span class="percentage">${stats.highPercent}%</span>
      </div>
      <div class="summary-card moderate">
        <h3>Moderate Risk</h3>
        <span class="count">${stats.moderate}</span>
        <span class="percentage">${stats.moderatePercent}%</span>
      </div>
      <div class="summary-card low">
        <h3>Low Risk</h3>
        <span class="count">${stats.low}</span>
        <span class="percentage">${stats.lowPercent}%</span>
      </div>
    `;
  }

  renderFiltersAndSorting() {
    return `<div class="card grid four">
      <div>
        <label>Risk Level</label>
        <select id="filterRisk">
          <option value="all">All</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="moderate">Moderate</option>
          <option value="low">Low</option>
        </select>
      </div>
      <div>
        <label>Condition</label>
        <select id="filterCondition">
          <option value="all">All</option>
          <option value="hf">Heart Failure</option>
          <option value="diabetes">Diabetes</option>
          <option value="obesity">Obesity</option>
        </select>
      </div>
      <div>
        <label>Sort By</label>
        <select id="sortBy">
          <option value="risk_score">Risk Score</option>
          <option value="age">Age</option>
          <option value="hba1c">HbA1c</option>
        </select>
      </div>
      <div>
        <label>Order</label>
        <select id="sortOrder">
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
      </div>
    </div>`;
  }

  renderPatientGrid() {
    const rows = this.patients.slice(0, 60).map(p => {
      const riskScore = (p.risk_probabilities?.critical || 0) * 3 + (p.risk_probabilities?.high || 0) * 2 + (p.risk_probabilities?.moderate || 0);
      return `<div class="patient-card">
        <div class="id">${p.patient_id}</div>
        <div>Age: ${p.age} • ${p.sex}</div>
        <div>BP: ${p.systolic_bp}/${p.diastolic_bp} • HbA1c: ${p.hba1c}%</div>
        <div>BMI: ${p.bmi}</div>
        <div><span class="risk-indicator risk-${p.risk_level}">${p.risk_level.toUpperCase()}</span> <small>Score: ${riskScore.toFixed(2)}</small></div>
      </div>`;
    }).join('');
    return `<div class="patient-grid">${rows}</div>`;
  }

  renderPopulationAnalytics() {
    return `<div class="card"><strong>Population Analytics</strong><div id="analyticsContainer">Coming soon</div></div>`;
  }

  render() {
    return `
      <div class="global-dashboard">
        <header class="dashboard-header">
          <h2 style="color:#fff">Global Dashboard</h2>
          <div class="summary-cards">${this.renderSummaryCards()}</div>
        </header>
        <div class="controls-panel">${this.renderFiltersAndSorting()}</div>
        <div class="patient-grid-wrap">${this.renderPatientGrid()}</div>
        <div class="analytics-section">${this.renderPopulationAnalytics()}</div>
      </div>
    `;
  }
}

window.MRP.GlobalDashboard = GlobalDashboard;

