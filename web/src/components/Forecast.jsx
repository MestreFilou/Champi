import { dayLabel, scoreColor } from '../format.js';

// weight : un score lointain doit battre nettement un score proche et sûr pour être « le meilleur jour ».
const CONFIDENCE = {
  haute: { label: 'fiable', weight: 1 },
  bonne: { label: 'assez sûr', weight: 0.93 },
  moyenne: { label: 'incertain', weight: 0.8 },
  faible: { label: 'tendance', weight: 0.65 },
};

// Prévision jour par jour pour l'espèce visée, avec le meilleur jour mis en avant.
export default function Forecast({ result, days }) {
  const weatherByDate = Object.fromEntries(days.map((d) => [d.date, d]));
  const rows = [
    { date: result.today.date, score: result.today.score, confidence: { lead: 0, level: 'haute' } },
    ...result.forecast,
  ].map((r) => ({ ...r, wx: weatherByDate[r.date] }));

  const weighted = (r) => r.score * CONFIDENCE[r.confidence.level].weight;
  const best = rows.reduce((a, b) => (weighted(b) > weighted(a) ? b : a));
  // Plus loin et moins sûr, mais nettement plus haut : on le signale comme tendance.
  const later = rows.filter((r) => r.date > best.date);
  const trend = later.length ? later.reduce((a, b) => (b.score > a.score ? b : a)) : null;

  return (
    <section className="card">
      <h3>Prévisions sur {rows.length} jours</h3>
      <p className="forecast-best">
        {best.score >= 15 ? (
          <>
            Meilleur jour : <strong>{best.confidence.lead === 0 ? 'aujourd’hui' : dayLabel(best.date)}</strong> ({best.score}/100,{' '}
            {CONFIDENCE[best.confidence.level].label})
          </>
        ) : (
          <>Rien de bon dans les deux semaines à venir.</>
        )}
        {trend && trend.score >= best.score + 8 && (
          <span className="muted"> · hausse possible vers le {dayLabel(trend.date)} ({trend.score}/100, {CONFIDENCE[trend.confidence.level].label})</span>
        )}
      </p>
      {best.wx?.rain >= 10 && <p className="muted small">Il est annoncé {Math.round(best.wx.rain)} mm de pluie ce jour-là : prévois l’équipement.</p>}

      <ol className="forecast">
        {rows.map((r) => (
          <li key={r.date} className={`${r === best ? 'best' : ''} conf-${r.confidence.level}`}>
            <span className="fc-day">{r.confidence.lead === 0 ? 'Auj.' : dayLabel(r.date)}</span>
            <span className="rank-bar">
              <span style={{ width: `${r.score}%`, background: scoreColor(r.score) }} />
            </span>
            <span className="rank-score">{r.score}</span>
            <span className="fc-wx" title={r.wx?.rainProb != null ? `Risque de pluie : ${r.wx.rainProb} %` : undefined}>
              {r.wx && `${r.wx.rain >= 0.5 ? `${Math.round(r.wx.rain)} mm` : '—'} · ${Math.round(r.wx.tmin)}/${Math.round(r.wx.tmax)}°`}
            </span>
            <span className="fc-conf" title={confidenceHelp(r.confidence)}>{CONFIDENCE[r.confidence.level].label}</span>
          </li>
        ))}
      </ol>
      <p className="muted small">
        La fiabilité baisse avec l’échéance, mais remonte quand la pluie qui fait pousser l’espèce est déjà tombée : ce score-là repose sur des mesures, pas sur une prévision.
      </p>
    </section>
  );
}

function confidenceHelp({ lead, observed }) {
  if (!lead) return 'Aujourd’hui';
  const part = observed != null ? ` · ${Math.round(observed * 100)} % de la pluie déclenchante déjà mesurée` : '';
  return `Prévision à J+${lead}${part}`;
}
