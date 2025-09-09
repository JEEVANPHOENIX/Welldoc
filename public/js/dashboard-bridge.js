/* global WD, MRP, Chart */
(function(){
  async function loadExplanations(){
    try { const r = await fetch('data/explanations.json', { cache:'no-cache' }); if (r.ok) return await r.json(); } catch(e){}
    return null;
  }
  // Minimal synthetic single-patient for the classic dashboard
  const model = new (window.MRP?.MedicalEnsemblePredictor || function(){ this.predict=()=>({risk_probabilities:{low:.6,moderate:.25,high:.1,critical:.05},risk_level:'low',ensemble_confidence:.7,clinical_rules:[]}) })();
  const bayes = new WD.NaiveBayesRisk();

  function genPatient() {
    const base = window.MRP?.generatePatients ? window.MRP.generatePatients(1)[0] : {
      patient_id: 'P-000001', age: 54, sex: 'male', race: 'caucasian',
      systolic_bp: 142, diastolic_bp: 88, heart_rate: 78, ejection_fraction: 45, bnp: 420, nt_pro_bnp: 800,
      hba1c: 7.8, fasting_glucose: 132, random_glucose: 180, diabetes_type: 'type2', insulin_units_daily: 22, diabetes_duration_years: 6,
      creatinine: 1.3, egfr: 58, albumin_creatinine_ratio: 120, total_cholesterol: 210, ldl_cholesterol: 128, hdl_cholesterol: 42, triglycerides: 220,
      weight_kg: 94, height_cm: 175, bmi: 30.7, waist_circumference: 104,
      smoking_status: 'former', alcohol_drinks_weekly: 6, exercise_minutes_weekly: 110, sleep_hours_nightly: 6, stress_level: 6,
      ace_inhibitor_adherence: 0.7, beta_blocker_adherence: 0.8, statin_adherence: 0.65, diabetes_med_adherence: 0.6, diuretic_adherence: 0.7,
      hospitalizations_6mo: 1, er_visits_6mo: 1, missed_appointments_6mo: 1
    };
    return base;
  }

  const patient = genPatient();
  const feat = window.MRP?.FeatureEngine ? MRP.FeatureEngine.deriveFeatures(patient) : patient;
  const ensPred = model.predict(feat);
  const bayesPred = bayes.predict(feat);
  const recsEngine = new WD.RecommendationEngine();
  const recs = recsEngine.suggest(feat);
  // Add Bayesian rule-like summary lines
  const bayesian = new WD.NaiveBayesRisk();
  const bayes = bayesian.predict(feat);
  const ruleHints = [
    bayes.risk_level==='high'||bayes.risk_level==='critical' ? 'Bayesian: elevated composite risk detected.' : 'Bayesian: risk appears controlled.',
    (feat.systolic_bp>140)? 'Rule: SBP>140 suggests hypertension control gap.' : null,
    (feat.hba1c>7)? 'Rule: HbA1c>7.0 suggests glycemic control gap.' : null
  ].filter(Boolean).map(t=>({ text: t }));
  const mergedRecs = [...ruleHints, ...recs];

  // Fill Overview vitals
  document.addEventListener('DOMContentLoaded', function(){
    // Vitals values
    const bs = document.querySelector('.vital-card:nth-child(1) .vital-value'); if (bs) bs.textContent = patient.random_glucose;
    const hr = document.querySelector('.vital-card:nth-child(2) .vital-value'); if (hr) hr.textContent = patient.heart_rate;
    const bp = document.querySelector('.vital-card:nth-child(3) .vital-value'); if (bp) bp.textContent = `${patient.systolic_bp}/${patient.diastolic_bp}`;

    // Charts
    const ctx1 = document.getElementById('mainLineChart');
    if (ctx1) new Chart(ctx1, { type: 'line', data: { labels: ['-90d','-60d','-30d','Now'], datasets: [{ label: 'Risk Score', borderColor: '#0b3382', data: [0.35,0.42,0.55, 1-ensPred.risk_probabilities.low] }]}, options: { responsive: true } });

    const ctx2 = document.getElementById('radarChart');
    if (ctx2) new Chart(ctx2, { type: 'radar', data: { labels: ['BP','Glycemic','Renal','HF','Adherence'], datasets: [{ label: 'Burden', backgroundColor: 'rgba(220,53,69,0.2)', borderColor: '#dc3545', data: [feat.hypertension_flag?0.8:0.3, (feat.hba1c-5)/5, feat.ckd_flag?0.7:0.2, feat.hf_flag?0.7:0.2, 1-feat.adherence_mean] }] } });

    const ctx3 = document.getElementById('timeSeriesChart');
    if (ctx3) new Chart(ctx3, { type: 'line', data: { labels: ['-90d','-60d','-30d','-14d','Now'], datasets: [{ label: 'Glucose', borderColor: '#fd7e14', data: [120, 128, 133, 138, patient.random_glucose] }] } });

    const ctx4 = document.getElementById('gaugeChart');
    if (ctx4) new Chart(ctx4, { type: 'doughnut', data: { labels: ['Critical','High','Moderate','Low'], datasets: [{ data: [ensPred.risk_probabilities.critical, ensPred.risk_probabilities.high, ensPred.risk_probabilities.moderate, ensPred.risk_probabilities.low], backgroundColor: ['#dc3545','#fd7e14','#ffc107','#28a745'] }] }, options: { circumference: 180, rotation: -90 } });

    const ctx5 = document.getElementById('stackedBarChart');
    if (ctx5) new Chart(ctx5, { type: 'bar', data: { labels: ['HbA1c','SBP','eGFR','BNP','BMI'], datasets: [{ label: 'Value', backgroundColor: '#0b3382', data: [patient.hba1c, patient.systolic_bp, patient.egfr, patient.bnp, patient.bmi] }] }, options: { plugins: { legend: { display: false } }, scales: { x: { stacked: true }, y: { stacked: true } } } });

    // Recommendations page injection
    const recCard = document.querySelector('#recommendationPage .card.p-3.my-3');
    if (recCard) {
      const list = mergedRecs.map(r => `<li>${r.text}</li>`).join('');
      recCard.insertAdjacentHTML('beforeend', `<div class="mt-2"><strong>Actionable Suggestions</strong><ul>${list}</ul><small class="text-muted">Note: age/sex/race are non-modifiable factors; targets respect guideline ranges.</small></div>`);
    }

    // History table
    const histTbody = document.querySelector('#historyTable tbody');
    if (histTbody) {
      const events = [
        { d:'-90d', e:'Clinic Visit', n:'Baseline assessment' },
        { d:'-60d', e:'Medication change', n:'Started ACE inhibitor' },
        { d:'-30d', e:'ER Visit', n:'Dizziness, discharged stable' },
        { d:'-14d', e:'Lab panel', n:'HbA1c 7.8%, eGFR 58' },
        { d:'-7d', e:'Telehealth', n:'Reinforced adherence' }
      ];
      histTbody.innerHTML = events.map(x=>`<tr><td>${x.d}</td><td>${x.e}</td><td>${x.n}</td></tr>`).join('');
    }

    // Prediction table
    const predTbody = document.querySelector('#predictionTable tbody');
    if (predTbody) {
      const rows = [
        { name:'Ensemble', p: ensPred.risk_probabilities },
        { name:'Bayesian', p: bayesPred.probabilities }
      ];
      predTbody.innerHTML = rows.map(r=>`<tr><td>${r.name}</td><td>${(r.p.low*100).toFixed(1)}%</td><td>${(r.p.moderate*100).toFixed(1)}%</td><td>${(r.p.high*100).toFixed(1)}%</td><td>${(r.p.critical*100).toFixed(1)}%</td></tr>`).join('');
    }
    // Factor Waterfall using SHAP (if available)
    (async function(){
      const exp = await loadExplanations();
      const host = document.querySelector('#recommendationPage .card.p-3.my-3');
      if (!exp || !host) return;
      const firstPid = Object.keys(exp.patients||{})[0];
      if (!firstPid) return;
      const contribs = (exp.patients[firstPid] && exp.patients[firstPid].contributions) || [];
      if (!contribs.length) return;
      const top = contribs.slice(0,8);
      const labels = top.map(x=>x.feature);
      const values = top.map(x=>x.contribution);
      const wrap = document.createElement('div');
      wrap.innerHTML = '<h6 class="mt-3">Factor Waterfall (SHAP)</h6><canvas id="waterfallChart" style="height:260px"></canvas>';
      host.appendChild(wrap);
      const ctx = document.getElementById('waterfallChart');
      if (!ctx || typeof Chart==='undefined') return;
      const colors = values.map(v=> v>=0? '#dc3545' : '#28a745');
      new Chart(ctx, { type:'bar', data:{ labels, datasets:[{ label:'Contribution', data: values, backgroundColor: colors }] }, options:{ plugins:{ legend:{ display:false } }, scales:{ x:{ stacked:false }, y:{ title:{ display:true, text:'Δ risk log-odds (approx)' } } } });
    })();
  });
})();


