// Légende et état des zones favorables affichées sur la carte.
export const ZONE_STYLE = {
  fort: { color: '#15803d', fillOpacity: 0.5, label: 'Très favorable' },
  moyen: { color: '#65a30d', fillOpacity: 0.35, label: 'Favorable' },
  faible: { color: '#d97706', fillOpacity: 0.25, label: 'Possible' },
};

export default function Zones({ state, show, onToggle, species, area }) {
  const counts = { fort: 0, moyen: 0, faible: 0 };
  for (const f of state.data?.features ?? []) counts[f.properties.level]++;

  return (
    <section className="card">
      <h3>Où chercher · {species?.name}</h3>
      <label className="check">
        <input type="checkbox" checked={show} onChange={(e) => onToggle(e.target.checked)} /> afficher les zones sur la carte
      </label>
      {state.loading && <p className="muted small">Lecture des peuplements forestiers…</p>}
      {state.error && <p className="error small">{state.error}</p>}
      {state.data && (
        <>
          <ul className="legend">
            {Object.entries(ZONE_STYLE).map(([level, s]) => (
              <li key={level}>
                <i style={{ background: s.color, opacity: 0.4 + s.fillOpacity }} />
                {s.label} <span className="muted">{counts[level]}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">
            {area?.label ? `Dans ${area.label}` : 'Autour du point'} : peuplements dont l’essence convient à l’espèce (BD Forêt IGN).
            {state.data.truncated && ' Forêt très étendue : seuls les peuplements les plus favorables sont affichés. Clique dans un secteur pour le détail autour du point.'}
            {' '}Sur le terrain, privilégie lisières, bords de chemins et vieux arbres dans ces zones.
          </p>
          {!state.data.features.length && <p className="muted">Aucun peuplement favorable cartographié ici.</p>}
        </>
      )}
    </section>
  );
}
