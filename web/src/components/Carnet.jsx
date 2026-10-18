import { useEffect, useRef, useState } from 'react';
import { getPhoto } from '../photos.js';
import { MONTHS } from '../format.js';

// Onglet Carnet : mes coins, ce que j'y ai trouvé et quand.
export default function Carnet({ carnet, speciesById, onShowOnMap, onGuide, onAddEntry }) {
  const { spots } = carnet;
  const [message, setMessage] = useState(null);
  const fileInput = useRef(null);
  const entries = spots.flatMap((s) => s.entries.map((e) => ({ ...e, spot: s })));

  // Récoltes par espèce et par mois : c'est là que le carnet devient un calendrier personnel
  const bySpecies = {};
  for (const e of entries) {
    const key = e.species || 'inconnue';
    (bySpecies[key] ??= Array(12).fill(0))[new Date(e.t).getMonth()]++;
  }

  const exportFile = async () => {
    const text = await carnet.exportJson();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = `champi-carnet-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importFile = async (file) => {
    if (!file) return;
    try {
      const n = await carnet.importJson(await file.text());
      setMessage(n ? `${n} coin${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''}.` : 'Rien de nouveau dans ce fichier.');
    } catch (err) {
      setMessage(err.message);
    }
  };

  const sorted = [...spots].sort((a, b) => lastActivity(b) - lastActivity(a));

  return (
    <div className="sheets carnet">
      <div className="carnet-head">
        <h2>Mon carnet</h2>
        <div className="tracker-row">
          <button className="ghost" onClick={exportFile} disabled={!spots.length}>⤓ Sauvegarder</button>
          <button className="ghost" onClick={() => fileInput.current.click()}>⤒ Restaurer</button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => importFile(e.target.files[0])} />
        </div>
      </div>
      <p className="muted small">
        {spots.length} coin{spots.length > 1 ? 's' : ''} · {entries.length} récolte{entries.length > 1 ? 's' : ''}. Tout reste sur cet appareil :
        sauvegarde régulièrement pour ne rien perdre (ou pour passer sur un autre téléphone).
      </p>
      {message && <p className="hint">{message}</p>}

      {!spots.length && (
        <div className="empty">
          <p><strong>Aucun coin pour l’instant.</strong></p>
          <p className="muted">En sortie, touche « 📍 Marquer un coin » quand tu trouves quelque chose : la position est enregistrée et tu peux noter l’espèce, la quantité et prendre une photo.</p>
        </div>
      )}

      {Object.keys(bySpecies).length > 0 && (
        <section className="card">
          <h3>Mes saisons</h3>
          <table className="seasons">
            <thead>
              <tr>
                <th />
                {MONTHS.map((m, i) => <th key={i}>{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {Object.entries(bySpecies).map(([id, months]) => (
                <tr key={id}>
                  <td>{speciesById[id]?.name ?? 'Non identifié'}</td>
                  {months.map((n, i) => <td key={i} className={n ? 'on' : ''}>{n || ''}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="grid">
        {sorted.map((s) => (
          <SpotCard key={s.id} spot={s} carnet={carnet} speciesById={speciesById}
            onShowOnMap={onShowOnMap} onGuide={onGuide} onAddEntry={onAddEntry} />
        ))}
      </div>
    </div>
  );
}

const lastActivity = (s) => Math.max(s.t, ...s.entries.map((e) => e.t));

function SpotCard({ spot, carnet, speciesById, onShowOnMap, onGuide, onAddEntry }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <section className="card spot">
      <input
        id={`spot-name-${spot.id}`}
        className="spot-name"
        value={spot.name}
        onChange={(e) => carnet.renameSpot(spot.id, e.target.value)}
        aria-label="Nom du coin"
      />
      <p className="muted small">Marqué le {new Date(spot.t).toLocaleDateString('fr-FR')} · {spot.lat.toFixed(5)}, {spot.lon.toFixed(5)}</p>
      {spot.entries.length > 0 && (
        <ul className="entries">
          {[...spot.entries].reverse().map((e) => (
            <li key={e.id}>
              {e.photo && <Thumb id={e.photo} />}
              <div>
                <strong>{speciesById[e.species]?.name ?? 'Non identifié'}</strong>
                <small className="muted">{new Date(e.t).toLocaleDateString('fr-FR')}{e.qty && ` · ${e.qty}`}</small>
                {e.note && <small>{e.note}</small>}
              </div>
              <button className="link" onClick={() => carnet.removeEntry(spot.id, e.id)} aria-label="Supprimer cette récolte">✕</button>
            </li>
          ))}
        </ul>
      )}
      <div className="tracker-row">
        <button className="primary" onClick={() => onAddEntry(spot.id)}>+ Récolte</button>
        <button className="ghost" onClick={() => onShowOnMap(spot)}>Carte</button>
        <button className="ghost" onClick={() => onGuide(spot)}>🧭 Y aller</button>
        {confirm
          ? <button className="ghost danger" onClick={() => carnet.removeSpot(spot.id)}>Confirmer la suppression</button>
          : <button className="ghost" onClick={() => setConfirm(true)}>Supprimer</button>}
      </div>
    </section>
  );
}

function Thumb({ id }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let u;
    getPhoto(id).then((blob) => blob && setUrl((u = URL.createObjectURL(blob)))).catch(() => {});
    return () => u && URL.revokeObjectURL(u);
  }, [id]);
  return url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Photo de la récolte" /></a> : <span className="thumb-empty" />;
}
