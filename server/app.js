import express from 'express';
import compression from 'compression';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPECIES, ALL_SHEETS, speciesById } from './data/species.js';
import { getWeather } from './lib/weather.js';
import { getForestComposition } from './lib/forest.js';
import { analyzeSpecies, scoreDay } from './lib/score.js';
import { getObservations, getTaxon } from './lib/observations.js';
import { searchPlaces } from './lib/search.js';
import { getStands, zonesForSpecies } from './lib/zones.js';
import { reliefPreference } from './lib/relief.js';
import { getSoil } from './lib/geology.js';
import { getParkings } from './lib/parkings.js';
import { authToken, COOKIE, ONE_YEAR, safeEqual } from './auth.js';

const app = express();
app.use(compression()); // les zones d'une grande forêt font ~2 Mo de JSON, ~400 Ko compressées

const coords = (req) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  // Emprise large de la France métropolitaine + Corse
  if (!(lat > 41 && lat < 51.5 && lon > -5.5 && lon < 10)) {
    const err = new Error('Coordonnées hors de France métropolitaine (lat/lon attendus).');
    err.status = 400;
    throw err;
  }
  return { lat, lon };
};

const route = (fn) => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (err) {
    console.error(req.originalUrl, err.message);
    res.status(err.status || 502).json({ error: err.message });
  }
};

// Connexion : vérifie le mot de passe et pose le cookie lu par middleware.js (un an)
app.post('/api/login', express.urlencoded({ extended: false }), async (req, res) => {
  const password = process.env.APP_PASSWORD;
  if (!password) return res.redirect(303, '/');
  if (!safeEqual(req.body?.password ?? '', password)) {
    await new Promise((r) => setTimeout(r, 800)); // freine les essais en rafale
    return res.redirect(303, '/login.html?erreur=1');
  }
  const secure = process.env.VERCEL ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${authToken(password)}; Max-Age=${ONE_YEAR}; Path=/; HttpOnly; SameSite=Lax${secure}`);
  res.redirect(303, '/');
});

app.get('/api/species', route(async () => {
  const taxa = await Promise.all(ALL_SHEETS.map((s) => getTaxon(s.latin).catch(() => null)));
  return ALL_SHEETS.map((s, i) => ({ ...s, selectable: SPECIES.includes(s), taxon: taxa[i] }));
}));

app.get('/api/search', route(async (req) => {
  const q = String(req.query.q || '');
  if (q.trim().length < 2) return [];
  return searchPlaces(q);
}));

// Analyse complète d'un point : météo, essences, score de chaque espèce (aujourd'hui + 7 jours).
app.get('/api/analyze', route(async (req) => {
  const { lat, lon } = coords(req);
  const radiusKm = Math.min(3, Math.max(0.3, Number(req.query.radius) || 1));
  const [weather, forest, soil] = await Promise.all([
    getWeather(lat, lon),
    getForestComposition(lat, lon, radiusKm).catch((err) => {
      console.error('BD Forêt indisponible :', err.message);
      return null;
    }),
    getSoil(lat, lon).catch((err) => {
      console.error('BRGM indisponible :', err.message);
      return null;
    }),
  ]);
  const results = SPECIES.map((s) => analyzeSpecies(s, weather, forest, soil)).sort((a, b) => b.today.score - a.today.score);
  return {
    point: { lat, lon, elevation: weather.elevation },
    forest,
    soil,
    weather: {
      todayIndex: weather.todayIndex,
      days: weather.days.slice(weather.todayIndex - 30),
      todayOffset: 30,
    },
    results,
  };
}));

// Peuplements favorables à une espèce dans une emprise (forêt sélectionnée ou disque d'analyse).
app.get('/api/zones', route(async (req) => {
  const species = speciesById(String(req.query.species));
  if (!species) throw Object.assign(new Error('Espèce inconnue'), { status: 404 });
  const bbox = ['s', 'w', 'n', 'e'].map((k) => Number(req.query[k]));
  coords({ query: { lat: bbox[0], lon: bbox[1] } });
  coords({ query: { lat: bbox[2], lon: bbox[3] } });
  // Le versant à privilégier dépend de la météo du moment au centre de la zone
  const [stands, weather] = await Promise.all([
    getStands(bbox),
    getWeather((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2).catch(() => null),
  ]);
  const relief = weather ? reliefPreference(species, scoreDay(species, weather, weather.todayIndex, 1).factors) : { prefer: null, reason: null };
  return { ...zonesForSpecies(species, stands, { prefer: relief.prefer }), relief };
}));

app.get('/api/parkings', route(async (req) => {
  const { lat, lon } = coords(req);
  return getParkings(lat, lon);
}));

app.get('/api/observations', route(async (req) => {
  const { lat, lon } = coords(req);
  const species = speciesById(String(req.query.species));
  if (!species) throw Object.assign(new Error('Espèce inconnue'), { status: 404 });
  const radius = Math.min(200, Math.max(5, Number(req.query.radius) || 40));
  return getObservations(species.latin, lat, lon, radius);
}));

// Sur Vercel, les fichiers statiques sont servis par le CDN : la fonction ne reçoit que /api.
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  app.use(express.static(dist));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

export default app;
