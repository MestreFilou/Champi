import { cached, DAY } from './cache.js';
import { getText } from './http.js';

const BRGM = 'https://geoservices.brgm.fr/geologie';

// Type de sol déduit de la roche : ce qui compte pour les champignons, c'est calcaire ou acide.
export function soilKind(descr = '') {
  const d = descr.toLowerCase();
  if (/calcaire|craie|marne|dolomi|gypse|travertin/.test(d)) return 'calcaire';
  if (/granit|gneiss|schiste|gr[èe]s|sable|quartz|rhyol|micaschiste|migmat|arkose|silex/.test(d)) return 'acide';
  if (/basalt|volcan|alluvion|argile|limon|lœss|loess|colluvion/.test(d)) return 'neutre';
  return null;
}

/**
 * Roche dominante sous un point d'après la carte lithologique simplifiée au 1/1 000 000 du BRGM.
 * Échelle grossière : une indication régionale, pas un relevé de terrain.
 */
export function getSoil(lat, lon) {
  return cached(`soil:${lat.toFixed(2)},${lon.toFixed(2)}`, 30 * DAY, async () => {
    const x = (lon * 20037508.34) / 180;
    const y = (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * 20037508.34) / Math.PI;
    const d = 500;
    const url = new URL(BRGM);
    url.search = new URLSearchParams({
      SERVICE: 'WMS',
      VERSION: '1.1.1',
      REQUEST: 'GetFeatureInfo',
      LAYERS: 'LITHO_1M_SIMPLIFIEE',
      QUERY_LAYERS: 'LITHO_1M_SIMPLIFIEE',
      INFO_FORMAT: 'text/plain',
      SRS: 'EPSG:3857',
      BBOX: [x - d, y - d, x + d, y + d].join(','),
      WIDTH: '101',
      HEIGHT: '101',
      X: '50',
      Y: '50',
      FEATURE_COUNT: '1',
    });
    const text = await getText(url);
    const descr = text.match(/DESCR = '([^']*)'/)?.[1] ?? null;
    return { descr, kind: soilKind(descr ?? ''), source: 'BRGM, carte lithologique 1/1 000 000' };
  });
}
