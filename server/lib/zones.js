import { cached, DAY } from './cache.js';
import { fetchForestFeatures, normalizeEssence, toPolygons } from './forest.js';
import { aspectLabel, getSlopes, reliefBonus } from './relief.js';

// Au-delà, trop de polygones pour une carte lisible (et pour l'IGN) : on demande de zoomer.
export const MAX_SPAN_DEG = 0.4; // ≈ 44 km nord-sud
const MAX_FEATURES = 20_000;

/**
 * Peuplements BD Forêt d'une emprise [sud, ouest, nord, est], allégés pour l'affichage.
 * Indépendant de l'espèce et de la météo : mis en cache une fois, puis noté par scoreZones.
 */
export function getStands(bbox) {
  const [s, w, n, e] = bbox;
  if (!(n > s && e > w)) throw Object.assign(new Error('Emprise invalide.'), { status: 400 });
  if (n - s > MAX_SPAN_DEG || e - w > MAX_SPAN_DEG) {
    throw Object.assign(new Error('Zone trop grande pour afficher les peuplements : zoome sur une partie de la forêt.'), { status: 400 });
  }
  const key = `stands:${bbox.map((x) => x.toFixed(3)).join(',')}`;
  return cached(key, 7 * DAY, async () => {
    let truncated = false;
    const features = await fetchForestFeatures(bbox, { max: MAX_FEATURES, onTruncated: () => (truncated = true) });
    const stands = features
      .map((f) => ({
        essence: normalizeEssence(f.properties.essence),
        tfv: f.properties.tfv,
        coordinates: lighten(toPolygons(f.geometry)),
      }))
      .filter((st) => st.coordinates.length)
      .map((st) => ({ ...st, area: areaHa(st.coordinates) }));
    await addRelief(stands);
    return { stands, truncated };
  });
}

// Pente et exposition au centre de chaque peuplement boisé (3 altitudes IGN par peuplement).
// Si l'altimétrie ne répond pas, les zones restent utilisables sans relief.
async function addRelief(stands) {
  const wooded = stands.filter((st) => !NOT_WOODED.has(st.essence));
  try {
    const slopes = await getSlopes(wooded.map((st) => ringCenter(st.coordinates[0][0])));
    wooded.forEach((st, i) => (st.relief = slopes[i]));
  } catch (err) {
    console.error('Altimétrie IGN indisponible :', err.message);
  }
}
const NOT_WOODED = new Set(['Lande / non boisé', 'Non renseigné', 'Hors forêt']);

function ringCenter(ring) {
  const n = ring.length - 1 || 1;
  let x = 0;
  let y = 0;
  for (let i = 0; i < n; i++) {
    x += ring[i][0];
    y += ring[i][1];
  }
  return [x / n, y / n];
}

// ~1,3 Ko par peuplement : 2000 peuplements restent bien sous la limite de 4,5 Mo des réponses Vercel.
export const MAX_ZONES = 2000;

/**
 * Adéquation d'un peuplement pour une espèce, entre 0 et 1 : arbres hôtes, ajustés par le versant
 * (jusqu'à ±30 % selon `prefer`, venu de la météo) et par le sol du secteur.
 */
export function standFit(species, stand, prefer, soilValue = 1) {
  const host = species.hosts[stand.essence] ?? 0;
  if (!host) return 0;
  // Zone morte : une exposition à peine marquée ne doit pas faire bouger la note
  const raw = reliefBonus(prefer, stand.relief);
  const bonus = Math.abs(raw) < 0.25 ? 0 : raw;
  return Math.min(1, host * (1 + 0.3 * bonus)) * soilValue;
}

/**
 * Note de chaque espèce dans chaque peuplement, sur 100 : la note météo du jour de l'espèce
 * (identique sur toute la forêt) × l'adéquation du peuplement. `ctx` donne, par espèce :
 * { species, weatherScore (note avec des arbres et un sol parfaits), prefer, soilValue }.
 * Renvoie les peuplements avec leurs notes, et un résumé par espèce pour toute la zone.
 */
