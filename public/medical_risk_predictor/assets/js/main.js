/* global MRP */
(async function(){
  MRP.registerServiceWorker();
  await MRP.indexedDB.open();

  const content = document.getElementById('content');
  const globalBtn = document.getElementById('globalViewBtn');
  const patientBtn = document.getElementById('patientViewBtn');
  const patientIdInput = document.getElementById('patientIdInput');
  const loadPatientBtn = document.getElementById('loadPatientBtn');

  const model = new MRP.MedicalEnsemblePredictor();
  let patients = await MRP.indexedDB.getAll('patients');
  if (!patients.length) {
    patients = MRP.generatePatients(500);
    for (const p of patients) { await MRP.indexedDB.put('patients', p); }
  }

  function renderGlobal() {
    const gd = new MRP.GlobalDashboard(patients);
    content.innerHTML = gd.render();
  }

  function renderPatient(id) {
    const p = patients.find(x => x.patient_id === id) || patients[0];
    const features = MRP.FeatureEngine.deriveFeatures(p);
    const pred = model.predict(features);
    MRP.logPrediction({ patient_id: p.patient_id, prediction: pred });
    const pd = new MRP.PatientDashboard(p, pred);
    content.innerHTML = pd.render();
  }

  globalBtn.addEventListener('click', renderGlobal);
  patientBtn.addEventListener('click', () => renderPatient(patientIdInput.value || patients[0].patient_id));
  loadPatientBtn.addEventListener('click', () => renderPatient(patientIdInput.value || patients[0].patient_id));

  // Initial view
  renderGlobal();

  // Expose CSV export
  window.exportPatientsCSV = () => MRP.exportPatientsCSV(patients);
})();

