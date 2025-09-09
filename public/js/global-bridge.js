/* global MRP, Chart */
(function(){
  async function loadPatients(){
    try {
      // Prefer trained predictions if available
      const pred = await fetch('data/predictions.json', { cache: 'no-cache' });
      if (pred.ok) return await pred.json();
      const res = await fetch('data/global_patients.json', { cache: 'no-cache' });
      if (res.ok) return await res.json();
    } catch(e) { /* ignore */ }
    return null;
  }
  window.addEventListener('error', function(e){ console.error('Global view error:', e.message); });
  function ensurePatients() {
    if (window.MRP?.generatePatients) {
      try { return MRP.generatePatients(1000); } catch (e) { console.warn('Generate patients failed', e); }
    }
    const arr = [];
    for (let i=0;i<500;i++) arr.push({ risk_level: (['low','moderate','high','critical'])[Math.floor(Math.random()*4)], age: 30+Math.floor(Math.random()*45), systolic_bp: 110+Math.floor(Math.random()*60), hba1c: 5+Math.random()*3, er_visits_6mo: Math.floor(Math.random()*4), hospitalizations_6mo: Math.floor(Math.random()*2), bmi: 22+Math.random()*12 });
    return arr;
  }

  document.addEventListener('DOMContentLoaded', async function(){
    let patients = [];
    try { patients = await loadPatients(); } catch(e){ patients = null; }
    if (!Array.isArray(patients) || patients.length === 0) {
      try { patients = ensurePatients() || []; } catch (e) { console.error('ensurePatients failed', e); patients = []; }
    }
    if (!Array.isArray(patients) || patients.length === 0) {
      patients = Array.from({length: 200}, (_,i)=>({ patient_id:'P-'+String(i).padStart(6,'0'), age: 40+Math.floor(Math.random()*30), risk_level: ['low','moderate','high','critical'][Math.floor(Math.random()*4)], systolic_bp: 110+Math.floor(Math.random()*50), hba1c: 5+Math.random()*3, egfr: 50+Math.random()*50, bmi: 22+Math.random()*10, er_visits_6mo: Math.floor(Math.random()*3), hospitalizations_6mo: Math.floor(Math.random()*2) }));
    }
    const summary = patients.reduce((acc,p)=>{ const r=(p&&p.risk_level)||'low'; acc[r]=(acc[r]||0)+1; return acc; },{low:0,moderate:0,high:0,critical:0});
    const n = patients.length || 1;
    const el = document.getElementById('popSummary');
    if (el) el.innerHTML = `Total: ${n}<br>Low: ${summary.low} • Moderate: ${summary.moderate} • High: ${summary.high} • Critical: ${summary.critical}`;

    // Risk distribution donut
    const donut = document.getElementById('riskDonut');
    if (donut && typeof Chart !== 'undefined') {
      const donutChart = new Chart(donut, { type: 'doughnut', data: { labels: ['Low','Moderate','High','Critical'], datasets: [{ data: [summary.low, summary.moderate, summary.high, summary.critical], backgroundColor: ['#28a745','#ffc107','#fd7e14','#dc3545'] }] }, options: { responsive: true } });
      donut.onclick = function(evt){
        const points = donutChart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
        if (points.length) {
          const idx = points[0].index; const label = donutChart.data.labels[idx].toLowerCase();
          renderTable(label);
          const note = document.getElementById('tableFilterNote'); if (note) note.textContent = 'Filter: ' + label;
        }
      };
    }

    // Risk by age bands
    const bands = ['18-34','35-49','50-64','65+'];
    const bandIdx = (age)=> age<35?0 : age<50?1 : age<65?2 : 3;
    const byAge = {low:[0,0,0,0], moderate:[0,0,0,0], high:[0,0,0,0], critical:[0,0,0,0]};
    patients.forEach(p=>{ byAge[p.risk_level][bandIdx(p.age)]++; });
    const ctx2 = document.getElementById('riskByAge');
    if (ctx2) new Chart(ctx2, { type: 'bar', data: { labels: bands, datasets: [
      { label: 'Low', backgroundColor: '#28a745', data: byAge.low },
      { label: 'Moderate', backgroundColor: '#ffc107', data: byAge.moderate },
      { label: 'High', backgroundColor: '#fd7e14', data: byAge.high },
      { label: 'Critical', backgroundColor: '#dc3545', data: byAge.critical }
    ] }, options: { responsive: true, scales: { x: { stacked: true }, y: { stacked: true } } });

    // Risk trend (synthetic 6 months)
    const months = ['M-5','M-4','M-3','M-2','M-1','Now'];
    function series(base){ return months.map((_,i)=> Math.round(base * (0.8 + i*0.08))); }
    const ctxTrend = document.getElementById('riskTrend');
    if (ctxTrend && typeof Chart !== 'undefined') new Chart(ctxTrend, { type: 'line', data: { labels: months, datasets: [
      { label:'Low', borderColor:'#28a745', data: series(summary.low/6) },
      { label:'Moderate', borderColor:'#ffc107', data: series(summary.moderate/6) },
      { label:'High', borderColor:'#fd7e14', data: series(summary.high/6) },
      { label:'Critical', borderColor:'#dc3545', data: series(summary.critical/6) }
    ] } });

    // Care gaps
    const gaps = {
      overdue_a1c: patients.filter(p=> (p.hba1c||0) >= 7.5).length,
      missing_bp: patients.filter(p=> (p.systolic_bp||0) < 1).length,
      poor_adherence: patients.filter(p=> (p.ace_inhibitor_adherence||1) < 0.5 || (p.statin_adherence||1) < 0.5).length,
      missed_appts: patients.filter(p=> (p.missed_appointments_6mo||0) >= 1).length,
      no_recent_ekg: Math.round(patients.length*0.2)
    };
    const ctxGaps = document.getElementById('careGaps');
    if (ctxGaps && typeof Chart !== 'undefined') new Chart(ctxGaps, { type: 'bar', data: { labels: ['Overdue HbA1c','Missing BP','Poor Adherence','Missed Appointments','No recent EKG'], datasets: [{ data: Object.values(gaps), backgroundColor: '#0b3382' }] }, options:{ indexAxis:'y' } });

    // Risk trajectory scatter
    const ctxTraj = document.getElementById('riskTrajectory');
    if (ctxTraj && typeof Chart !== 'undefined') {
      const pts = patients.slice(0,500).map(p=>{
        const prev = Math.random()*1; const curr = Math.random()*1; const c = (p.hba1c||0)>=6.5? '#dc3545' : (p.bmi||0)>=30? '#fd7e14' : '#28a745';
        return { x: prev, y: curr, backgroundColor: c };
      });
      new Chart(ctxTraj, { type: 'scatter', data: { datasets: [{ label:'Patients', data: pts, backgroundColor: pts.map(p=>p.backgroundColor) }] }, options: { scales: { x: { min:0, max:1, title:{display:true,text:'3 mo ago'} }, y:{ min:0, max:1, title:{display:true,text:'Now'} } } } });
    }

    // Heatmap (simple table coloring)
    const heatHost = document.getElementById('condHeatmap');
    if (heatHost) {
      const risks = ['critical','high','moderate','low'];
      const conds = ['HF','T1D','T2D','Obesity','CKD'];
      const counts = {}; risks.forEach(r=>{ counts[r]={}; conds.forEach(c=> counts[r][c]=0); });
      patients.forEach(p=>{
        const has = {
          HF: (p.systolic_bp>=130) || (p.bnp>=400),
          T1D: p.diabetes_type==='type1',
          T2D: p.diabetes_type==='type2',
          Obesity: (p.bmi||0)>=30,
          CKD: (p.egfr||0)<60
        };
        const r = p.risk_level||'low';
        Object.keys(has).forEach(k=>{ if (has[k]) counts[r][k]++; });
      });
      const table = document.createElement('table'); table.className='table table-sm';
      table.innerHTML = '<thead><tr><th></th>'+conds.map(c=>'<th>'+c+'</th>').join('')+'</tr></thead>'+
        '<tbody>'+risks.map(r=>'<tr><td>'+r+'</td>'+conds.map(c=>{
          const v = counts[r][c]; const max= Math.max(1, patients.length/2); const intensity = Math.min(1, v/max);
          const bg = `rgba(11,51,130,${intensity})`; const color = intensity>0.5? '#fff':'#000';
          return '<td style="background:'+bg+';color:'+color+'">'+v+'</td>';
        }).join('')+'</tr>').join('')+'</tbody>';
      heatHost.innerHTML = ''; heatHost.appendChild(table);
    }

    // Biomarker Box Plots (approx via min/max/median bars)
    const ctxBox = document.getElementById('biomarkerBox');
    if (ctxBox && typeof Chart !== 'undefined') {
      function stats(vals){
        const s=vals.filter(v=>Number.isFinite(v)).slice().sort((a,b)=>a-b); const n=s.length;
        if (!n) return { min:0, q1:0, med:0, q3:0, max:0 };
        const q=(p)=> s[Math.floor(p*(n-1))];
        return { min:s[0], q1:q(0.25), med:q(0.5), q3:q(0.75), max:s[n-1] };
      }
      const groups = ['low','moderate','high','critical'];
      const biom = ['hba1c','egfr','bnp','ejection_fraction','ldl_cholesterol','systolic_bp'];
      const data = biom.map(k=> groups.map(g=> stats(patients.filter(p=>p.risk_level===g).map(p=>+p[k])) ));
      // Encode as stacked bars showing [min->q1], [q1->med], [med->q3], [q3->max]
      const labels = biom.map(b=> b.toUpperCase());
      const ds = [];
      const colors = ['#e0e7ff','#a5b4fc','#818cf8','#6366f1'];
      for (let part=0; part<4; part++) {
        ds.push({ label:['min-q1','q1-med','med-q3','q3-max'][part], backgroundColor: colors[part], data: labels.map((_,i)=> {
          const seg = data[i].map(st=> Math.max(0,(part===0? st.q1-st.min : part===1? st.med-st.q1 : part===2? st.q3-st.med : st.max-st.q3)));
          // Show average span per risk group to keep scale reasonable
          const valid = seg.filter(v=>Number.isFinite(v));
          return valid.length? valid.reduce((a,b)=>a+b,0)/valid.length : 0;
        }) });
      }
      new Chart(ctxBox, { type: 'bar', data: { labels, datasets: ds }, options: { responsive:true, plugins:{ legend:{ position:'bottom' } }, scales:{ x:{ stacked:true }, y:{ stacked:true } } } });
    }

    // Sunburst approximation using stacked doughnut segments
    const ctxSun = document.getElementById('sunburst');
    if (ctxSun && typeof Chart !== 'undefined') {
      const risks = ['Low','Moderate','High','Critical'];
      const riskCounts = [summary.low||0, summary.moderate||0, summary.high||0, summary.critical||0];
      const conds = ['HF','Diabetes','Obesity','CKD'];
      const condCounts = conds.map(c=> Math.round(patients.length/4));
      new Chart(ctxSun, { type: 'doughnut', data: { labels: risks.concat(conds), datasets: [
        { label:'Risk', data: riskCounts, backgroundColor: ['#28a745','#ffc107','#fd7e14','#dc3545'] },
        { label:'Condition', data: condCounts, backgroundColor: ['#0b3382','#17a2b8','#6f42c1','#6c757d'] }
      ] }, options: { cutout: '40%', plugins:{ legend:{ position:'bottom' } } });
    }

    // Patients table with filter
    function renderTable(filter) {
      const tbody = document.querySelector('#patientsTable tbody'); if (!tbody) return;
      const rows = patients.filter(p=> !filter || (p.risk_level===filter)).slice(0,200)
        .map(p=> `<tr><td>${p.patient_id||''}</td><td>${p.age||''}</td><td>${p.risk_level||''}</td><td>${p.systolic_bp||''}</td><td>${p.hba1c||''}</td><td>${p.egfr||''}</td><td>${p.bmi||''}</td></tr>`).join('');
      tbody.innerHTML = rows;
    }
    renderTable();
  });
})();


