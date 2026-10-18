import { getJson } from './http.js';

const ALTI = 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json';
const BATCH = 1000; // l'API accepte 1000 points par requête POST en ~1,5 s
const STEP_M = 40; // écart des points pour calculer la pente

/** Altitudes (m) d'une liste de points [lon, lat], par lots, d'après le RGE ALTI de l'IGN. */
export async function getElevations(points) {
  const batches = [];
  for (let i = 0; i < points.length; i += BATCH) batches.push(points.slice(i, i + BATCH));
  const out = [];
  // 3 lots à la fois pour ménager le service
  for (let i = 0; i < batches.length; i += 3) {
    const res = await Promise.all(
      batches.slice(i, i + 3).map((b) =>
        getJson(ALTI, {
          method: 'POST',
          timeoutMs: 40_000,
          body: {
            lon: b.map((p) => p[0].toFixed(6)).join('|'),
            lat: b.map((p) => p[1].toFixed(6)).join('|'),
            resource: 'ign_rge_alti_wld',
            delimiter: '|',
            zonly: 'true',
          },
        }),
      ),
    );
    for (const r of res) out.push(...r.elevations);
  }
  // -99999 = hors couverture
  return out.map((z) => (z > -1000 ? z : null));
}

/**
 * Pente (°) et exposition (°, 0 = versant tourné vers le nord) en chaque point, à partir de
 * trois altitudes : le point, 40 m à l'est, 40 m au nord.
 */
export async function getSlopes(centers) {
  const pts = [];
  for (const [lon, lat] of centers) {
    const dLon = STEP_M / (111_320 * Math.cos((lat * Math.PI) / 180));
    const dLat = STEP_M / 111_320;
    pts.push([lon, lat], [lon + dLon, lat], [lon, lat + dLat]);
  }
  const z = await getElevations(pts);
  return centers.map((_, i) => slopeFrom(z[3 * i], z[3 * i + 1], z[3 * i + 2]));
}

export function slopeFrom(z0, zEast, zNorth) {
  if (z0 == null || zEast == null || zNorth == null) return null;
  const dzdx = (zEast - z0) / STEP_M;
  const dzdy = (zNorth - z0) / STEP_M;
  const slope = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
  // Le versant « regarde » vers la descente, c'est-à-dire à l'opposé du gradient
  const aspect = ((Math.atan2(-dzdx, -dzdy) * 180) / Math.PI + 360) % 360;
  return { slope: Math.round(slope * 10) / 10, aspect: Math.round(aspect), elevation: Math.round(z0) };
}

const DIRS = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'];
export const aspectLabel = (deg) => DIRS[Math.round(deg / 45) % 8];

/**
 * Quel versant chercher selon la météo du moment :
 * chaleur ou sécheresse → versants nord, plus frais et humides ; froid → versants sud, plus chauds.
 */
export function reliefPreference(species, factors) {
  const [, lo, hi] = species.temp;
  const t = factors.temp.tWeek;
  if (t != null && t > hi) return { prefer: 'nord', reason: `il fait chaud pour l’espèce (${t} °C)` };
  if (factors.moisture.value < 0.45) return { prefer: 'nord', reason: 'le sol est sec' };
  if (t != null && t < lo) return { prefer: 'sud', reason: `il fait frais pour l’espèce (${t} °C)` };
  return { prefer: null, reason: 'conditions équilibrées : l’exposition compte peu' };
}

/** Bonus entre -1 et 1 pour un versant : nul sur le plat (< 3°), plein à partir de 12°. */
export function reliefBonus(prefer, relief) {
  if (!prefer || !relief || relief.slope < 3) return 0;
  const target = prefer === 'nord' ? 0 : 180;
  const strength = Math.min(1, (relief.slope - 3) / 9);
  return Math.cos(((relief.aspect - target) * Math.PI) / 180) * strength;
}
