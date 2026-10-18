import { dayLabel } from '../format.js';

// Pluie en barres, températures min/max en courbes. Les jours de prévision sont grisés.
export default function WeatherChart({ days, todayOffset }) {
  const W = 340;
  const H = 150;
  const pad = { l: 26, r: 26, t: 10, b: 20 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const n = days.length;
  const bw = iw / n;

  const maxRain = Math.max(20, ...days.map((d) => d.rain));
  const temps = days.flatMap((d) => [d.tmin, d.tmax]).filter((v) => v != null);
  const tLo = Math.floor(Math.min(0, ...temps) / 5) * 5;
  const tHi = Math.ceil(Math.max(20, ...temps) / 5) * 5;
  const x = (i) => pad.l + i * bw + bw / 2;
  const yT = (t) => pad.t + ih - ((t - tLo) / (tHi - tLo)) * ih;
  const yR = (r) => (r / maxRain) * ih;
  const line = (key) => days.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yT(d[key]).toFixed(1)}`).join('');
  const totalRain = days.slice(0, todayOffset).reduce((a, d) => a + d.rain, 0);

  return (
    <figure className="weather">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Pluie et températures">
        <rect x={x(todayOffset) - bw / 2} y={pad.t} width={bw * (n - todayOffset)} height={ih} className="wx-forecast" />
        {[tLo, (tLo + tHi) / 2, tHi].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={yT(t)} y2={yT(t)} className="wx-grid" />
            <text x={pad.l - 4} y={yT(t) + 3} className="wx-axis" textAnchor="end">{t}°</text>
          </g>
        ))}
        <text x={W - pad.r + 4} y={pad.t + 8} className="wx-axis rain">{Math.round(maxRain)} mm</text>
        {days.map((d, i) => (
          <rect key={d.date} x={x(i) - bw * 0.35} width={bw * 0.7} y={pad.t + ih - yR(d.rain)} height={yR(d.rain)} className="wx-rain">
            <title>{`${dayLabel(d.date)} : ${d.rain} mm, ${d.tmin}–${d.tmax} °C`}</title>
          </rect>
        ))}
        <path d={line('tmax')} className="wx-tmax" />
        <path d={line('tmin')} className="wx-tmin" />
        <line x1={x(todayOffset)} x2={x(todayOffset)} y1={pad.t} y2={pad.t + ih} className="wx-today" />
        <text x={x(0)} y={H - 4} className="wx-axis">{dayLabel(days[0].date)}</text>
        <text x={x(todayOffset)} y={H - 4} className="wx-axis" textAnchor="middle">auj.</text>
      </svg>
      <figcaption>
        <span className="k rain" /> pluie <span className="k tmax" /> max <span className="k tmin" /> min · {Math.round(totalRain)} mm sur 30 jours
      </figcaption>
    </figure>
  );
}
