// Cache mémoire simple avec TTL, pour ménager les API publiques (IGN, Open-Meteo, iNaturalist, Nominatim).
const store = new Map();
const MAX_ENTRIES = 2000;

export async function cached(key, ttlMs, fn) {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await fn();
  if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value);
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
