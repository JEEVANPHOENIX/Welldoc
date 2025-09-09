# Medical AI Risk Predictor

Synthetic, browser-only medical risk prediction demo with ensemble learning, FDA/AHA/ADA rule thresholds, and dual dashboards (Global/Patient).

- No PHI. Synthetic data generated client-side.
- IndexedDB used for persistence; Service Worker for offline.
- CSV export available via `exportPatientsCSV()` in the browser console.

## Run
Open `public/medical_risk_predictor/index.html` with a local server (e.g., `node server.js`) and navigate to `/medical_risk_predictor/`.

## Files
- `assets/js/medical-rules.js`: FDA-compliant threshold rules and rule-based classifier
- `assets/js/ensemble-models.js`: Simple ensemble with multiple model stubs
- `assets/js/feature-engine.js`: Feature derivation (BMI, flags)
- `assets/js/data-generator.js`: Synthetic dataset and CSV export
- `assets/js/global-dashboard.js`: Population view
- `assets/js/patient-dashboard.js`: Individual patient view
- `assets/js/utils.js`: Validation, IndexedDB, audit log, CSV helper
- `assets/data/medical-guidelines.json`: Reference ranges
- `assets/css/*.css`: Styling

## Notes
This demo is for educational purposes only and not a medical device. Thresholds mirror public guidelines; tune as needed. Ensemble metrics (AUROC) are illustrative without ground truth.

