async function get(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/${path}${qs ? `?${qs}` : ''}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

export const api = {
  species: () => get('species'),
  search: (q) => get('search', { q }),
  analyze: (lat, lon, radius) => get('analyze', { lat, lon, radius }),
  zones: (bbox) => get('zones', bbox),
  parkings: (lat, lon) => get('parkings', { lat, lon }),
  observations: (species, lat, lon, radius) => get('observations', { species, lat, lon, radius }),
};
