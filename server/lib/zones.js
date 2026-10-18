import { cached, DAY } from './cache.js';
import { fetchForestFeatures, normalizeEssence, toPolygons } from './forest.js';
import { aspectLabel, getSlopes, reliefBonus } from './relief.js';

// Au-delà, trop de polygones pour une carte lisible (et pour l'IGN) : on demande de zoomer.
export const MAX_SPAN_DEG = 0.4; // ≈ 44 km nord-sud
const MAX_FEATURES = 20_000;

/**
 * Peuplements BD Forêt d'une emprise [sud, ouest, nord, est], allégés pour l'affichage.
 * Indépendant de l'espèce : mis en cache une fois, puis filtré par zonesForSpecies.
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
      .filter((st) => st.coordinates.length);
    await addRelief(stands);
    return { stands, truncated };
  });
}

// Affinité de l'espèce pour l'essence de chaque peuplement → trois niveaux de probabilité.
export function zoneLevel(affinity) {
  if (affinity >= 0.85) return 'fort';
  if (affinity >= 0.6) return 'moyen';
  if (affinity > 0) return 'faible';
  return null;
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

// ~1,5 Ko par peuplement : 2000 peuplements restent sous la limite de 4,5 Mo des réponses Vercel.
export const MAX_ZONES = 2000;

/**
 * Peuplements favorables à une espèce. `prefer` ('nord' | 'sud' | null) vient de la météo du moment :
 * un bon versant fait monter l'affinité jusqu'à +30 %, un mauvais la fait baisser d'autant.
 */
export function zonesForSpecies(species, { stands, truncated }, { max = MAX_ZONES, prefer = null } = {}) {
  let features = [];
  for (const st of stands) {
    const host = species.hosts[st.essence] ?? 0;
    if (!host) continue;
    // Zone morte : une exposition à peine marquée ne doit pas faire basculer un peuplement de niveau
    const raw = reliefBonus(prefer, st.relief);
    const bonus = Math.abs(raw) < 0.25 ? 0 : raw;
    const affinity = Math.round(Math.min(1, host * (1 + 0.3 * bonus)) * 100) / 100;
    const level = zoneLevel(affinity);
    if (!level) continue;
    features.push({
      type: 'Feature',
      properties: {
        essence: st.essence,
        tfv: st.tfv,
        affinity,
        level,
        ...(st.relief && { slope: st.relief.slope, aspect: aspectLabel(st.relief.aspect), elevation: st.relief.elevation }),
        relief: bonus > 0 ? 'bon versant' : bonus < 0 ? 'versant défavorable' : null,
      },
      geometry: { type: 'MultiPolygon', coordinates: st.coordinates },
    });
  }
  if (features.length > max) {
    // Trop de peuplements : on garde les plus favorables
    features = features.sort((a, b) => b.properties.affinity - a.properties.affinity).slice(0, max);
    truncated = true;
  }
  return { type: 'FeatureCollection', features, truncated };
}

// Décime chaque anneau à ~80 sommets et arrondit à 5 décimales (≈ 1 m) : divise le poids par 10 environ.
function lighten(polys, maxPts = 80) {
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
