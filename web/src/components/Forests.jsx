import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { speciesColor } from '../format.js';

// Onglet « Mes forêts » : les secteurs enregistrés, avec ce qui y pousse aujourd'hui.
export default function Forests({ forests, speciesById, onOpen }) {
  return (
    <div className="sheets">
      <h2>Mes forêts</h2>
      {!forests.forests.length && (
        <div className="empty">
          <p><strong>Aucune forêt enregistrée.</strong></p>
          <p className="muted">Sur la carte, choisis une forêt puis touche « ☆ Enregistrer dans Mes forêts » : elle apparaîtra ici, avec ce qui y pousse chaque jour.</p>
        </div>
      )}
      <div className="grid">
        {forests.forests.map((f) => (
          <ForestCard key={f.key} forest={f} forests={forests} speciesById={speciesById} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function ForestCard({ forest, forests, speciesById, onOpen }) {
  const [today, setToday] = useState(null);
  const [confirm, setConfirm] = useState(false);

  // Aperçu rapide : l'analyse autour du centre (déjà en cache la plupart du temps)
  useEffect(() => {
    if (!forest.point) return;
    let stale = false;
    api
      .analyze(forest.point.lat, forest.point.lon, forest.radius ?? 1)
      .then((d) => !stale && setToday(d.results.slice(0, 3)))
      .catch(() => !stale && setToday([]));
    return () => {
      stale = true;
    };
  }, [forest.point, forest.radius]);

  return (
    <section className="card spot">
      <input
        id={`forest-name-${forest.key}`}
        className="spot-name"
        value={forest.name}
        onChange={(e) => forests.rename(forest.key, e.target.value)}
        aria-label="Nom de la forêt"
      />
      <p className="muted small">
        Enregistrée le {new Date(forest.savedAt).toLocaleDateString('fr-FR')}
        {forest.selection?.length ? ` · ${forest.selection.map((id) => speciesById[id]?.name ?? id).join(', ')}` : ''}
      </p>
      <div className="m-top">
        <span className="muted small">Aujourd’hui autour du centre</span>
        {today === null && <small className="muted">Chargement…</small>}
        {today?.length === 0 && <small className="muted">Indisponible (hors ligne ?)</small>}
        <ol>
          {today?.map((r) => (
            <li key={r.id}>
              <i style={{ background: speciesColor(r.id) }} />
              {speciesById[r.id]?.name ?? r.id} <b>{r.today.score} %</b>
            </li>
          ))}
        </ol>
      </div>
      <div className="tracker-row">
        <button className="primary" onClick={() => onOpen(forest)}>Ouvrir sur la carte</button>
        {confirm
          ? <button className="ghost danger" onClick={() => forests.remove(forest.key)}>Confirmer</button>
          : <button className="ghost" onClick={() => setConfirm(true)}>Retirer</button>}
      </div>
    </section>
  );
}
