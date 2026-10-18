import { useEffect, useState } from 'react';
import { formatDistance, formatDuration, toGpx, trackLength } from '../geo.js';
import Compass from './Compass.jsx';

// Panneau flottant sur la carte : démarrer une sortie, suivre sa trace, retrouver le point de départ.
export default function TrackerPanel({ tracker, spots, guide, onClearGuide, onMarkSpot, follow, onFollow, onAnalyzeHere }) {
  const { sortie, position, error } = tracker;
  const [, tick] = useState(0);
  const active = sortie.status === 'recording' || sortie.status === 'paused';

  // Rafraîchit la durée affichée
  useEffect(() => {
    if (sortie.status !== 'recording') return;
    const id = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, [sortie.status]);

  // Cible de la boussole : le coin choisi, sinon le point de départ de la sortie (la voiture)
  const start = sortie.track[0];
  const target = guide ?? (start && sortie.status !== 'done' ? { ...start, label: 'Retour au départ' } : null);
  const elapsed = sortie.startedAt ? Math.max(0, (sortie.endedAt ?? Date.now()) - sortie.startedAt) : 0;

  const exportGpx = () => {
    const date = new Date(sortie.startedAt || Date.now());
    const name = `Sortie champignons ${date.toLocaleDateString('fr-FR')}`;
    const blob = new Blob([toGpx({ name, track: sortie.track, spots })], { type: 'application/gpx+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `champi-${date.toISOString().slice(0, 10)}.gpx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="tracker">
      {sortie.status === 'idle' && (
        <div className="tracker-row">
          <button className="primary" onClick={tracker.start}>▶ Démarrer une sortie</button>
          <button className="ghost" onClick={() => { tracker.locate(); onFollow(true); }}>◎ Me localiser</button>
        </div>
      )}

      {sortie.status !== 'idle' && (
        <>
          <div className="tracker-stats">
            <span><b>{formatDuration(elapsed)}</b> durée</span>
            <span><b>{formatDistance(trackLength(sortie.track))}</b> parcourus</span>
            {position && <span><b>±{position.acc} m</b> précision</span>}
          </div>
          {sortie.status === 'paused' && <p className="tracker-note">En pause : la trace ne s’enregistre pas.</p>}
        </>
      )}

      <Compass position={position} target={target} onClear={guide ? onClearGuide : null} />
      {guide && !position && <p className="tracker-note">Localisation en cours pour te guider vers {guide.label}…</p>}

      {active && (
        <div className="tracker-row">
          <button className="primary" onClick={() => onMarkSpot(position)} disabled={!position}>📍 Marquer un coin</button>
          <button className={follow ? 'ghost on' : 'ghost'} onClick={() => onFollow(!follow)}>◎ Suivre</button>
          {sortie.status === 'recording'
            ? <button className="ghost" onClick={tracker.pause}>⏸ Pause</button>
            : <button className="ghost" onClick={tracker.start}>▶ Reprendre</button>}
          <button className="ghost" onClick={tracker.stop}>■ Terminer</button>
        </div>
      )}

      {sortie.status === 'done' && (
        <div className="tracker-row">
          <button className="primary" onClick={exportGpx} disabled={sortie.track.length < 2}>⤓ Exporter en GPX</button>
          <button className="ghost" onClick={tracker.reset}>Nouvelle sortie</button>
        </div>
      )}

      {position && (
        <button className="link" onClick={() => onAnalyzeHere(position)}>Analyser le secteur où je suis →</button>
      )}
      {error && <p className="error small">{error}</p>}
      {sortie.status === 'recording' && (
        <p className="tracker-note">Écran verrouillé = GPS coupé : garde l’appli ouverte.</p>
      )}
    </div>
  );
}
