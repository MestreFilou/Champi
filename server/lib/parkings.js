import { cached, DAY } from './cache.js';
import { USER_AGENT } from './http.js';

// Serveurs Overpass (OpenStreetMap), essayés dans l'ordre : le principal sature parfois et met souvent 20–30 s.
const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

/** Parkings publics les plus proches d'un point (OpenStreetMap), du plus près au plus loin. */
export function getParkings(lat, lon, radiusM = 3000) {
  return cached(`parkings:${lat.toFixed(3)},${lon.toFixed(3)}`, 14 * DAY, async () => {
    const query = `[out:json][timeout:20];nwr["amenity"="parking"]["access"!~"private|no|customers"](around:${radiusM},${lat},${lon});out center tags 40;`;
    // Chargé à part de l'analyse (le serveur est lent), et mis en cache longtemps : les parkings bougent peu.
    let lastErr;
    // Délais : 40 s pour le serveur principal, 15 s pour le secours, sous les 60 s d'une fonction Vercel
    for (const [server, timeout] of [[SERVERS[0], 40_000], [SERVERS[1], 15_000]]) {
      try {
        const res = await fetch(server, {
          method: 'POST',
          headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(timeout),
        });
        if (!res.ok) throw new Error(`${res.status} sur ${new URL(server).host}`);
        const d = await res.json();
        return d.elements
          .map((e) => {
            const p = e.type === 'node' ? e : e.center;
            return { id: `${e.type}${e.id}`, lat: p.lat, lon: p.lon, name: e.tags?.name ?? null, distance: Math.round(dist(lat, lon, p.lat, p.lon)) };
          })
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 8);
      } catch (err) {
        console.error('Overpass', server, err.message);
        lastErr = err;
      }
    }
    throw Object.assign(new Error(`Parkings indisponibles (OpenStreetMap saturé, réessaie plus tard) : ${lastErr.message}`), { status: 503 });
  });
}

function dist(la1, lo1, la2, lo2) {
  const r = Math.PI / 180;
  const h = Math.sin(((la2 - la1) * r) / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(((lo2 - lo1) * r) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}
