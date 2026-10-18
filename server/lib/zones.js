import { cached, DAY } from './cache.js';
import { fetchForestFeatures, normalizeEssence, toPolygons } from './forest.js';

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

// ~1,5 Ko par peuplement : 2000 peuplements restent sous la limite de 4,5 Mo des réponses Vercel.
export const MAX_ZONES = 2000;

export function zonesForSpecies(species, { stands, truncated }, max = MAX_ZONES) {
  let features = [];
  for (const st of stands) {
    const affinity = species.hosts[st.essence] ?? 0;
    const level = zoneLevel(affinity);
    if (!level) continue;
    features.push({
      type: 'Feature',
      properties: { essence: st.essence, tfv: st.tfv, affinity, level },
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
