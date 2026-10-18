export const EDIBILITY = {
  excellent: { label: 'Excellent comestible', tone: 'good' },
  bon: { label: 'Bon comestible', tone: 'good' },
  comestible: { label: 'Comestible', tone: 'ok' },
  mortel: { label: 'MORTEL', tone: 'deadly' },
};
export const edibility = (e) =>
  EDIBILITY[e] || { label: e.charAt(0).toUpperCase() + e.slice(1), tone: e.includes('toxique') ? 'bad' : 'ok' };

export const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export const scoreColor = (s) =>
  s >= 70 ? 'var(--top)' : s >= 50 ? 'var(--good)' : s >= 30 ? 'var(--maybe)' : s >= 15 ? 'var(--weak)' : 'var(--none)';

export const dayLabel = (iso, short = false) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', short ? { weekday: 'short' } : { weekday: 'short', day: 'numeric', month: 'short' });

export const pct = (x) => `${Math.round(x * 100)} %`;
