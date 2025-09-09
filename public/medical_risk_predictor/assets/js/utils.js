/* eslint-disable no-console */
window.MRP = window.MRP || {};

MRP.assertNumberInRange = function(value, min, max, fieldName) {
  const num = Number(value);
  if (Number.isNaN(num) || num < min || num > max) {
    throw new Error(`Invalid ${fieldName}: ${value} not in [${min}, ${max}]`);
  }
  return num;
};

MRP.clamp = function(value, min, max) { return Math.max(min, Math.min(max, value)); };
MRP.rand = function(min, max) { return Math.random() * (max - min) + min; };
MRP.randInt = function(min, max) { return Math.floor(MRP.rand(min, max + 1)); };

MRP.uuid = function(prefix = 'P') {
  const n = String(MRP.randInt(0, 999999)).padStart(6, '0');
  return `${prefix}-${n}`;
};

MRP.normalizeProbs = function(obj) {
  const total = Object.values(obj).reduce((a, b) => a + b, 0) || 1;
  const out = {};
  Object.keys(obj).forEach(k => { out[k] = obj[k] / total; });
  return out;
};

MRP.weightedAverage = function(values, weights) {
  let sum = 0; let wsum = 0;
  Object.keys(values).forEach(k => { const w = weights[k] ?? 0; wsum += w; sum += (values[k] ?? 0) * w; });
  return wsum > 0 ? sum / wsum : 0;
};

MRP.indexedDB = {
  db: null,
  open(name = 'mrp-db', version = 1) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name, version);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('patients')) db.createObjectStore('patients', { keyPath: 'patient_id' });
      };
      req.onsuccess = () => { this.db = req.result; resolve(this.db); };
      req.onerror = () => reject(req.error);
    });
  },
  put(store, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  getAll(store) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
};

MRP.auditLog = [];
MRP.logPrediction = function(entry) {
  const record = { timestamp: new Date().toISOString(), ...entry };
  MRP.auditLog.push(record);
  if (MRP.auditLog.length > 1000) MRP.auditLog.shift();
  try { localStorage.setItem('mrp_audit', JSON.stringify(MRP.auditLog)); } catch (e) {}
};

MRP.registerServiceWorker = function() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
};

MRP.csv = {
  toCSV(rows) {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [headers.join(',')];
    rows.forEach(r => lines.push(headers.map(h => escape(r[h])).join(',')));
    return lines.join('\n');
  },
  downloadCSV(filename, rows) {
    const csv = this.toCSV(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
};

