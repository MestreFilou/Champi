import { useEffect } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, LayersControl, Circle, CircleMarker, GeoJSON, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet';
import { ZONE_STYLE } from './Zones.jsx';
import { gmapsUrl, wazeUrl } from './Access.jsx';

import { IGN_WMTS, PLAN_IGN } from '../tiles.js';

const IGN_ATTR = '&copy; <a href="https://www.ign.fr/">IGN</a> Géoplateforme';

// Donne la carte Leaflet à l'appli (emprise affichée pour le hors ligne)
function MapRef({ onReady }) {
  const map = useMap();
  useEffect(() => onReady?.(map), [map, onReady]);
  return null;
}

function ClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

// Cadre la forêt choisie ; un simple clic ne recadre que si le point sort de l'écran.
function FlyTo({ place, point }) {
  const map = useMap();
  useEffect(() => {
    if (!place?.bbox) return;
    const [s, n, w, e] = place.bbox;
    map.flyToBounds([[s, w], [n, e]], { maxZoom: 14, duration: 1 });
  }, [place, map]);
  useEffect(() => {
    if (point && !map.getBounds().contains([point.lat, point.lon])) map.panTo([point.lat, point.lon]);
  }, [point, map]);
  return null;
}

// Garde la carte centrée sur moi ; la déplacer à la main coupe le suivi.
function Follow({ position, follow, onFollow }) {
  const map = useMap();
  useMapEvents({ dragstart: () => follow && onFollow(false) });
  useEffect(() => {
    if (follow && position) map.setView([position.lat, position.lon], Math.max(map.getZoom(), 16), { animate: true });
  }, [follow, position, map]);
  return null;
}

const zoneStyle = (f) => {
  const s = ZONE_STYLE[f.properties.level];
  return { color: s.color, weight: 0.6, fillColor: s.color, fillOpacity: s.fillOpacity };
};
const zoneTooltip = (f, layer) => {
  const p = f.properties;
  const relief = p.slope != null ? `<br><small>${p.slope >= 3 ? `pente ${Math.round(p.slope)}°, versant ${p.aspect}` : 'terrain plat'} · ${p.elevation} m${p.relief ? ` · ${p.relief}` : ''}</small>` : '';
  layer.bindTooltip(`${p.essence} · ${ZONE_STYLE[p.level].label}<br><small>${p.tfv}</small>${relief}`, { sticky: true });
};

