import { formatDistance } from '../geo.js';

// Liens d'itinéraire : ils ouvrent l'appli de navigation du téléphone.
export const gmapsUrl = (p) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
export const wazeUrl = (p) => `https://waze.com/ul?ll=${p.lat},${p.lon}&navigate=yes`;

export default function Access({ state }) {
  if (!state) return null;
  return (
    <section className="card">
      <h3>Se garer</h3>
      {state.loading && <p className="muted small">Recherche des parkings (OpenStreetMap, peut prendre 30 s)…</p>}
      {state.error && <p className="error small">{state.error}</p>}
      {state.items && !state.items.length && <p className="muted">Aucun parking public cartographié à moins de 3 km.</p>}
      {state.items?.length > 0 && (
        <ul className="parkings">
          {state.items.slice(0, 3).map((p) => (
            <li key={p.id}>
              <span>
                <strong>{p.name || 'Parking'}</strong>
                <small className="muted">à {formatDistance(p.distance)} du point</small>
              </span>
              <a className="ghost" href={gmapsUrl(p)} target="_blank" rel="noreferrer">Maps</a>
              <a className="ghost" href={wazeUrl(p)} target="_blank" rel="noreferrer">Waze</a>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">Parkings en bleu sur la carte. Note l’emplacement de ta voiture : le point de départ de la sortie sert au retour.</p>
    </section>
  );
}
