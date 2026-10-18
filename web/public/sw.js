// Service worker Champi : l'appli et les données consultées restent disponibles sans réseau.
// - appli (HTML, JS, CSS) : réseau d'abord, cache si hors ligne ;
// - API : réseau d'abord, mais si le réseau traîne (forêt, une barre), on sert la dernière réponse connue ;
// - tuiles de carte : cache d'abord (elles ne changent pas), enregistrées à la consultation ou à l'avance.

const VERSION = 'v1';
const SHELL = `champi-shell-${VERSION}`;
const API = 'champi-api';
const TILES = 'champi-tiles';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon-192.png'])));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith('champi-shell-') && key !== SHELL) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

const isTile = (url) =>
  (url.hostname === 'data.geopf.fr' && url.pathname.startsWith('/wmts')) || url.hostname === 'tile.openstreetmap.org';

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (isTile(url)) return event.respondWith(cacheFirst(req, TILES));
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return event.respondWith(networkFirst(req, API, { slowMs: 6000 }));
  if (url.pathname.startsWith('/assets/')) return event.respondWith(cacheFirst(req, SHELL)); // noms hachés : immuables
  if (req.mode === 'navigate') return event.respondWith(networkFirst(req, SHELL, { fallback: '/' }));
  event.respondWith(networkFirst(req, SHELL));
});

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req, name, { slowMs, fallback } = {}) {
  const cache = await caches.open(name);
  const network = fetch(req).then((res) => {
    // Une réponse redirigée (page de connexion) ne doit jamais remplacer l'appli en cache
    if (res.ok && !res.redirected) cache.put(req, res.clone());
    return res;
  });
  const cached = () => cache.match(req).then((hit) => hit || (fallback && cache.match(fallback)));
  if (slowMs) {
    // Réseau lent : la réponse en cache si on en a une, sinon on attend le réseau
    const timeout = new Promise((resolve) => setTimeout(resolve, slowMs, 'slow'));
    const first = await Promise.race([network.catch(() => 'error'), timeout]);
    if (first !== 'slow' && first !== 'error') return first;
    const hit = await cached();
    if (hit) return hit;
    return network;
  }
  try {
    return await network;
  } catch (err) {
    const hit = await cached();
    if (hit) return hit;
    throw err;
  }
}
