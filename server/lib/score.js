// Modèle heuristique « est-ce que ça pousse ? ».
// Chaque facteur est ramené entre 0 et 1, puis combiné. Les poids et seuils sont volontairement
// lisibles pour pouvoir les ajuster à l'expérience du terrain.

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const mean = (arr) => (arr.length ? sum(arr) / arr.length : null);

// Trapèze : 0 sous min, monte jusqu'à optBas, plateau, redescend jusqu'à max.
export function trapezoid(x, [min, lo, hi, max]) {
  if (x == null) return 0.5;
  if (x <= min || x >= max) return 0;
  if (x < lo) return (x - min) / (lo - min);
  if (x > hi) return (max - x) / (max - hi);
  return 1;
}

/**
 * Score d'une espèce pour le jour `t` (index dans weather.days).
 * Ne lit que les jours <= t : marche aussi bien pour aujourd'hui que pour un jour de prévision.
 */
export function scoreDay(species, weather, t, habitat) {
  const days = weather.days;
  const window = (from, to) => days.slice(Math.max(0, t - to), Math.max(0, t - from + 1));

  // 1. Pluie « déclenchante » dans la fenêtre de délai propre à l'espèce
  const [d0, d1] = species.rain.delay;
  const triggerRain = sum(window(d0, d1).map((d) => d.rain));
  const rain = clamp01((triggerRain - 0.3 * species.rain.minMm) / (0.7 * species.rain.minMm));

  // 2. Humidité actuelle : sol (0–7 cm) + pluie des 5 derniers jours + humidité de l'air
  const recent = window(0, 4);
  const soil = mean(recent.map((d) => d.soilMoisture).filter((v) => v != null));
  const soilScore = soil == null ? 0.5 : clamp01((soil - 0.15) / (0.32 - 0.15));
  const rh = mean(recent.map((d) => d.rh).filter((v) => v != null)) ?? 75;
  const rhScore = clamp01((rh - 60) / (90 - 60));
  const recentRain = sum(recent.map((d) => d.rain));
  const moisture = clamp01(0.55 * soilScore + 0.25 * rhScore + 0.2 * clamp01(recentRain / 10));

  // 3. Température moyenne de la semaine
  const tWeek = mean(window(0, 6).map((d) => d.tmean));
  const temp = trapezoid(tWeek, species.temp);

  // 4. Gel récent : stoppe la pousse des espèces sensibles
  const tminRecent = Math.min(...window(0, 4).map((d) => d.tmin));
  const frost = tminRecent < -1 ? species.frostTolerance + (1 - species.frostTolerance) * clamp01((tminRecent + 5) / 4) : 1;

  // 5. Sécheresse longue : aucune pluie > 5 mm depuis 3 semaines
  const wetDays = window(0, 20).filter((d) => d.rain >= 5).length;
  const drought = wetDays === 0 ? 0.25 : 1;

  // 6. Saison
  const month = Number(days[t].date.slice(5, 7));
  const season = seasonFactor(species.months, month);

  const weatherScore = (0.4 * rain + 0.3 * moisture + 0.3 * temp) * frost * drought;
  const habitatScore = habitat ?? 1;
  const score = Math.round(100 * weatherScore * (0.25 + 0.75 * habitatScore) * season);

  return {
    date: days[t].date,
    score,
    factors: {
      rain: { value: rain, triggerRain: round1(triggerRain), window: species.rain.delay, needed: species.rain.minMm },
      moisture: { value: moisture, soil: soil == null ? null : round2(soil), rh: Math.round(rh), recentRain: round1(recentRain) },
      temp: { value: temp, tWeek: round1(tWeek), range: species.temp },
      frost: { value: frost, tmin: round1(tminRecent) },
      drought: { value: drought, wetDays },
      season: { value: season, month },
      habitat: { value: habitatScore },
    },
  };
}

function seasonFactor(months, m) {
  if (months.includes(m)) return 1;
  const prev = ((m + 10) % 12) + 1;
  const next = (m % 12) + 1;
  if (months.includes(prev) || months.includes(next)) return 0.45;
  return 0.08;
}

/**
 * Adéquation des essences du secteur avec l'espèce : somme des parts pondérées par l'affinité.
 * 35 % du disque couvert d'hôtes parfaits suffit pour la note maximale (on cherche des coins, pas une moyenne).
 */
export function habitatScore(species, composition) {
  if (!composition) return { value: 0.5, matches: [] };
  const matches = Object.entries(composition.shares)
    .map(([essence, share]) => ({ essence, share, affinity: species.hosts[essence] ?? 0 }))
    .filter((m) => m.affinity > 0)
    .sort((a, b) => b.share * b.affinity - a.share * a.affinity);
  const raw = sum(matches.map((m) => m.share * m.affinity));
  return { value: clamp01(raw / 0.35), matches };
}

export function analyzeSpecies(species, weather, composition) {
  const habitat = habitatScore(species, composition);
  const today = scoreDay(species, weather, weather.todayIndex, habitat.value);
  const forecast = [];
  for (let t = weather.todayIndex + 1; t < weather.days.length; t++) {
    const s = scoreDay(species, weather, t, habitat.value);
    forecast.push({ date: s.date, score: s.score, confidence: forecastConfidence(species, t, weather.todayIndex) });
  }
  const history = [];
  for (let t = weather.todayIndex - 14; t < weather.todayIndex; t++) {
    history.push({ date: weather.days[t].date, score: scoreDay(species, weather, t, habitat.value).score });
  }
  return { id: species.id, today, forecast, history, habitat, verdict: verdict(today.score) };
}

/**
 * Fiabilité d'un score de prévision. Deux choses comptent :
 * - l'échéance (la météo prévue se dégrade vite après 3 jours) ;
 * - la part de la fenêtre de « pluie déclenchante » déjà tombée : pour le cèpe (pluie 7 à 16 jours avant),
 *   le score de J+5 repose surtout sur de la pluie mesurée, donc il est plus sûr qu'il n'y paraît.
 */
export function forecastConfidence(species, t, todayIndex) {
  const lead = t - todayIndex;
  const [d0, d1] = species.rain.delay;
  const observedDays = Math.max(0, Math.min(t - d0, todayIndex) - (t - d1) + 1);
  const observed = clamp01(observedDays / (d1 - d0 + 1));
  let level;
  if (lead <= 2) level = 'haute';
  else if (lead <= 7) level = observed >= 0.5 ? 'bonne' : 'moyenne';
  else level = observed >= 0.5 ? 'moyenne' : 'faible';
  return { lead, observed: round2(observed), level };
}

export function verdict(score) {
  if (score >= 70) return { level: 'top', label: 'Conditions excellentes' };
  if (score >= 50) return { level: 'good', label: 'Bonnes conditions' };
  if (score >= 30) return { level: 'maybe', label: 'Possible, sans garantie' };
  if (score >= 15) return { level: 'weak', label: 'Peu probable' };
  return { level: 'none', label: 'Défavorable' };
}

const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const round2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
