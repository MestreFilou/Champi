import { cached, HOUR, DAY } from './cache.js';
import { getJson } from './http.js';

const INAT = 'https://api.inaturalist.org/v1';

/**
 * Observations récentes d'une espèce autour d'un point, avec descriptions et commentaires
 * des observateurs (iNaturalist, API publique, licences Creative Commons).
 */
export function getObservations(latin, lat, lon, radiusKm = 40) {
  const key = `obs:${latin}:${lat.toFixed(2)},${lon.toFixed(2)}:${radiusKm}`;
  return cached(key, HOUR, async () => {
    const url = new URL(`${INAT}/observations`);
    url.search = new URLSearchParams({
      taxon_name: latin,
      lat,
      lng: lon,
      radius: radiusKm,
      order_by: 'observed_on',
      order: 'desc',
      per_page: 40,
      locale: 'fr',
      quality_grade: 'research,needs_id',
    });
    const d = await getJson(url);
    return {
      total: d.total_results,
      radiusKm,
      items: d.results.map((o) => ({
        id: o.id,
        url: o.uri,
        date: o.observed_on,
        place: o.place_guess,
        lat: o.geojson?.coordinates?.[1],
        lon: o.geojson?.coordinates?.[0],
        obscured: o.obscured,
        quality: o.quality_grade,
        user: o.user?.login,
        photo: o.photos?.[0]?.url?.replace('square', 'small'),
        description: o.description || null,
        comments: (o.comments || [])
          .filter((c) => !c.hidden && c.body)
          .map((c) => ({ user: c.user?.login, date: c.created_at?.slice(0, 10), body: c.body })),
      })),
    };
  });
}

/** Photo de référence et nom vernaculaire d'un taxon, pour les fiches. */
export function getTaxon(latin) {
  return cached(`taxon:${latin}`, 7 * DAY, async () => {
    const url = new URL(`${INAT}/taxa`);
    url.search = new URLSearchParams({ q: latin, locale: 'fr', per_page: 5 });
    const d = await getJson(url);
    const t = d.results.find((r) => r.name === latin) || d.results[0];
    if (!t) return null;
    return {
      inatId: t.id,
      url: `https://www.inaturalist.org/taxa/${t.id}`,
      commonName: t.preferred_common_name,
      photo: t.default_photo?.medium_url,
      photoAttribution: t.default_photo?.attribution,
      wikipedia: t.wikipedia_url,
      observationsCount: t.observations_count,
    };
  });
}
