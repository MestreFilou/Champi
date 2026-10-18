import { cached, DAY } from './cache.js';
import { getJson } from './http.js';

const STOP_WORDS = new Set(['foret', 'forêt', 'bois', 'de', 'des', 'du', 'la', 'le', 'les', 'l', 'd', 'domaniale', 'communale', 'massif']);

/**
 * Recherche de forêts et de lieux en France.
 * - Forêts publiques (domaniales, communales…) : BD TOPO de l'IGN, qui a les noms officiels.
 * - Communes, lieux-dits, bois privés : Nominatim (OpenStreetMap).
 */
export function searchPlaces(q) {
  const query = q.trim();
  return cached(`search:${query.toLowerCase()}`, DAY, async () => {
    const [forests, places] = await Promise.all([
      searchPublicForests(query).catch((err) => {
        console.error('Recherche IGN :', err.message);
        return [];
      }),
      searchNominatim(query).catch((err) => {
        console.error('Recherche Nominatim :', err.message);
        return [];
      }),
    ]);
    const seen = new Set(forests.map((f) => f.name.toLowerCase()));
    return [...forests, ...places.filter((p) => !seen.has(p.name.toLowerCase()))].sort((a, b) => b.isForest - a.isForest);
  });
}

async function searchPublicForests(query) {
  const words = query
    .toLowerCase()
    .split(/[\s'’-]+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  if (!words.length) return [];
  // ILIKE est sensible aux accents : on remplace les lettres accentuables par le joker « _ ».
  const filter = words.map((w) => `toponyme ILIKE '%${w.replace(/'/g, '').replace(/[aàâäeéèêëiîïoôöuùûücç]/g, '_')}%'`).join(' AND ');

  const url = new URL('https://data.geopf.fr/wfs/ows');
  url.search = new URLSearchParams({
    SERVICE: 'WFS',
    VERSION: '2.0.0',
    REQUEST: 'GetFeature',
    TYPENAMES: 'BDTOPO_V3:foret_publique',
    OUTPUTFORMAT: 'application/json',
    SRSNAME: 'EPSG:4326',
    COUNT: '60',
    CQL_FILTER: filter,
  });
  const fc = await getJson(url, { timeoutMs: 20_000 });
  // Le joker est large (« ch__x » trouve « Cheix ») : on revérifie mot par mot, accents retirés.
  const wordRes = words.map((w) => new RegExp(`\\b${deburr(w)}\\b`));
  return fc.features
    .filter((f) => f.geometry && wordRes.every((re) => re.test(deburr(f.properties.toponyme))))
    .sort((a, b) => rankNature(a.properties.nature) - rankNature(b.properties.nature))
    .slice(0, 8)
    .map((f) => {
      const bbox = bboxOf(f.geometry);
      return {
        id: f.id,
        name: f.properties.toponyme,
        label: `${f.properties.nature} · IGN`,
        type: 'forest',
        isForest: true,
        lat: (bbox[0] + bbox[1]) / 2,
        lon: (bbox[2] + bbox[3]) / 2,
        bbox,
        geojson: simplify(f.geometry),
      };
    });
}

async function searchNominatim(query) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    countrycodes: 'fr',
    limit: 8,
    polygon_geojson: 1,
    polygon_threshold: 0.0005,
    'accept-language': 'fr',
  });
  const results = await getJson(url, { headers: { Referer: 'http://localhost/champi' } });
  return results
    .filter((r) => r.category !== 'highway')
    .map((r) => ({
      id: `${r.osm_type}${r.osm_id}`,
      name: r.name || r.display_name.split(',')[0],
      label: r.display_name,
      type: r.type,
      isForest: ['forest', 'wood'].includes(r.type) || /\b(forêt|foret|bois)\b/i.test(r.name || ''),
      lat: Number(r.lat),
      lon: Number(r.lon),
      bbox: r.boundingbox?.map(Number), // [sud, nord, ouest, est]
      geojson: r.geojson?.type?.includes('Polygon') ? r.geojson : null,
    }));
}

const deburr = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const rankNature = (n) => (n === 'Forêt domaniale' ? 0 : 1);

// [sud, nord, ouest, est], même convention que Nominatim
function bboxOf(geom) {
  let [s, n, w, e] = [Infinity, -Infinity, Infinity, -Infinity];
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  for (const poly of polys)
    for (const [x, y] of poly[0]) {
      if (y < s) s = y;
      if (y > n) n = y;
      if (x < w) w = x;
      if (x > e) e = x;
    }
  return [s, n, w, e];
}

// Contours IGN très détaillés : on ne garde que l'enveloppe extérieure, décimée, pour l'affichage.
function simplify(geom, maxPoints = 400) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  const total = polys.reduce((a, p) => a + p[0].length, 0);
  const step = Math.max(1, Math.ceil(total / maxPoints));
  const coordinates = polys
    .map((p) => {
      const ring = p[0].filter((_, i) => i % step === 0);
      if (ring.length < 3) return null;
      ring.push(ring[0]);
      return [ring];
    })
    .filter(Boolean);
  return { type: 'MultiPolygon', coordinates };
}
