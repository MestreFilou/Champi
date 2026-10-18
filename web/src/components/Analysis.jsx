import { dayLabel, pct, scoreColor } from '../format.js';
import WeatherChart from './WeatherChart.jsx';
import Forecast from './Forecast.jsx';

export default function Analysis({ state, target, speciesById, onPickSpecies, onOpenSheet, children }) {
  if (state.error) return <p className="error">Analyse impossible : {state.error}</p>;
  if (!state.data) return <div className="card loading">Analyse du secteur…</div>;

  const { data, loading } = state;
  const result = data.results.find((r) => r.id === target);
  const sp = speciesById[target];

  return (
    <div className={loading ? 'analysis is-loading' : 'analysis'}>
      <p className="point-meta">
        {data.point.lat.toFixed(4)}, {data.point.lon.toFixed(4)} · {Math.round(data.point.elevation)} m
        {loading && ' · mise à jour…'}
      </p>

      {result && <TargetCard result={result} species={sp} onOpenSheet={onOpenSheet} />}
      {result && <Forecast result={result} days={data.weather.days} />}
      {children}

      <section className="card">
        <h3>Forêt autour du point</h3>
        <ForestComposition forest={data.forest} />
      </section>

      <section className="card">
        <h3>Météo (30 jours + prévisions)</h3>
        <WeatherChart days={data.weather.days} todayOffset={data.weather.todayOffset} />
      </section>

      <section className="card">
        <h3>Ce qui pousse le mieux ici</h3>
        <ol className="ranking">
          {data.results.map((r) => (
            <li key={r.id} className={r.id === target ? 'current' : ''}>
              <button onClick={() => onPickSpecies(r.id)}>
                <span className="rank-name">{speciesById[r.id]?.name ?? r.id}</span>
                <span className="rank-bar">
                  <span style={{ width: `${r.today.score}%`, background: scoreColor(r.today.score) }} />
                </span>
                <span className="rank-score">{r.today.score}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function TargetCard({ result, species, onOpenSheet }) {
  const { today, history, verdict, habitat } = result;
  const f = today.factors;
  const strip = [...history, { date: today.date, score: today.score, today: true }];

  return (
    <section className="card target">
      <div className="target-head">
        {species?.taxon?.photo && <img src={species.taxon.photo} alt="" className="target-photo" />}
        <div>
          <h2>{species?.name}</h2>
          <button className="link" onClick={() => onOpenSheet(result.id)}>Fiche d’identification →</button>
        </div>
        <div className="gauge" style={{ '--c': scoreColor(today.score), '--p': today.score }}>
          <span>{today.score}</span>
        </div>
      </div>
      <p className={`verdict v-${verdict.level}`}>{verdict.label} aujourd’hui</p>

      <div className="strip" title="14 jours passés · aujourd’hui">
        {strip.map((d) => (
          <div key={d.date} className={d.today ? 'strip-day today' : 'strip-day'} title={`${dayLabel(d.date)} : ${d.score}`}>
            <span className="strip-bar" style={{ height: `${Math.max(4, d.score)}%`, background: scoreColor(d.score) }} />
          </div>
        ))}
      </div>
      <div className="strip-legend">
        <span>il y a 2 sem.</span>
        <span>aujourd’hui</span>
      </div>

      <ul className="factors">
        <Factor v={f.rain.value} label="Pluie déclenchante">
          {f.rain.triggerRain} mm entre J-{f.rain.window[1]} et J-{f.rain.window[0]} (idéal ≥ {f.rain.needed} mm)
        </Factor>
        <Factor v={f.moisture.value} label="Humidité actuelle">
          sol {f.moisture.soil != null ? `${Math.round(f.moisture.soil * 100)} %` : 'n.c.'} · air {f.moisture.rh} % · {f.moisture.recentRain} mm sur 5 j
        </Factor>
        <Factor v={f.temp.value} label="Température">
          {f.temp.tWeek} °C de moyenne sur 7 j (idéal {f.temp.range[1]}–{f.temp.range[2]} °C)
        </Factor>
        {f.frost.value < 1 && <Factor v={f.frost.value} label="Gel récent">minimale {f.frost.tmin} °C</Factor>}
        {f.drought.value < 1 && <Factor v={f.drought.value} label="Sécheresse">aucune pluie ≥ 5 mm depuis 3 semaines</Factor>}
        <Factor v={f.season.value} label="Saison">{f.season.value === 1 ? 'en pleine saison' : f.season.value > 0.3 ? 'début ou fin de saison' : 'hors saison'}</Factor>
        <Factor v={habitat.value} label="Arbres hôtes">
          {habitat.matches.length
            ? habitat.matches.slice(0, 3).map((m) => `${m.essence} ${pct(m.share)}`).join(' · ')
            : 'aucun hôte favorable cartographié'}
        </Factor>
        {(f.soil?.descr || f.soil?.preferred) && (
          <Factor v={f.soil.value} label="Sol">
            {f.soil.descr ? `${f.soil.descr}${f.soil.kind ? ` (${f.soil.kind})` : ''}` : 'roche inconnue'}
            {f.soil.preferred ? ` · l’espèce préfère un sol ${f.soil.preferred}` : ' · indifférent pour cette espèce'}
          </Factor>
        )}
      </ul>
    </section>
  );
}

function Factor({ v, label, children }) {
  return (
    <li>
      <span className="factor-dot" style={{ background: scoreColor(v * 100) }} />
      <span>
        <strong>{label}</strong>
        <small>{children}</small>
      </span>
    </li>
  );
}

const ESSENCE_COLORS = {
  'Chênes décidus': '#8a5a2b', 'Chênes sempervirents': '#6b4423', Hêtre: '#b8860b', Châtaignier: '#a0522d',
  Robinier: '#c9b458', Peuplier: '#9acd32', Feuillus: '#6aa84f', Mixte: '#4f8a6b', Conifères: '#2f5d50',
  'Sapin, épicéa': '#1f4e3d', Douglas: '#2e6b5a', Mélèze: '#7fa36b', 'Lande / non boisé': '#d9c9a3',
  'Non renseigné': '#bbb', 'Hors forêt': '#e8e4dc',
};
const essenceColor = (e) => ESSENCE_COLORS[e] || (e.startsWith('Pin') ? '#3d7a5e' : '#999');

function ForestComposition({ forest }) {
  if (!forest) return <p className="muted">BD Forêt indisponible pour le moment.</p>;
  const entries = Object.entries(forest.shares).filter(([, s]) => s >= 0.01);
  return (
    <>
      <div className="stack">
        {entries.map(([e, s]) => (
          <span key={e} style={{ width: `${s * 100}%`, background: essenceColor(e) }} title={`${e} ${pct(s)}`} />
        ))}
      </div>
      <ul className="legend">
        {entries.map(([e, s]) => (
          <li key={e}>
            <i style={{ background: essenceColor(e) }} />
            {e} <span className="muted">{pct(s)}</span>
          </li>
        ))}
      </ul>
      <p className="muted small">
        Boisé à {pct(forest.forestShare)} dans un rayon de {forest.radiusKm} km · {forest.source}
      </p>
    </>
  );
}