export function scoreZones({ stands, truncated }, ctx, { max = MAX_ZONES } = {}) {
  const woodedHa = stands.filter((st) => !NOT_WOODED.has(st.essence)).reduce((sum, st) => sum + st.area, 0) || 1;
  const summary = Object.fromEntries(ctx.map((c) => [c.species.id, { scored: [], favorableHa: 0 }]));
  let features = [];
  for (const st of stands) {
    const scores = {};
    let top = null;
    for (const c of ctx) {
      const fit = standFit(c.species, st, c.prefer, c.soilValue);
      if (!fit) continue;
      const score = Math.round(c.weatherScore * fit);
      const sum = summary[c.species.id];
      if (fit >= 0.6) sum.favorableHa += st.area;
      if (score <= 0) continue;
      sum.scored.push([score, st.area]);
      scores[c.species.id] = score;
      if (!top || score > scores[top]) top = c.species.id;
    }
    if (!top) continue;
    features.push({
      type: 'Feature',
      properties: {
        essence: st.essence,
        tfv: st.tfv,
        area: Math.round(st.area * 10) / 10,
        ...(st.relief && { slope: st.relief.slope, aspect: aspectLabel(st.relief.aspect), elevation: st.relief.elevation }),
        scores,
        top,
      },
      geometry: { type: 'MultiPolygon', coordinates: st.coordinates },
    });
  }
  if (features.length > max) {
    // Trop de peuplements : on garde ceux qui ont la meilleure note
    features = features.sort((a, b) => b.properties.scores[b.properties.top] - a.properties.scores[a.properties.top]).slice(0, max);
    truncated = true;
  }
  const species = ctx
    .map((c) => ({
      id: c.species.id,
      best: bestOver(summary[c.species.id].scored, Math.min(MIN_HA, woodedHa)),
      favorableShare: Math.round((100 * summary[c.species.id].favorableHa) / woodedHa) / 100,
      weatherScore: Math.round(c.weatherScore),
      prefer: c.prefer,
      reason: c.reason,
    }))
    .sort((a, b) => b.best - a.best);
  return { type: 'FeatureCollection', features, truncated, species };
}

/**
 * Note de l'espèce « dans ses meilleurs coins » : la note atteinte sur au moins `minHa` hectares cumulés.
 * Une seule petite clairière favorable ne doit pas suffire à placer une espèce en tête de la forêt.
 */
export const MIN_HA = 10;
export function bestOver(scored, minHa) {
  let area = 0;
  for (const [score, ha] of [...scored].sort((a, b) => b[0] - a[0])) {
    area += ha;
    if (area >= minHa) return score;
  }
  return 0;
}

// Surface en hectares (anneaux extérieurs moins les trous), en projetant localement les degrés en mètres
function areaHa(polys) {
  let m2 = 0;
  for (const rings of polys)
    rings.forEach((ring, k) => {
      const lat0 = (ring[0][1] * Math.PI) / 180;
      const kx = 111_320 * Math.cos(lat0);
      let a = 0;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] * kx) * (ring[i][1] * 111_320) - (ring[i][0] * kx) * (ring[j][1] * 111_320);
      m2 += (k === 0 ? 1 : -1) * Math.abs(a / 2);
    });
  return m2 / 10_000;
}

// Décime chaque anneau à ~50 sommets et arrondit à 5 décimales (≈ 1 m) : divise le poids par 10 environ.
function lighten(polys, maxPts = 50) {
  const r5 = (x) => Math.round(x * 1e5) / 1e5;
  return polys
    .map((rings) =>
      rings
        .map((ring) => {
          const step = Math.max(1, Math.ceil(ring.length / maxPts));
          const out = ring.filter((_, i) => i % step === 0).map(([x, y]) => [r5(x), r5(y)]);
          if (out.length < 3) return null;
          out.push(out[0]);
          return out;
        })
        .filter(Boolean),
    )
    .filter((rings) => rings.length);
}
