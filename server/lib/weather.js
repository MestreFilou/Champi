import { cached, HOUR } from './cache.js';
import { getJson, roundCoord } from './http.js';

export const PAST_DAYS = 45;
export const FORECAST_DAYS = 14; // Open-Meteo va jusqu'à 16 jours ; au-delà de 7, c'est indicatif

/**
 * Météo journalière sur PAST_DAYS jours passés + FORECAST_DAYS jours de prévision (Open-Meteo, sans clé).
 * L'humidité du sol n'existe qu'en horaire : on la moyenne par jour.
 */
export function getWeather(lat, lon) {
  const la = roundCoord(lat, 2);
  const lo = roundCoord(lon, 2);
  return cached(`wx:${la},${lo}`, HOUR, async () => {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({
      latitude: la,
      longitude: lo,
      daily: 'temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,precipitation_probability_max,relative_humidity_2m_mean',
      hourly: 'soil_moisture_0_to_7cm,soil_temperature_6cm',
      past_days: PAST_DAYS,
      forecast_days: FORECAST_DAYS,
      timezone: 'Europe/Paris',
    });
    const d = await getJson(url);

    const soilMoisture = dailyMean(d.hourly.soil_moisture_0_to_7cm);
    const soilTemp = dailyMean(d.hourly.soil_temperature_6cm);
    const days = d.daily.time.map((date, i) => ({
      date,
      tmax: d.daily.temperature_2m_max[i],
      tmin: d.daily.temperature_2m_min[i],
      tmean: d.daily.temperature_2m_mean[i],
      rain: d.daily.precipitation_sum[i] ?? 0,
      rainProb: d.daily.precipitation_probability_max?.[i] ?? null, // null pour les jours passés
      rh: d.daily.relative_humidity_2m_mean[i],
      soilMoisture: soilMoisture[i] ?? null,
      soilTemp: soilTemp[i] ?? null,
    }));
    return { elevation: d.elevation, todayIndex: PAST_DAYS, days };
  });
}

function dailyMean(hourly = []) {
  const out = [];
  for (let i = 0; i < hourly.length; i += 24) {
    const vals = hourly.slice(i, i + 24).filter((v) => v != null);
    out.push(vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);
  }
  return out;
}
