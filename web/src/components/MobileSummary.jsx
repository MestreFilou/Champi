import { dayLabel, scoreColor, speciesColor } from '../format.js';
import { confidenceLabel, forecastDays } from './Forecast.jsx';

// Résumé visible même panneau réduit : le score du jour et le meilleur jour à venir.
export default function MobileSummary({ point, state, target, species, zones, speciesById }) {
  if (!point) return <p className="m-summary-hint">Cherche une forêt ou touche la carte pour analyser un secteur.</p>;
  if (state.error) return <p className="m-summary-hint error">Analyse impossible : {state.error}</p>;
  if (target === 'all') return <TopSpecies zones={zones} state={state} speciesById={speciesById} />;
  const result = state.data?.results.find((r) => r.id === target);
  if (!result) return <p className="m-summary-hint">Analyse du secteur…</p>;

  const { best } = forecastDays(result, state.data.weather.days);
  const score = result.today.score;
  return (
    <div className={state.loading ? 'm-summary is-loading' : 'm-summary'}>
      <div className="gauge small" style={{ '--c': scoreColor(score), '--p': score }}>
        <span>{score}</span>
      </div>
      <div>
        <strong>{species?.name}</strong>
        <span className={`v-${result.verdict.level}`}>{result.verdict.label} aujourd’hui</span>
        {best.score >= 15 && (
          <small>
            Meilleur jour : <b>{best.confidence.lead === 0 ? 'aujourd’hui' : dayLabel(best.date)}</b> ({best.score}, {confidenceLabel(best.confidence.level)})
          </small>
        )}
      </div>
    </div>
  );
}

// Toutes les espèces : les trois plus probables dans la forêt (ou autour du point, en attendant les zones)
function TopSpecies({ zones, state, speciesById }) {
  const list = zones?.species?.filter((s) => s.best > 0).map((s) => ({ id: s.id, score: s.best }))
    ?? state.data?.results.map((r) => ({ id: r.id, score: r.today.score }));
  if (!list) return <p className="m-summary-hint">Analyse du secteur…</p>;
  return (
    <div className="m-top">
      <span className="muted small">Le plus probable aujourd’hui</span>
      <ol>
        {list.slice(0, 3).map((s) => (
          <li key={s.id}>
            <i style={{ background: speciesColor(s.id) }} />
            {speciesById[s.id]?.name ?? s.id} <b>{s.score} %</b>
          </li>
        ))}
      </ol>
    </div>
  );
}
