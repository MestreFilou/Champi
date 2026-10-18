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

// Une couleur par espèce pour la carte « toutes les espèces » (distinctes deux à deux, lisibles sur le Plan IGN)
export const SPECIES_COLORS = {
  'cepe-bordeaux': '#92400e',
  'cepe-bronze': '#44403c',
  'cepe-pins': '#dc2626',
  'bolet-bai': '#db2777',
  girolle: '#f59e0b',
  'chanterelle-tube': '#65a30d',
  'trompette-mort': '#1f2937',
  'pied-mouton': '#14b8a6',
  'pied-bleu': '#7c3aed',
  'lactaire-delicieux': '#f97316',
  sparassis: '#d4a373',
  pleurote: '#64748b',
  coulemelle: '#0ea5e9',
  morille: '#a16207',
};
export const speciesColor = (id) => SPECIES_COLORS[id] ?? '#78716c';

// Espèce isolée : niveau d'un peuplement selon sa note du jour
export const zoneLevel = (score) => (score >= 60 ? 'fort' : score >= 35 ? 'moyen' : score >= 10 ? 'faible' : null);
