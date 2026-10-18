export const USER_AGENT = 'Champi/0.1 (appli perso, previsions champignons)'; // ASCII seulement : l'IGN renvoie 404 sur les accents

export async function getJson(url, { timeoutMs = 30_000, headers = {} } = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} sur ${new URL(url).host}`);
  return res.json();
}

// Arrondi des coordonnées pour mutualiser le cache entre clics proches (~100 m).
export const roundCoord = (x, digits = 3) => Number(x).toFixed(digits);
