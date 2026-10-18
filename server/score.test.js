import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreDay, trapezoid, habitatScore, forecastConfidence } from './lib/score.js';
import { zonesForSpecies } from './lib/zones.js';
import { reliefBonus, slopeFrom } from './lib/relief.js';
import { soilKind } from './lib/geology.js';
import { soilFactor } from './lib/score.js';
import { speciesById } from './data/species.js';

// 30 jours de météo synthétique se terminant le 15 octobre
const makeWeather = (fn) => {
  const days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(Date.UTC(2026, 9, 15 - 29 + i)).toISOString().slice(0, 10);
    return { date, tmin: 8, tmax: 18, tmean: 13, rain: 0, rh: 85, soilMoisture: 0.3, soilTemp: 12, ...fn(i) };
  });
  return { todayIndex: 29, days };
};

const cepe = speciesById('cepe-bordeaux');

test('trapèze', () => {
  assert.equal(trapezoid(15, [8, 12, 18, 23]), 1);
  assert.equal(trapezoid(5, [8, 12, 18, 23]), 0);
  assert.equal(trapezoid(10, [8, 12, 18, 23]), 0.5);
});

test('une grosse pluie il y a 10 jours donne un bon score de cèpe', () => {
  const wet = makeWeather((i) => (i === 19 ? { rain: 40 } : {}));
  const dry = makeWeather(() => ({ rain: 0, soilMoisture: 0.12, rh: 60 }));
  const sWet = scoreDay(cepe, wet, 29, 1).score;
  const sDry = scoreDay(cepe, dry, 29, 1).score;
  assert.ok(sWet >= 70, `score humide ${sWet}`);
  assert.ok(sDry < 15, `score sec ${sDry}`);
});

test('le gel fait chuter le cèpe mais pas le pied bleu', () => {
  const frosty = makeWeather((i) => ({ ...(i === 19 ? { rain: 40 } : {}), ...(i > 26 ? { tmin: -4, tmean: 6 } : {}) }));
  assert.ok(scoreDay(cepe, frosty, 29, 1).factors.frost.value < 0.5);
  assert.equal(scoreDay(speciesById('pied-bleu'), frosty, 29, 1).factors.frost.value > 0.9, true);
});

test('pas d’arbres hôtes, pas de lactaire délicieux', () => {
  const h = habitatScore(speciesById('lactaire-delicieux'), { shares: { Hêtre: 0.8, 'Hors forêt': 0.2 } });
  assert.equal(h.value, 0);
});

test('fiabilité : le score de J+5 du cèpe repose surtout sur de la pluie déjà tombée', () => {
  const c = forecastConfidence(cepe, 50, 45); // pluie déclenchante entre J-11 et J-2 vue de J+5
  assert.equal(c.lead, 5);
  assert.ok(c.observed > 0.5);
  assert.equal(c.level, 'bonne');
  assert.equal(forecastConfidence(cepe, 47, 45).level, 'haute');
  assert.equal(forecastConfidence(cepe, 58, 45).level, 'faible');
});

test('zones : seules les essences hôtes sortent, classées par niveau', () => {
  const sq = [[[2, 48], [2.01, 48], [2.01, 48.01], [2, 48.01], [2, 48]]];
  const z = zonesForSpecies(cepe, {
    truncated: false,
    stands: [
      { essence: 'Hêtre', tfv: 'x', coordinates: [sq] },
      { essence: 'Feuillus', tfv: 'x', coordinates: [sq] },
      { essence: 'Peuplier', tfv: 'x', coordinates: [sq] },
    ],
  });
  assert.deepEqual(z.features.map((f) => f.properties.level), ['fort', 'moyen']);
});

test('zones : au-delà du plafond, on garde les plus favorables', () => {
  const sq = [[[2, 48], [2.01, 48], [2.01, 48.01], [2, 48.01], [2, 48]]];
  const stands = ['Feuillus', 'Hêtre', 'Feuillus'].map((essence) => ({ essence, tfv: 'x', coordinates: [sq] }));
  const z = zonesForSpecies(cepe, { stands, truncated: false }, { max: 1 });
  assert.equal(z.truncated, true);
  assert.equal(z.features[0].properties.essence, 'Hêtre');
});

test('relief : exposition calculée depuis trois altitudes', () => {
  // le terrain monte vers le sud (le point nord est plus bas) : versant tourné vers le nord
  const r = slopeFrom(100, 100, 96);
  assert.equal(r.aspect, 0);
  assert.ok(r.slope > 5);
  assert.ok(reliefBonus('nord', r) > 0.3);
  assert.ok(reliefBonus('sud', r) < -0.3);
  assert.equal(reliefBonus('nord', { slope: 1, aspect: 0 }), 0); // plat : pas d'effet
});

test('zones : un bon versant fait monter le niveau', () => {
  const sq = [[[2, 48], [2.01, 48], [2.01, 48.01], [2, 48.01], [2, 48]]];
  const stands = [{ essence: 'Feuillus', tfv: 'x', coordinates: [sq], relief: { slope: 15, aspect: 0, elevation: 200 } }];
  assert.equal(zonesForSpecies(cepe, { stands, truncated: false }).features[0].properties.level, 'moyen');
  assert.equal(zonesForSpecies(cepe, { stands, truncated: false }, { prefer: 'nord' }).features[0].properties.level, 'moyen');
  const z = zonesForSpecies(cepe, { stands, truncated: false }, { prefer: 'sud' });
  assert.equal(z.features[0].properties.level, 'faible');
});

test('sol : calcaire, acide et pénalité de la girolle sur calcaire', () => {
  assert.equal(soilKind('Craie'), 'calcaire');
  assert.equal(soilKind('Calcaires, marnes et gypse'), 'calcaire');
  assert.equal(soilKind('Sables'), 'acide');
  assert.equal(soilKind('Gneiss'), 'acide');
  assert.equal(soilFactor(speciesById('girolle'), { kind: 'calcaire' }).value, 0.55);
  assert.equal(soilFactor(speciesById('girolle'), { kind: 'acide' }).value, 1);
  assert.equal(soilFactor(cepe, { kind: 'calcaire' }).value, 1); // le cèpe est indifférent
});
