import { useState } from 'react';

// Observations récentes iNaturalist autour du point, avec les commentaires des observateurs.
export default function Observations({ data, species }) {
  const [onlyComments, setOnlyComments] = useState(false);
  if (!data) return null;

  const items = (data.items || []).filter((o) => !onlyComments || o.description || o.comments.length);

  return (
    <section className="card">
      <h3>Observations récentes · {species?.name}</h3>
      {data.loading && <p className="muted">Recherche sur iNaturalist…</p>}
      {data.error && <p className="error small">{data.error}</p>}
      {data.items && (
        <>
          <p className="muted small">
            {data.total} observation{data.total > 1 ? 's' : ''} à moins de {data.radiusKm} km (points violets sur la carte).
          </p>
          <label className="check">
            <input type="checkbox" checked={onlyComments} onChange={(e) => setOnlyComments(e.target.checked)} /> seulement celles avec commentaires
          </label>
          <ul className="obs">
            {items.slice(0, 15).map((o) => (
              <li key={o.id}>
                {o.photo && <img src={o.photo} alt="" loading="lazy" />}
                <div>
                  <a href={o.url} target="_blank" rel="noreferrer">
                    <strong>{o.date}</strong> · {o.place || 'lieu masqué'}
                  </a>
                  <small className="muted">
                    {o.user} · {o.quality === 'research' ? 'identification validée' : 'à confirmer'}
                  </small>
                  {o.description && <p className="obs-text">« {o.description} »</p>}
                  {o.comments.map((c, i) => (
                    <p key={i} className="obs-comment">
                      <b>{c.user}</b> : {c.body}
                    </p>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          {items.length === 0 && <p className="muted">Rien à afficher.</p>}
        </>
      )}
    </section>
  );
}
