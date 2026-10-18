import { useEffect, useState } from 'react';
import { downloadTiles, tilesFor, TILES_CACHE } from '../tiles.js';

const KEY = 'champi.horsligne';
const loadSaved = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
};

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

const mb = (bytes) => `${Math.round(bytes / 1e6)} Mo`;

// Préparer une sortie sans réseau : la carte de la zone affichée + l'analyse et les zones en cours.
export default function Offline({ map, label, prefetch }) {
  const [saved, setSaved] = useState(loadSaved);
  const [progress, setProgress] = useState(null);
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState(null);

  const refreshUsage = () => navigator.storage?.estimate?.().then(setUsage).catch(() => {});
  useEffect(() => {
    refreshUsage();
  }, []);

  const prepare = async () => {
    if (!map) return;
    setError(null);
    const b = map.getBounds();
    const bbox = { s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() };
    const { urls, zMax } = tilesFor(bbox, Math.max(10, map.getZoom() - 1));
    if (!urls.length) {
      setError('Zone trop grande : zoome sur le secteur de ta sortie, puis recommence.');
      return;
    }
    // Les navigateurs peuvent vider un cache « ordinaire » quand l'espace manque : on demande à le garder
    navigator.storage?.persist?.().catch(() => {});
    setProgress({ done: 0, total: urls.length });
    try {
      await prefetch(); // analyse, zones et parkings passent par le service worker, qui les garde
    } catch {
      /* données en ligne indisponibles : on enregistre au moins la carte */
    }
    const { failed } = await downloadTiles(urls, (done, total) => setProgress({ done, total }));
    const entry = { label: label || 'Zone sans nom', date: Date.now(), tiles: urls.length - failed, zMax };
    const next = [entry, ...saved].slice(0, 10);
    setSaved(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* pas bloquant */
    }
    setProgress(null);
    if (failed) setError(`${failed} tuiles n’ont pas pu être téléchargées (réseau ?).`);
    refreshUsage();
  };

  const clear = async () => {
    await caches.delete(TILES_CACHE);
    setSaved([]);
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* rien */
    }
    refreshUsage();
  };

  return (
    <section className="card">
      <h3>Hors ligne</h3>
      <p className="muted small">
        En forêt, le réseau manque souvent. Avant de partir, cadre la carte sur ton secteur et enregistre-le : la carte (jusqu’au zoom
        le plus détaillé possible), l’analyse, les zones et les parkings restent consultables sans réseau. Le GPS marche toujours sans réseau.
      </p>
      {progress ? (
        <div className="progress">
          <span style={{ width: `${(100 * progress.done) / progress.total}%` }} />
          <small>{progress.done} / {progress.total} tuiles</small>
        </div>
      ) : (
        <button className="primary" onClick={prepare} disabled={!map}>⤓ Enregistrer la zone affichée</button>
      )}
      {error && <p className="error small">{error}</p>}
      {saved.length > 0 && (
        <ul className="saved-zones">
          {saved.map((z) => (
            <li key={z.date}>
              <strong>{z.label}</strong>
              <small className="muted">
                {new Date(z.date).toLocaleDateString('fr-FR')} · {z.tiles} tuiles{z.zMax ? `, jusqu’au zoom ${z.zMax}` : ''}
              </small>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">
        {usage ? `Espace utilisé : ${mb(usage.usage)} sur ${mb(usage.quota)} disponibles.` : ''}{' '}
        {saved.length > 0 && <button className="link" onClick={clear}>Vider les cartes enregistrées</button>}
      </p>
    </section>
  );
}
