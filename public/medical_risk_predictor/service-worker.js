self.addEventListener('install', (e) => {
  e.waitUntil(caches.open('mrp-cache-v1').then(cache => cache.addAll([
    './',
    './index.html',
    './assets/css/shared-components.css',
    './assets/css/global-dashboard.css',
    './assets/css/patient-dashboard.css',
    './assets/js/utils.js',
    './assets/js/medical-rules.js',
    './assets/js/feature-engine.js',
    './assets/js/ensemble-models.js',
    './assets/js/data-generator.js',
    './assets/js/global-dashboard.js',
    './assets/js/patient-dashboard.js',
    './assets/js/main.js',
    './assets/data/medical-guidelines.json'
  ])));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(resp => resp || fetch(e.request))
  );
});

