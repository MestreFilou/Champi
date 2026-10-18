import { speciesColor } from '../format.js';
import { ZONE_STYLE } from './Zones.jsx';

// Légende posée sur la carte : ce que veulent dire les couleurs, selon les espèces choisies.
export default function MapLegend({ selection, speciesById, visible }) {
  if (!visible) return null;
  if (selection.length === 0) {
    return (
      <div className="map-legend">
        <b>Toutes les espèces</b>
        <span className="legend-ramp" />
        <span className="legend-ends"><small>peu probable</small><small>très probable</small></span>
      </div>
    );
  }
  if (selection.length === 1) {
    return (
      <div className="map-legend">
        <b>{speciesById[selection[0]]?.name}</b>
        {Object.values(ZONE_STYLE).map((s) => (
          <span key={s.label} className="legend-row"><i style={{ background: s.color }} />{s.label.replace(/ \(.*/, '')}</span>
        ))}
      </div>
    );
  }
  return (
    <div className="map-legend">
      {selection.map((id) => (
        <span key={id} className="legend-row"><i style={{ background: speciesColor(id) }} />{speciesById[id]?.name ?? id}</span>
      ))}
      <span className="legend-row"><i style={{ background: '#6b7280' }} />à égalité</span>
      <small className="muted">chaque parcelle : l’espèce pour qui c’est un de ses meilleurs coins</small>
    </div>
  );
}
