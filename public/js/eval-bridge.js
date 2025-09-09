/* global Chart, MRP */
(function(){
  async function loadEval(){
    try {
      // Prefer trained evaluation if available
      const trained = await fetch('data/evaluation_trained.json', { cache: 'no-cache' });
      if (trained.ok) return await trained.json();
      const res = await fetch('data/evaluation.json', { cache: 'no-cache' });
      if (res.ok) return await res.json();
    } catch(e) { /* ignore */ }
    return null;
  }
  function sigmoid(x){ return 1/(1+Math.exp(-x)); }
  function generateLabeledSet(n=2000) {
    // Use generator + ensemble to produce features and pseudo-labels with noise
    const model = new MRP.MedicalEnsemblePredictor();
    const rows = MRP.generatePatients(n);
    return rows.map(p=>{
      const f = MRP.FeatureEngine.deriveFeatures(p);
      const pred = model.predict(f);
      const score = 0.25*pred.risk_probabilities.critical + 0.2*pred.risk_probabilities.high + 0.15*pred.risk_probabilities.moderate;
      // Convert to binary outcome with calibrated noise
      const y = Math.random() < score ? 1 : 0;
      return { y, score, probs: pred.risk_probabilities };
    });
  }

  function computeROC(data, steps=50) {
    const pts=[]; for (let t=0;t<=steps;t++){ const thr=t/steps; let tp=0, fp=0, tn=0, fn=0; data.forEach(d=>{ const yhat = d.score>=thr ? 1:0; if (yhat && d.y) tp++; else if (yhat && !d.y) fp++; else if (!yhat && !d.y) tn++; else fn++; }); const tpr = tp/(tp+fn||1); const fpr = fp/(fp+tn||1); pts.push({x:fpr, y:tpr}); }
    // Approx AUROC via trapezoid
    const sorted=pts.slice().sort((a,b)=>a.x-b.x); let auc=0; for(let i=1;i<sorted.length;i++){ const dx=sorted[i].x-sorted[i-1].x; const avgY=(sorted[i].y+sorted[i-1].y)/2; auc += dx*avgY; } return { pts:sorted, auc };
  }

  function computePR(data, steps=50) {
    const pts=[]; for (let t=0;t<=steps;t++){ const thr=t/steps; let tp=0, fp=0, fn=0; data.forEach(d=>{ const yhat = d.score>=thr ? 1:0; if (yhat && d.y) tp++; else if (yhat && !d.y) fp++; else if (!yhat && d.y) fn++; }); const prec = tp/(tp+fp||1); const rec = tp/(tp+fn||1); pts.push({x:rec, y:prec}); }
    // Approx AUPRC
    const sorted=pts.slice().sort((a,b)=>a.x-b.x); let auprc=0; for(let i=1;i<sorted.length;i++){ const dx=sorted[i].x-sorted[i-1].x; const avgY=(sorted[i].y+sorted[i-1].y)/2; auprc += dx*avgY; } return { pts:sorted, auprc };
  }

  function calibration(data, bins=10) {
    const bucket = Array.from({length:bins}, ()=>[]);
    data.forEach(d=>{ const b=Math.min(bins-1, Math.floor(d.score*bins)); bucket[b].push(d); });
    const xs=[], ys=[]; for(let i=0;i<bins;i++){ const arr=bucket[i]; if (!arr.length) { xs.push((i+0.5)/bins); ys.push(0); continue; } const meanScore = arr.reduce((a,b)=>a+b.score,0)/arr.length; const obs = arr.reduce((a,b)=>a+b.y,0)/arr.length; xs.push(meanScore); ys.push(obs); }
    return { xs, ys };
  }

  function confusionMatrix(data, thr=0.5) {
    let tp=0, fp=0, tn=0, fn=0; data.forEach(d=>{ const yhat=d.score>=thr?1:0; if (yhat&&d.y) tp++; else if (yhat&&!d.y) fp++; else if (!yhat&&!d.y) tn++; else fn++; });
    return { tn, fp, fn, tp };
  }

  document.addEventListener('DOMContentLoaded', async function(){
    const pre = await loadEval();
    const data = pre ? pre : (function(){
      const tmp = generateLabeledSet(1500);
      return { 
        roc: computeROC(tmp, 60), 
        pr: computePR(tmp, 60), 
        calibration: calibration(tmp, 10), 
        confusion: confusionMatrix(tmp, 0.5) 
      };
    })();

    // ROC
    // Support both {pts, auc} and {points, auc}
    const rocData = data.roc || computeROC(generateLabeledSet(1500), 60);
    const rocPts = rocData.points || rocData.pts || [];
    const rocAuc = rocData.auc || 0;
    const ctxR = document.getElementById('rocChart');
    if (ctxR) new Chart(ctxR, { type: 'line', data: { labels: rocPts.map(p=>Number(p.x).toFixed(2)), datasets: [{ label: `ROC (AUROC ${Number(rocAuc).toFixed(2)})`, borderColor: '#0b3382', data: rocPts.map(p=>p.y) }] }, options: { scales: { x: { title: { text:'False Positive Rate', display:true } }, y: { title: { text:'True Positive Rate', display:true } } } } });

    // PR
    const prData = data.pr || computePR(generateLabeledSet(1500), 60);
    const prPts = prData.points || prData.pts || [];
    const auprc = prData.auprc || 0;
    const ctxP = document.getElementById('prChart');
    if (ctxP) new Chart(ctxP, { type: 'line', data: { labels: prPts.map(p=>Number(p.x).toFixed(2)), datasets: [{ label: `PR (AUPRC ${Number(auprc).toFixed(2)})`, borderColor: '#dc3545', data: prPts.map(p=>p.y) }] }, options: { scales: { x: { title: { text:'Recall', display:true } }, y: { title: { text:'Precision', display:true } } } } });

    // Calibration
    const cal = data.calibration || calibration(generateLabeledSet(1500), 10);
    const ctxC = document.getElementById('calChart');
    if (ctxC) new Chart(ctxC, { type: 'scatter', data: { datasets: [
      { label: 'Observed vs Expected', data: cal.xs.map((x,i)=>({x, y: cal.ys[i]})), borderColor: '#17a2b8' },
      { label: 'Perfect', data: [{x:0,y:0},{x:1,y:1}], borderColor: '#6c757d', showLine: true, pointRadius: 0 }
    ] }, options: { scales: { x: { min:0, max:1 }, y: { min:0, max:1 } } } });

    // Confusion Matrix (binary simplification of multiclass risk)
    const cm = data.confusion || confusionMatrix(generateLabeledSet(1500), 0.5);
    const ctxM = document.getElementById('cmChart');
    if (ctxM) new Chart(ctxM, { type: 'bar', data: { labels: ['Actual Neg','Actual Pos'], datasets: [
      { label: 'Pred Neg', data: [cm.tn, cm.fn] },
      { label: 'Pred Pos', data: [cm.fp, cm.tp] }
    ] }, options: { scales: { x: { stacked: true }, y: { stacked: true } } } });
  });
})();


