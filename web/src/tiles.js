// Fonds de carte, et calcul des tuiles d'une zone pour les enregistrer à l'avance.

export const IGN_WMTS = (layer, format = 'image/png') =>
  `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=normal&TILEMATRIXSET=PM&FORMAT=${format}&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`;
export const PLAN_IGN = IGN_WMTS('GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2');
export const TILES_CACHE = 'champi-tiles'; // même nom que dans sw.js

const tileX = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const tileY = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

/**
 * Tuiles du Plan IGN couvrant une emprise, du zoom `zMin` jusqu'au zoom 17 au plus,
 * en s'arrêtant au dernier niveau complet qui tient sous `max` tuiles.
 */
export function tilesFor({ s, w, n, e }, zMin, max = 2500) {
  const urls = [];
  let zReached = null;
  for (let z = zMin; z <= 17; z++) {
    const [x0, x1, y0, y1] = [tileX(w, z), tileX(e, z), tileY(n, z), tileY(s, z)];
    const count = (x1 - x0 + 1) * (y1 - y0 + 1);
    if (urls.length + count > max) break;
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) urls.push(PLAN_IGN.replace('{z}', z).replace('{y}', y).replace('{x}', x));
    zReached = z;
  }
  return { urls, zMax: zReached };
}

// Téléchargement direct dans le cache des tuiles (6 en parallèle), sans dépendre du service worker
export async function downloadTiles(urls, onProgress) {
  const cache = await caches.open(TILES_CACHE);
  let done = 0;
  let failed = 0;
  const queue = [...urls];
  const worker = async () => {
    while (queue.length) {
      const url = queue.shift();
      try {
        if (!(await cache.match(url))) {
          const res = await fetch(url, { mode: 'cors' });
          if (!res.ok) throw new Error(res.status);
          await cache.put(url, res);
        }
      } catch {
        failed++;
      }
      onProgress(++done, urls.length);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return { failed };
}
