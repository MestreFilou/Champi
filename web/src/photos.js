// Photos du carnet dans IndexedDB : trop lourdes pour localStorage (limité à ~5 Mo).

const DB = 'champi';
const STORE = 'photos';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const putPhoto = (id, blob) => run('readwrite', (s) => s.put(blob, id));
export const getPhoto = (id) => run('readonly', (s) => s.get(id));
export const deletePhoto = (id) => run('readwrite', (s) => s.delete(id));

// Réduit une photo d'appareil (souvent 4–12 Mo) à 1280 px de côté en JPEG : ~150 Ko.
export async function shrinkImage(file, max = 1280) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
}

export const blobToDataUrl = (blob) =>
  new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(blob);
  });

export const dataUrlToBlob = async (url) => (await fetch(url)).blob();
