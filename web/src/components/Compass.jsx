import { bearing, compass, distance, formatDistance } from '../geo.js';
import { useHeading } from '../useHeading.js';

// Flèche vers la cible (voiture ou coin). Avec la boussole du téléphone, elle pointe dans la vraie
// direction ; sans boussole, elle s'oriente comme une carte, nord en haut.
export default function Compass({ position, target, onClear }) {
  const { heading, needsPermission, request } = useHeading(!!(position && target));
  if (!position || !target) return null;

  const d = distance(position, target);
  const b = bearing(position, target);
  const rotation = heading == null ? b : b - heading;
  const arrived = d < Math.max(15, position.acc);

  return (
    <div className="compass">
      <svg viewBox="-20 -20 40 40" width="46" height="46" role="img" aria-label={`Direction : ${compass(b)}`}>
        <circle r="19" className="compass-ring" />
        {heading == null && <text y="-12" textAnchor="middle" className="compass-n">N</text>}
        <g transform={`rotate(${rotation})`}>
          <path d="M0 -14 L7 8 L0 4 L-7 8 Z" className={arrived ? 'compass-arrow arrived' : 'compass-arrow'} />
        </g>
      </svg>
      <div>
        <span>{target.label}</span>
        <b>{arrived ? 'Tu y es' : `${formatDistance(d)} · ${compass(b)}`}</b>
        {heading == null && !needsPermission && <small className="muted">nord en haut (pas de boussole)</small>}
        {needsPermission && <button className="link" onClick={request}>Activer la boussole</button>}
      </div>
      {onClear && <button className="link" onClick={onClear} aria-label="Arrêter le guidage">✕</button>}
    </div>
  );
}