export default function MapView({ point, radius, place, observations = [], parkings = [], zones, zonesKey, tracker, spots = [], follow, onFollow, onPick, onSpotAction, onReady }) {
  return (
    <MapContainer center={[46.6, 2.4]} zoom={6} className="map" zoomControl>
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Plan IGN">
          <TileLayer url={PLAN_IGN} attribution={IGN_ATTR} maxZoom={19} crossOrigin />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Photos aériennes">
          <TileLayer url={IGN_WMTS('ORTHOIMAGERY.ORTHOPHOTOS', 'image/jpeg')} attribution={IGN_ATTR} maxZoom={19} crossOrigin />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="OpenStreetMap">
          <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" maxZoom={19} crossOrigin />
        </LayersControl.BaseLayer>
        <LayersControl.Overlay name="Essences (BD Forêt V2)">
          <WMSTileLayer
            url="https://data.geopf.fr/wms-r/wms"
            layers="LANDCOVER.FORESTINVENTORY.V2"
            format="image/png"
            version="1.3.0"
            transparent
            opacity={0.55}
            minZoom={11}
            attribution={IGN_ATTR}
          />
        </LayersControl.Overlay>
        <LayersControl.Overlay name="Forêts publiques (ONF)">
          <WMSTileLayer url="https://data.geopf.fr/wms-r/wms" layers="FORETS.PUBLIQUES" format="image/png"
            version="1.3.0" transparent opacity={0.6} attribution={IGN_ATTR} />
        </LayersControl.Overlay>
      </LayersControl>

      <ClickHandler onPick={onPick} />
      <MapRef onReady={onReady} />
      <FlyTo place={place} point={point} />
      <Follow position={tracker?.position} follow={follow} onFollow={onFollow} />

      {zones && <GeoJSON key={zonesKey} data={zones} style={zoneStyle} onEachFeature={zoneTooltip} />}

      {place?.geojson && (
        <GeoJSON key={place.id} data={place.geojson} style={{ color: '#7a4b1e', weight: 2, fillOpacity: 0.05, dashArray: '6 4' }} />
      )}
      {point && (
        <>
          <Circle center={[point.lat, point.lon]} radius={radius * 1000} pathOptions={{ color: '#c2410c', weight: 2, fillOpacity: 0.08 }} />
          <CircleMarker center={[point.lat, point.lon]} radius={6} pathOptions={{ color: '#fff', weight: 2, fillColor: '#c2410c', fillOpacity: 1 }} />
        </>
      )}
      {observations
        .filter((o) => o.lat && o.lon)
        .map((o) => (
          <CircleMarker key={o.id} center={[o.lat, o.lon]} radius={5} pathOptions={{ color: '#fff', weight: 1, fillColor: '#6d28d9', fillOpacity: 0.85 }}>
            <Popup>
              <strong>{o.date}</strong>
              <br />
              {o.place}
              {o.obscured && <em><br />Position floutée par l’observateur</em>}
              <br />
              <a href={o.url} target="_blank" rel="noreferrer">Voir sur iNaturalist</a>
            </Popup>
          </CircleMarker>
        ))}

      {parkings.slice(0, 3).map((p) => (
        <CircleMarker key={p.id} center={[p.lat, p.lon]} radius={8} bubblingMouseEvents={false}
          pathOptions={{ color: '#fff', weight: 2, fillColor: '#1d4ed8', fillOpacity: 1 }}>
          <Popup>
            <strong>{p.name || 'Parking'}</strong>
            <br />
            <a href={gmapsUrl(p)} target="_blank" rel="noreferrer">Itinéraire Google Maps</a>
            <br />
            <a href={wazeUrl(p)} target="_blank" rel="noreferrer">Itinéraire Waze</a>
          </Popup>
        </CircleMarker>
      ))}
      {tracker?.sortie.track.length > 1 && (
        <Polyline positions={tracker.sortie.track.map((p) => [p.lat, p.lon])} pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.85 }} />
      )}
      {tracker?.sortie.track[0] && (
        <CircleMarker center={[tracker.sortie.track[0].lat, tracker.sortie.track[0].lon]} radius={7} bubblingMouseEvents={false} pathOptions={{ color: '#fff', weight: 2, fillColor: '#111827', fillOpacity: 1 }}>
          <Popup>Point de départ</Popup>
        </CircleMarker>
      )}
      {spots.map((s) => (
        <CircleMarker key={s.id} center={[s.lat, s.lon]} radius={8} bubblingMouseEvents={false} pathOptions={{ color: '#fff', weight: 2, fillColor: '#c2410c', fillOpacity: 1 }}>
          <Popup>
            <strong>{s.name}</strong>
            <br />
            {s.entries.length ? `${s.entries.length} récolte${s.entries.length > 1 ? 's' : ''}` : 'aucune récolte notée'} · {new Date(s.t).toLocaleDateString('fr-FR')}
            <div className="popup-actions">
              <button className="link" onClick={() => onSpotAction('entry', s)}>+ Récolte</button>
              <button className="link" onClick={() => onSpotAction('guide', s)}>🧭 Y aller</button>
              <button className="link" onClick={() => onSpotAction('carnet', s)}>Carnet</button>
            </div>
          </Popup>
        </CircleMarker>
      ))}
      {tracker?.position && (
        <>
          <Circle center={[tracker.position.lat, tracker.position.lon]} radius={tracker.position.acc} interactive={false}
            pathOptions={{ color: '#2563eb', weight: 1, fillOpacity: 0.12 }} />
          <CircleMarker center={[tracker.position.lat, tracker.position.lon]} radius={7} interactive={false}
            pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }} />
        </>
      )}
    </MapContainer>
  );
}
