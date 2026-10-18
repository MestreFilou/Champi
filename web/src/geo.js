// Petits calculs géographiques côté navigateur (distances, caps, emprises, GPX).

const R = 6_371_000;
const rad = (d) => (d * Math.PI) / 180;

// Distance en mètres entre deux points { lat, lon }
export function distance(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const trackLength = (pts) => pts.reduce((sum, p, i) => (i ? sum + distance(pts[i - 1], p) : 0), 0);

// Cap de a vers b en degrés (0 = nord), et son libellé sur 8 directions
export function bearing(a, b) {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
export const compass = (deg) => DIRS[Math.round(deg / 45) % 8];

export const formatDistance = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10_000 ? 2 : 1).replace('.', ',')} km`);

export function formatDuration(ms) {
  const min = Math.floor(ms / 60_000);
  const h = Math.floor(min / 60);
  return h ? `${h} h ${String(min % 60).padStart(2, '0')}` : `${min} min`;
}

// Emprise { s, w, n, e } d'un disque de rayon km
export function circleBbox(lat, lon, km) {
  const dLat = km / 111.32;
  const dLon = km / (111.32 * Math.cos(rad(lat)));
  return { s: lat - dLat, w: lon - dLon, n: lat + dLat, e: lon + dLon };
}

export const inBbox = (b, lat, lon) => !!b && lat >= b.s && lat <= b.n && lon >= b.w && lon <= b.e;

// Point dans un Polygon / MultiPolygon GeoJSON (anneaux extérieurs et trous)
export function inGeojson(geom, lon, lat) {
  if (!geom) return false;
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
  return polys.some((rings) => inRing(rings[0], lon, lat) && !rings.slice(1).some((r) => inRing(r, lon, lat)));
}

function inRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Point représentatif d'un peuplement : moyenne des sommets de son premier anneau
export function featureCenter(feature) {
  const ring = feature.geometry.coordinates[0][0];
  const n = ring.length - 1 || 1;
  let x = 0;
  let y = 0;
  for (let i = 0; i < n; i++) {
    x += ring[i][0];
    y += ring[i][1];
  }
  return [x / n, y / n];
}

const xml = (s) => String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);

// GPX 1.1 : la trace de la sortie + les coins marqués en waypoints
export function toGpx({ name, track, spots }) {
  const iso = (t) => new Date(t).toISOString();
  const wpts = spots
    .map((s) => `  <wpt lat="${s.lat}" lon="${s.lon}"><time>${iso(s.t)}</time><name>${xml(s.name)}</name></wpt>`)
    .join('\n');
  const pts = track
    .map((p) => `      <trkpt lat="${p.lat}" lon="${p.lon}">${p.alt != null ? `<ele>${Math.round(p.alt)}</ele>` : ''}<time>${iso(p.t)}</time></trkpt>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Champi" xmlns="http://www.topografix.com/GPX/1/1">
${wpts}
  <trk>
    <name>${xml(name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}
