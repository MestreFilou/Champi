import { cached, DAY } from './cache.js';
import { getJson, roundCoord } from './http.js';

const WFS = 'https://data.geopf.fr/wfs/ows';
const LAYER = 'LANDCOVER.FORESTINVENTORY.V2:formation_vegetale';
const GRID = 30; // échantillonnage GRID x GRID dans le disque d'analyse

/**
 * Composition forestière autour d'un point d'après la BD Forêt V2 de l'IGN.
 * On échantillonne une grille de points dans un disque de rayon `radiusKm` et on regarde
 * dans quel polygone BD Forêt tombe chaque point : ça donne directement des parts de surface.
 */
export function getForestComposition(lat, lon, radiusKm = 1) {
  return cached(`forest:${roundCoord(lat)},${roundCoord(lon)},${radiusKm}`, 7 * DAY, async () => {
    const dLat = radiusKm / 111.32;
    const dLon = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
    const bbox = [lat - dLat, lon - dLon, lat + dLat, lon + dLon];

    const features = (await fetchForestFeatures(bbox)).map((f) => ({ props: f.properties, polys: toPolygons(f.geometry), bbox: geomBbox(f.geometry) }));

    const counts = {};
    const formations = {};
    let total = 0;
    for (let i = 0; i < GRID; i++) {
      for (let j = 0; j < GRID; j++) {
        const u = ((i + 0.5) / GRID) * 2 - 1;
        const v = ((j + 0.5) / GRID) * 2 - 1;
        if (u * u + v * v > 1) continue;
        const pLat = lat + v * dLat;
        const pLon = lon + u * dLon;
        total++;
        const hit = features.find((f) => inBbox(f.bbox, pLon, pLat) && f.polys.some((p) => inPolygon(p, pLon, pLat)));
        // Hors BD Forêt = pas de forêt cartographiée (champs, ville, eau…)
        const essence = normalizeEssence(hit?.props.essence);
        counts[essence] = (counts[essence] || 0) + 1;
        if (hit && essence !== 'Hors forêt') formations[hit.props.tfv] = (formations[hit.props.tfv] || 0) + 1;
      }
    }

    const shares = Object.fromEntries(
      Object.entries(counts)
        .map(([k, n]) => [k, n / total])
        .sort((a, b) => b[1] - a[1]),
    );
    const topFormations = Object.entries(formations)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, n]) => ({ name, share: n / total }));
    const forestShare = 1 - (shares['Hors forêt'] || 0);
    return { radiusKm, shares, forestShare, topFormations, source: 'IGN BD Forêt V2' };
  });
}

const PAGE = 5000;

/**
 * Polygones BD Forêt V2 d'une emprise [sud, ouest, nord, est], en pages de 5000.
 * Au-delà de `max` polygones on s'arrête et on signale la troncature.
 */
export async function fetchForestFeatures(bbox, { max = PAGE, onTruncated } = {}) {
  const out = [];
  for (let start = 0; start < max; start += PAGE) {
    const url = new URL(WFS);
    url.search = new URLSearchParams({
      SERVICE: 'WFS',
      VERSION: '2.0.0',
      REQUEST: 'GetFeature',
      TYPENAMES: LAYER,
      OUTPUTFORMAT: 'application/json',
      SRSNAME: 'EPSG:4326',
      COUNT: String(PAGE),
      STARTINDEX: String(start),
      SORTBY: 'id', // ordre stable entre les pages
      BBOX: `${bbox.join(',')},urn:ogc:def:crs:EPSG::4326`,
    });
    const fc = await getJson(url, { timeoutMs: 45_000 });
    out.push(...fc.features.filter((f) => f.geometry));
    if (fc.features.length < PAGE) return out;
  }
  onTruncated?.();
  return out;
}

// NC = non couvert (lande, clairière…), NR = non renseigné. On les garde distincts de « hors forêt ».
export function normalizeEssence(e) {
  if (!e) return 'Hors forêt';
  if (e === 'NC') return 'Lande / non boisé';
  if (e === 'NR') return 'Non renseigné';
  return e;
}

export function toPolygons(g) {
  if (g.type === 'Polygon') return [g.coordinates];
  if (g.type === 'MultiPolygon') return g.coordinates;
  return [];
}

function geomBbox(g) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const poly of toPolygons(g))
    for (const [x, y] of poly[0]) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  return [x0, y0, x1, y1];
}

const inBbox = ([x0, y0, x1, y1], x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

// Polygone GeoJSON : premier anneau = extérieur, suivants = trous.
export function inPolygon(rings, x, y) {
  if (!inRing(rings[0], x, y)) return false;
  for (let k = 1; k < rings.length; k++) if (inRing(rings[k], x, y)) return false;
  return true;
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
