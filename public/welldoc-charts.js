// welldoc-charts.js
// Requires: Chart.js, anime.js (loaded before this file)
// Creates: mainLineChart, radarChart, timeSeriesChart, gaugeChart, stackedBarChart, aiBarChart, doctorPieChart, riskLineChart
(function () {
  const PRIMARY = '#0056b3';
  const SECONDARY = '#007bff';
  const GREEN = '#28a745';
  const RED = '#dc3545';

  // Helper: safe getContext
  function getCtx(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    try { return el.getContext('2d'); } catch (e) { return null; }
  }

  // Helper: last N day labels (e.g. "08 Sep")
  function lastNDaysLabels(n) {
    const labels = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })); // "8 Sep"
    }
    return labels;
  }

  // Helper: random walk generator
  function randomWalk(n, start, volatility, min, max) {
    const arr = [];
    let v = start;
    for (let i = 0; i < n; i++) {
      const change = (Math.random() - 0.5) * volatility;
      v = Math.max(min, Math.min(max, Math.round(v + change)));
      arr.push(v);
    }
    return arr;
  }

  // Safer gradient builder
  function createGradientSafe(ctx, hexOrRgba, a0=0.45, a1=0) {
    const hex = hexOrRgba.replace('#','');
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    const grad = ctx.createLinearGradient(0,0,0,ctx.canvas.height || 300);
    grad.addColorStop(0, `rgba(${r},${g},${b},${a0})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},${a1})`);
    return grad;
  }

  // Chart references
  const charts = {};

  // ====================
  // Dashboard Charts
  // ====================

  // Main smoothed time-series (180 days)
  function createMainLineChart() {
    const ctx = getCtx('mainLineChart');
    if (!ctx) return null;

    const gGlucose = createGradientSafe(ctx, '#dc3545', 0.45, 0);
    const gBP = createGradientSafe(ctx, PRIMARY, 0.25, 0);
    const gLDL = createGradientSafe(ctx, GREEN, 0.2, 0);

    const labels = lastNDaysLabels(180);
    const glucose = randomWalk(180, 120, 18, 80, 220);
    const bp = randomWalk(180, 125, 12, 90, 180);
    const ldl = randomWalk(180, 150, 8, 80, 220);

    try {
      charts.mainLine = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Glucose (mg/dL)',
              data: glucose,
              borderColor: RED,
              backgroundColor: gGlucose,
              borderWidth: 2,
              tension: 0.36,
              fill: true,
              pointRadius: 0
            },
            {
              label: 'BP (Systolic)',
              data: bp,
              borderColor: PRIMARY,
              backgroundColor: gBP,
              borderWidth: 2,
              tension: 0.36,
              fill: true,
              pointRadius: 0
            },
            {
              label: 'LDL (mg/dL)',
              data: ldl,
              borderColor: GREEN,
              backgroundColor: gLDL,
              borderWidth: 2,
              tension: 0.36,
              fill: true,
              pointRadius: 0
            }
          ]
        },
        options: {
          maintainAspectRatio: false,
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              mode: 'index',
              intersect: false,
              callbacks: {
                label: ctx => `${ctx.dataset.label}: ${ctx.formattedValue}`
              }
            }
          },
          scales: {
            x: { display: false, grid: { display: false } },
            y: {
              grid: { color: 'rgba(0,0,0,0.04)' },
              ticks: { color: '#333' }
            }
          },
          animation: { duration: 1100, easing: 'easeOutQuart' }
        }
      });
      return charts.mainLine;
    } catch (err) {
      console.error('mainLineChart error', err);
      return null;
    }
  }

  // Radar / Spider chart
  function createRadarChart() {
    const ctx = getCtx('radarChart');
    if (!ctx) return null;

    try {
      charts.radar = new Chart(ctx, {
        type: 'radar',
        data: {
          labels: ['BP', 'Glucose', 'LDL', 'BMI', 'Activity', 'Sleep'],
          datasets: [{
            label: 'Wellness Score',
            data: [70, 60, 50, 65, 75, 80],
            backgroundColor: 'rgba(0,86,179,0.18)',
            borderColor: PRIMARY,
            pointBackgroundColor: PRIMARY,
            borderWidth: 2,
          }]
        },
        options: {
          maintainAspectRatio: false,
          responsive: true,
          elements: { line: { tension: 0.3 } },
          scales: {
            r: {
              angleLines: { color: '#eee' },
              grid: { color: '#f4f6fb' },
              suggestedMin: 0,
              suggestedMax: 100,
              pointLabels: { color: '#444', font: { weight: 500 } }
            }
          },
          plugins: {
            tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.formattedValue}` } }
          },
          animation: { duration: 900, easing: 'easeOutCubic' }
        }
      });
      return charts.radar;
    } catch (err) {
      console.error('radarChart error', err);
      return null;
    }
  }

  // Small time-series (last 20 days)
  function createTimeSeriesChart() {
    const ctx = getCtx('timeSeriesChart');
    if (!ctx) return null;

    const labels = lastNDaysLabels(20);
    const sugar = randomWalk(20, 140, 12, 90, 240);
    const grad = createGradientSafe(ctx, PRIMARY, 0.22, 0);

    try {
      charts.timeSeries = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Blood Sugar (mg/dL)',
            data: sugar,
            borderColor: PRIMARY,
            backgroundColor: grad,
            fill: true,
            tension: 0.36,
            pointRadius: 2,
            pointHoverRadius: 4
          }]
        },
        options: {
          maintainAspectRatio: false,
          responsive: true,
          plugins: { legend: { display: false }, tooltip: { mode: 'index' } },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#666' } },
            y: { ticks: { color: '#666' }, grid: { color: 'rgba(0,0,0,0.04)' } }
          },
          animation: { duration: 900, easing: 'easeOutCubic' }
        }
      });
      return charts.timeSeries;
    } catch (err) {
      console.error('timeSeriesChart error', err);
      return null;
    }
  }

  // Gauge-like doughnut (risk score)
  function createGaugeChart() {
    const ctx = getCtx('gaugeChart');
    if (!ctx) return null;

    const value = 62;
    try {
      charts.gauge = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Value', 'Remaining'],
          datasets: [{
            data: [value, 100 - value],
            backgroundColor: [PRIMARY, 'rgba(0,0,0,0.08)'],
            borderWidth: 0
          }]
        },
        options: {
          rotation: -Math.PI,
          circumference: Math.PI,
          cutout: '70%',
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: true } },
          animation: { animateRotate: true, duration: 900, easing: 'easeOutQuart' }
        }
      });
      return charts.gauge;
    } catch (err) {
      console.error('gaugeChart error', err);
      return null;
    }
  }

  // Stacked bar: lab result ranges
  function createStackedBarChart() {
    const ctx = getCtx('stackedBarChart');
    if (!ctx) return null;

    try {
      charts.stackedBar = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Hemoglobin','WBC','Platelets'],
          datasets: [
            { label: 'Low', data: [10, 2, 50], backgroundColor: 'rgba(220,53,69,0.9)' },
            { label: 'Normal', data: [80, 5, 200], backgroundColor: 'rgba(0,86,179,0.9)' },
            { label: 'High', data: [10, 1, 30], backgroundColor: 'rgba(40,167,69,0.9)' }
          ]
        },
        options: {
          maintainAspectRatio: false,
          responsive: true,
          plugins: { legend: { position: 'top' } },
          scales: {
            x: { stacked: true, grid: { display: false } },
            y: { stacked: true, grid: { color: 'rgba(0,0,0,0.04)' } }
          },
          animation: { duration: 900 }
        }
      });
      return charts.stackedBar;
    } catch (err) {
      console.error('stackedBarChart error', err);
      return null;
    }
  }

  // ====================
  // Recommendation Page Charts
  // ====================

  // AI Bar Chart (glucose vs normal range)
  function createAiBarChart() {
    const ctx = getCtx('aiBarChart');
    if (!ctx) return null;

    try {
      charts.aiBar = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Normal Range (Max)', 'Patient Value'],
          datasets: [{
            label: 'Glucose (mg/dL)',
            data: [100, 125],
            backgroundColor: ['#4CAF50', '#FF5252']
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } }
        }
      });
      return charts.aiBar;
    } catch (err) {
      console.error('aiBarChart error', err);
      return null;
    }
  }

  // Doctor Pie Chart (recommendations distribution)
  function createDoctorPieChart() {
    const ctx = getCtx('doctorPieChart');
    if (!ctx) return null;

    try {
      charts.doctorPie = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: ['Diet', 'Exercise', 'Monitoring'],
          datasets: [{
            data: [40, 35, 25],
            backgroundColor: ['#2196F3', '#FF9800', '#9C27B0']
          }]
        },
        options: { responsive: true }
      });
      return charts.doctorPie;
    } catch (err) {
      console.error('doctorPieChart error', err);
      return null;
    }
  }

  // Risk Line Chart (last 3 glucose reports)
  function createRiskLineChart() {
    const ctx = getCtx('riskLineChart');
    if (!ctx) return null;

    try {
      charts.riskLine = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Report 1', 'Report 2', 'Report 3'],
          datasets: [{
            label: 'Glucose (mg/dL)',
            data: [122, 124, 125],
            borderColor: '#E91E63',
            fill: false,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: false, suggestedMin: 70, suggestedMax: 140 }
          }
        }
      });
      return charts.riskLine;
    } catch (err) {
      console.error('riskLineChart error', err);
      return null;
    }
  }

  // ====================
  // Animations
  // ====================
  function animateBoxes() {
    if (typeof anime !== 'function') return;
    anime({
      targets: '.box',
      translateY: [30, 0],
      opacity: [0, 1],
      delay: anime.stagger(120),
      easing: 'easeOutExpo',
      duration: 700
    });
  }

  // ====================
  // Init
  // ====================
  function initCharts() {
    try {
      // Dashboard
      createMainLineChart();
      createRadarChart();
      createTimeSeriesChart();
      createGaugeChart();
      createStackedBarChart();

      // Recommendations
      createAiBarChart();
      createDoctorPieChart();
      createRiskLineChart();

      animateBoxes();
      console.log('Welldoc charts initialised');
    } catch (e) {
      console.error('Error initialising charts', e);
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initCharts, 50);
  } else {
    window.addEventListener('DOMContentLoaded', initCharts);
  }

  window.WelldocCharts = { init: initCharts, charts };
})();
