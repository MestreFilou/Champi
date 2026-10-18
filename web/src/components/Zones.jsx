import { dayLabel, pct, speciesColor, zoneLevel } from '../format.js';
import { forecastDays } from './Forecast.jsx';

// Espèce isolée : trois niveaux selon la note du peuplement
export const ZONE_STYLE = {
  fort: { color: '#15803d', fillOpacity: 0.5, label: 'Très favorable (60 et plus)' },
  moyen: { color: '#65a30d', fillOpacity: 0.35, label: 'Favorable (35 à 59)' },
  faible: { color: '#d97706', fillOpacity: 0.25, label: 'Possible (10 à 34)' },
};

/**
 * Ce qui pousse dans la forêt choisie.
 * - Toutes les espèces : la liste avec la note de chacune dans ses meilleurs coins ; la carte colore
 *   chaque peuplement de la couleur de son espèce la plus probable.
 * - Une espèce isolée : la carte ne montre qu'elle, en trois niveaux.
 */
export default function Zones({ state, focus, onFocus, speciesById, area, results, days, show, onToggle }) {
  const data = state.data;
  const title = area?.label ? `dans ${area.label}` : 'autour du point';
  const summary = data?.species.find((s) => s.id === focus);

  return (
    <section className="card">
      {focus === 'all' ? <h3>Ce qui pousse {title}</h3> : (
        <div className="zones-head">
          <h3>{speciesById[focus]?.name} {title}</h3>
          <button className="link" onClick={() => onFocus('all')}>← Toutes les espèces</button>
        </div>
      )}
      <label className="check">
        <input id="zones-show" type="checkbox" checked={show} onChange={(e) => onToggle(e.target.checked)} /> afficher sur la carte
      </label>
      {state.loading && <p className="muted small">Lecture des peuplements forestiers et du relief…</p>}
      {state.error && <p className="error small">{state.error}</p>}

      {data && focus === 'all' && (
        <>
          <ol className="forest-species">
            {data.species.filter((s) => s.best > 0).map((s) => {
              const best = bestDay(results, s.id, days);
              return (
                <li key={s.id}>
                  <button onClick={() => onFocus(s.id)}>
                    <i style={{ background: speciesColor(s.id) }} />
                    <span className="fs-name">
                      {speciesById[s.id]?.name ?? s.id}
                      <small>
                        {s.favorableShare >= 0.01 ? `${pct(s.favorableShare)} de la forêt lui convient` : 'moins de 1 % de la forêt lui convient'}
                        {best && ` · meilleur jour ${best}`}
                      </small>
                    </span>
                    <span className="rank-bar"><span style={{ width: `${s.best}%`, background: speciesColor(s.id) }} /></span>
                    <span className="rank-score">{s.best} %</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="muted small">
            Note du jour dans les meilleurs coins de la forêt : météo × arbres × relief × sol. Sur la carte, chaque parcelle prend la
            couleur de l’espèce la plus probable ; touche une parcelle pour voir toutes ses notes, ou une espèce pour l’isoler.
          </p>
        </>
      )}

      {data && focus !== 'all' && (
        <>
          <p className="forecast-best">
            Jusqu’à <strong>{summary?.best ?? 0} %</strong> dans les meilleurs coins
            {summary && summary.favorableShare >= 0.01 && ` · ${pct(summary.favorableShare)} de la forêt lui convient`}
          </p>
          {summary?.prefer && <p className="hint">⛰ Privilégie les <strong>versants {summary.prefer}</strong> : {summary.reason}.</p>}
          <ul className="legend">
            {Object.entries(ZONE_STYLE).map(([level, s]) => (
              <li key={level}>
                <i style={{ background: s.color, opacity: 0.4 + s.fillOpacity }} />
                {s.label} <span className="muted">{data.features.filter((f) => zoneLevel(f.properties.scores[focus] ?? 0) === level).length}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">Sur le terrain, privilégie lisières, bords de chemins et vieux arbres dans ces zones.</p>
        </>
      )}

      {data?.truncated && <p className="muted small">Forêt très étendue : seuls les peuplements les mieux notés sont affichés.</p>}
      {data && !data.features.length && <p className="muted">Aucun peuplement favorable cartographié ici.</p>}
    </section>
  );
}

function bestDay(results, id, days) {
  const r = results?.find((x) => x.id === id);
  if (!r) return null;
  const { best } = forecastDays(r, days);
  return best.confidence.lead === 0 ? 'aujourd’hui' : dayLabel(best.date);
}
