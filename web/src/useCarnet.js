import { useCallback, useEffect, useState } from 'react';
import { blobToDataUrl, dataUrlToBlob, deletePhoto, getPhoto, putPhoto } from './photos.js';

// Carnet de coins : chaque coin garde ses récoltes (espèce, quantité, note, photo).
// Tout reste sur l'appareil ; l'export JSON sert de sauvegarde ou de transfert vers un autre téléphone.

const KEY = 'champi.coins'; // même clé que les coins marqués avant le carnet : rien n'est perdu

const load = () => {
  try {
    const list = JSON.parse(localStorage.getItem(KEY)) ?? [];
    return list.map((s) => ({ entries: [], ...s }));
  } catch {
    return [];
  }
};

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function useCarnet() {
  const [spots, setSpots] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(spots));
    } catch {
      /* stockage plein ou bloqué */
    }
  }, [spots]);

  const update = (id, fn) => setSpots((list) => list.map((s) => (s.id === id ? fn(s) : s)));

  const addSpot = useCallback((pos, name) => {
    const id = uid();
    setSpots((list) => [...list, { id, lat: pos.lat, lon: pos.lon, t: Date.now(), name: name || `Coin ${list.length + 1}`, entries: [] }]);
    return id;
  }, []);

  const renameSpot = useCallback((id, name) => update(id, (s) => ({ ...s, name })), []);

  const removeSpot = useCallback((id) => {
    setSpots((list) => {
      list.find((s) => s.id === id)?.entries.forEach((e) => e.photo && deletePhoto(e.photo).catch(() => {}));
      return list.filter((s) => s.id !== id);
    });
  }, []);

  const addEntry = useCallback(async (spotId, { species, qty, note, photoFile }) => {
    let photo = null;
    if (photoFile) {
      photo = uid();
      await putPhoto(photo, photoFile);
    }
    update(spotId, (s) => ({ ...s, entries: [...s.entries, { id: uid(), t: Date.now(), species, qty, note, photo }] }));
  }, []);

  const removeEntry = useCallback((spotId, entryId) => {
    update(spotId, (s) => {
      const e = s.entries.find((x) => x.id === entryId);
      if (e?.photo) deletePhoto(e.photo).catch(() => {});
      return { ...s, entries: s.entries.filter((x) => x.id !== entryId) };
    });
  }, []);

  // Sauvegarde complète, photos comprises (en data URL)
  const exportJson = useCallback(async () => {
    const photos = {};
    for (const s of spots)
      for (const e of s.entries)
        if (e.photo) {
          const blob = await getPhoto(e.photo).catch(() => null);
          if (blob) photos[e.photo] = await blobToDataUrl(blob);
        }
    return JSON.stringify({ app: 'champi', version: 1, exportedAt: new Date().toISOString(), spots, photos });
  }, [spots]);

  // Fusion : les coins déjà présents (même identifiant) ne sont pas dupliqués
  const importJson = useCallback(async (text) => {
    const data = JSON.parse(text);
    if (data.app !== 'champi' || !Array.isArray(data.spots)) throw new Error('Ce fichier n’est pas une sauvegarde Champi.');
    for (const [id, url] of Object.entries(data.photos ?? {})) await putPhoto(id, await dataUrlToBlob(url));
    const known = new Set(spots.map((s) => s.id));
    const fresh = data.spots.filter((s) => !known.has(s.id)).map((s) => ({ entries: [], ...s }));
    setSpots((list) => [...list, ...fresh.filter((s) => !list.some((x) => x.id === s.id))]);
    return fresh.length;
  }, [spots]);

  return { spots, addSpot, renameSpot, removeSpot, addEntry, removeEntry, exportJson, importJson };
}
