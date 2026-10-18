export const USER_AGENT = 'Champi/0.1 (appli perso, previsions champignons)'; // ASCII seulement : l'IGN renvoie 404 sur les accents

async function request(url, { timeoutMs = 30_000, headers = {}, method = 'GET', body, accept }) {
  const res = await fetch(url, {
    method,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: accept,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} sur ${new URL(url).host}`);
  return res;
}

export async function getJson(url, opts = {}) {
  return (await request(url, { ...opts, accept: 'application/json' })).json();
}

export async function getText(url, opts = {}) {
  return (await request(url, { ...opts, accept: 'text/plain' })).text();
}

// Arrondi des coordonnées pour mutualiser le cache entre clics proches (~100 m).
export const roundCoord = (x, digits = 3) => Number(x).toFixed(digits);
