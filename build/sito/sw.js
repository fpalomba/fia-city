// Generato da tools/build-static.js
const CACHE = 'fia-city-88b25883d9d5';
const FILES = ["./","assets/boss.png","css/style.css","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","js/api.js","js/audio.js","js/boss.js","js/bossarena.js","js/building.js","js/companion.js","js/config.js","js/main.js","js/map.js","js/minigames.js","js/models.js","js/obs/attenzione.js","js/obs/cluster.js","js/obs/compromesso.js","js/obs/entropia.js","js/obs/percettrone.js","js/obs/pesi.js","js/observatory.js","js/profile.js","js/scene3d.js","js/setup.js","js/sprites.js","js/ui.js","manifest.webmanifest","vendor/three-LICENSE.txt","vendor/three.module.min.js","world.json"];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  // Solo i file del sito: le chiamate al foglio Google e i font passano sempre dalla rete.
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
