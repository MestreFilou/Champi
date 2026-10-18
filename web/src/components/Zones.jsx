import { dayLabel, pct, speciesColor, zoneLevel } from '../format.js';
import { forecastDays } from './Forecast.jsx';

// Une espèce seule : trois niveaux selon la note du peuplement
export const ZONE_STYLE = {
  fort: { color: '#15803d', fillOpacity: 0.55, label: 'Très favorable (60 et plus)' },
  moyen: { color: '#84cc16', fillOpacity: 0.45, label: 'Favorable (35 à 59)' },
  faible: { color: '#f59e0b', fillOpacity: 0.35, label: 'Possible (10 à 34)' },
};
export const MAX_SELECTION = 5; // au-delà, les couleurs ne se distinguent plus sur la carte

/**
 * Ce qui pousse dans la forêt choisie, et le choix des espèces affichées sur la carte :
 * aucune cochée = toutes (une seule couleur, plus foncée là où c'est le plus probable),
 * une = ses trois niveaux, plusieurs = une couleur par espèce.
 */
export default function Zones({ state, selection, onToggle, onClear, speciesById, area, results, days, show, onShow }) {
  const data = state.data;
  const title = area?.label ? `dans ${area.label}` : 'autour du point';
  const valid = data && Array.isArray(data.species) && Array.isArray(data.features);
  const one = selection.length === 1 ? selection[0] : null;
  const summary = valid && one ? data.species.find((s) => s.id === one) : null;

  return (
    <section className="card">
      <div className="zones-head">
        <h3>Ce qui pousse {title}</h3>
        {selection.length > 0 && <button className="link" onClick={onClear}>Toutes les espèces</button>}
      </div>
      <label className="check">
        <input id="zones-show" type="checkbox" checked={show} onChange={(e) => onShow(e.target.checked)} /> afficher sur la carte
      </label>
      {state.loading && <p className="muted small">Lecture des peuplements forestiers et du relief…</p>}
      {state.error && <p className="error small">{state.error}</p>}
      {data && !valid && <p className="error small">Données de zones dans un ancien format : recharge la page.</p>}

      {valid && (
        <>
          <p className="muted small">
            {selection.length === 0
              ? 'Coche une ou plusieurs espèces pour les voir séparément sur la carte.'
              : selection.length >= MAX_SELECTION
                ? `${MAX_SELECTION} espèces au plus, pour garder des couleurs lisibles.`
                : 'Touche une espèce pour l’ajouter ou la retirer de la carte.'}
          </p>
          <ol className="forest-species">
            {data.species.filter((s) => s.best > 0).map((s) => {
              const on = selection.includes(s.id);
              const best = bestDay(results, s.id, days);
              return (
                <li key={s.id} className={on ? 'on' : ''}>
                  <button onClick={() => onToggle(s.id)} aria-pressed={on}>
                    <i className="tick" style={on ? { background: speciesColor(s.id), borderColor: speciesColor(s.id) } : undefined}>{on ? '✓' : ''}</i>
                    <span className="fs-name">
                      {speciesById[s.id]?.name ?? s.id}
                      <small>
                        {s.favorableShare >= 0.01 ? `${pct(s.favorableShare)} de la forêt lui convient` : 'moins de 1 % de la forêt lui convient'}
                        {best && ` · meilleur jour ${best}`}
                      </small>
                    </span>
                    <span className="rank-bar"><span style={{ width: `${s.best}%`, background: on ? speciesColor(s.id) : 'var(--good)' }} /></span>
                    <span className="rank-score">{s.best} %</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {summary?.prefer && <p className="hint">⛰ Pour {speciesById[one]?.name}, privilégie les <strong>versants {summary.prefer}</strong> : {summary.reason}.</p>}
          {one && (
            <p className="muted small">
              {data.features.filter((f) => zoneLevel(f.properties.scores[one] ?? 0) === 'fort').length} parcelles très favorables,{' '}
              {data.features.filter((f) => zoneLevel(f.properties.scores[one] ?? 0) === 'moyen').length} favorables. Sur le terrain, privilégie
              lisières, bords de chemins et vieux arbres.
            </p>
          )}
          <p className="muted small">
            Note du jour dans les meilleurs coins (au moins 10 ha) : météo × arbres × relief × sol. Touche une parcelle sur la carte pour voir ses notes.
          </p>
          {data.truncated && <p className="muted small">Forêt très étendue : seuls les peuplements les mieux notés sont affichés.</p>}
          {!data.features.length && <p className="muted">Aucun peuplement favorable cartographié ici.</p>}
        </>
      )}
    </section>
  );
}

function bestDay(results, id, days) {
  const r = results?.find((x) => x.id === id);
  if (!r) return null;
  const { best } = forecastDays(r, days);
  return best.confidence.lead === 0 ? 'aujourd’hui' : dayLabel(best.date);
}
