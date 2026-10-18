import { useEffect } from 'react';
import { edibility, MONTHS } from '../format.js';

const PARTS = [
  ['chapeau', 'Chapeau'],
  ['dessous', 'Sous le chapeau'],
  ['pied', 'Pied'],
  ['chair', 'Chair et odeur'],
  ['habitat', 'Habitat'],
];

export default function SpeciesDetail({ species: s, onClose, onSearch }) {
  const e = edibility(s.edibility);

  useEffect(() => {
    const onKey = (ev) => ev.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hosts = s.hosts
    ? Object.entries(s.hosts)
        .filter(([k, v]) => v >= 0.8 && !['Feuillus', 'Conifères', 'Mixte'].includes(k))
        .map(([k]) => k)
    : [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <article className={`modal tone-${e.tone}`} onClick={(ev) => ev.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
        <header className="detail-head">
          {s.taxon?.photo && (
            <figure>
              <img src={s.taxon.photo} alt={s.name} />
              <figcaption>{s.taxon.photoAttribution} · iNaturalist</figcaption>
            </figure>
          )}
          <div>
            <h2>{s.name}</h2>
            <p><em>{s.latin}</em> · {s.group}</p>
            <span className={`badge tone-${e.tone}`}>{e.label}</span>
            <div className="months big">
              {MONTHS.map((m, i) => (
                <span key={i} className={s.months.includes(i + 1) ? 'on' : ''}>{m}</span>
              ))}
            </div>
            {hosts.length > 0 && <p className="small"><strong>Arbres favoris :</strong> {hosts.join(', ')}</p>}
            {onSearch && <button className="primary" onClick={onSearch}>Chercher ce champignon sur la carte</button>}
          </div>
        </header>

        {s.warning && <p className="deadly-warning">☠️ {s.warning}</p>}

        <h3>Reconnaître</h3>
        <dl className="ident">
          {PARTS.filter(([k]) => s.identification?.[k]).map(([k, label]) => (
            <div key={k}>
              <dt>{label}</dt>
              <dd>{s.identification[k]}</dd>
            </div>
          ))}
        </dl>

        {s.confusions?.length > 0 && (
          <>
            <h3>Confusions possibles</h3>
            <ul className="confusions">
              {s.confusions.map((c) => (
                <li key={c.latin} className={/mortel|toxique/.test(c.danger) ? 'danger' : ''}>
                  <strong>{c.name}</strong> <em>{c.latin}</em> <span className="badge">{c.danger}</span>
                  <p>{c.diff}</p>
                </li>
              ))}
            </ul>
          </>
        )}

        {s.tips && (
          <>
            <h3>Conseils de cueillette</h3>
            <p>{s.tips}</p>
          </>
        )}

        <p className="muted small">
          {s.taxon?.url && <a href={s.taxon.url} target="_blank" rel="noreferrer">Fiche iNaturalist</a>}
          {s.taxon?.wikipedia && <> · <a href={s.taxon.wikipedia} target="_blank" rel="noreferrer">Wikipédia</a></>}
        </p>
      </article>
    </div>
  );
}
