import { useCallback, useEffect, useState } from 'react';

// « Mes forêts » : secteurs enregistrés (forêt choisie ou point analysé) pour y revenir d'un geste.
// Gardés dans le navigateur, comme le carnet.

const KEY = 'champi.forets';
const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
};

export const forestKey = (view) =>
  view.place?.id ?? (view.point ? `${view.point.lat.toFixed(3)},${view.point.lon.toFixed(3)}` : null);

export function useForests() {
  const [forests, setForests] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(forests));
    } catch {
      /* contour trop lourd ou stockage plein : on garde la liste en mémoire */
    }
  }, [forests]);

  // view : { place, point, radius, zoneArea, selection }
  const save = useCallback((view, name) => {
    const key = forestKey(view);
    setForests((list) => [{ key, name, savedAt: Date.now(), ...view }, ...list.filter((f) => f.key !== key)]);
  }, []);

  const remove = useCallback((key) => setForests((list) => list.filter((f) => f.key !== key)), []);
  const rename = useCallback((key, name) => setForests((list) => list.map((f) => (f.key === key ? { ...f, name } : f))), []);

  return { forests, save, remove, rename };
}
