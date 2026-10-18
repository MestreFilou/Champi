import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import MapView from './components/MapView.jsx';
import SearchBox from './components/SearchBox.jsx';
import Analysis from './components/Analysis.jsx';
import Observations from './components/Observations.jsx';
import SpeciesSheets from './components/SpeciesSheets.jsx';
import SpeciesDetail from './components/SpeciesDetail.jsx';
import Zones from './components/Zones.jsx';
import TrackerPanel from './components/TrackerPanel.jsx';
import { useTracker } from './useTracker.js';
import { circleBbox, featureCenter, inBbox, inGeojson } from './geo.js';

// Emprise des zones favorables : la forêt choisie si on en a une, sinon un disque autour du clic.
const areaFromPlace = (p) => {
  if (!p.bbox) return null;
  const [s, n, w, e] = p.bbox;
  return { s, w, n, e, outline: p.geojson, label: p.name };
};

export default function App() {
  const [tab, setTab] = useState('carte');
  const [species, setSpecies] = useState([]);
  const [target, setTarget] = useState('cepe-bordeaux');
  const [point, setPoint] = useState(null);
  const [radius, setRadius] = useState(1);
  const [place, setPlace] = useState(null);
  const [analysis, setAnalysis] = useState({ loading: false });
  const [observations, setObservations] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [zoneArea, setZoneArea] = useState(null);
  const [showZones, setShowZones] = useState(true);
  const [zones, setZones] = useState({});
  const [follow, setFollow] = useState(false);
  const tracker = useTracker();

  useEffect(() => {
    api.species().then(setSpecies).catch(() => setSpecies([]));
  }, []);

  useEffect(() => {
    if (!point) return;
    let stale = false;
    setAnalysis((a) => ({ ...a, loading: true, error: null }));
    api
      .analyze(point.lat, point.lon, radius)
      .then((data) => !stale && setAnalysis({ loading: false, data }))
      .catch((err) => !stale && setAnalysis({ loading: false, error: err.message }));
    return () => {
      stale = true;
    };
  }, [point, radius]);

  useEffect(() => {
    if (!point || !target) return;
    let stale = false;
    setObservations({ loading: true });
    api
      .observations(target, point.lat, point.lon, 40)
      .then((d) => !stale && setObservations(d))
      .catch((err) => !stale && setObservations({ error: err.message }));
    return () => {
      stale = true;
    };
  }, [point, target]);

  useEffect(() => {
    if (!zoneArea || !target || !showZones) return;
    let stale = false;
    setZones((z) => ({ ...z, loading: true, error: null }));
    const { s, w, n, e, outline } = zoneArea;
    api
      .zones(target, { s, w, n, e })
      .then((fc) => {
        // Les peuplements sont pris dans l'emprise rectangulaire : on ne garde que ceux de la forêt elle-même.
        const features = outline ? fc.features.filter((f) => inGeojson(outline, ...featureCenter(f))) : fc.features;
        if (!stale) setZones({ data: { ...fc, features } });
      })
      .catch((err) => !stale && setZones({ error: err.message }));
    return () => {
      stale = true;
    };
  }, [zoneArea, target, showZones]);

  const pickPoint = (lat, lon) => {
    // Un clic dans la forêt choisie garde la forêt (contour et zones) ; ailleurs, on repart sur ce point.
    if (!place?.bbox || !inBbox(areaFromPlace(place), lat, lon)) setPlace(null);
    if (!inBbox(zoneArea, lat, lon)) setZoneArea({ ...circleBbox(lat, lon, Math.max(radius, 1.5)), label: null });
    setPoint({ lat, lon });
  };

  const bySpeciesId = useMemo(() => Object.fromEntries(species.map((s) => [s.id, s])), [species]);
  const selectable = species.filter((s) => s.selectable);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">🍄</span>
          <div>
            <h1>Champi</h1>
            <p>Où et quand chercher les champignons</p>
          </div>
        </div>
        <nav className="tabs">
          <button className={tab === 'carte' ? 'active' : ''} onClick={() => setTab('carte')}>Carte</button>
          <button className={tab === 'fiches' ? 'active' : ''} onClick={() => setTab('fiches')}>Fiches</button>
        </nav>
      </header>

      {tab === 'carte' && (
        <main className={tracker.sortie.status === 'idle' ? 'map-layout' : 'map-layout tracking'}>
          <aside className="sidebar">
            <SearchBox
              onSelect={(p) => {
                setPlace(p);
                setZoneArea(areaFromPlace(p) ?? { ...circleBbox(p.lat, p.lon, Math.max(radius, 1.5)), label: null });
                setPoint({ lat: p.lat, lon: p.lon });
              }}
            />
            <div className="controls">
              <label>
                Je cherche
                <select value={target} onChange={(e) => setTarget(e.target.value)}>
                  {selectable.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Rayon d’analyse
                <select value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
                  {[0.5, 1, 2, 3].map((r) => (
                    <option key={r} value={r}>{r} km</option>
                  ))}
                </select>
              </label>
            </div>

            {!point && (
              <div className="empty">
                <p><strong>Cherche une forêt</strong> ou <strong>clique sur la carte</strong> pour analyser un secteur.</p>
                <p className="muted">Active la couche « Essences (BD Forêt) » pour repérer chênaies, hêtraies et pinèdes.</p>
              </div>
            )}
            {point && (
              <Analysis
                state={analysis}
                target={target}
                speciesById={bySpeciesId}
                onPickSpecies={setTarget}
                onOpenSheet={(id) => setSheet(bySpeciesId[id])}
              >
                <Zones state={zones} show={showZones} onToggle={setShowZones} species={bySpeciesId[target]} area={zoneArea} />
              </Analysis>
            )}
            {point && <Observations data={observations} species={bySpeciesId[target]} />}
          </aside>
          <section className="map-wrap">
            <MapView
              point={point}
              radius={radius}
              place={place}
              observations={observations?.items}
              zones={showZones ? zones.data : null}
              zonesKey={`${target}:${zoneArea?.s},${zoneArea?.w}:${zones.data?.features.length}`}
              tracker={tracker}
              follow={follow}
              onFollow={setFollow}
              onPick={pickPoint}
              onRemoveSpot={tracker.removeSpot}
            />
            <TrackerPanel
              tracker={tracker}
              follow={follow}
              onFollow={setFollow}
              onAnalyzeHere={(p) => pickPoint(p.lat, p.lon)}
            />
          </section>
        </main>
      )}

      {tab === 'fiches' && <SpeciesSheets species={species} onOpen={setSheet} />}

      {sheet && (
        <SpeciesDetail
          species={sheet}
          speciesById={bySpeciesId}
          onClose={() => setSheet(null)}
          onSearch={
            sheet.selectable
              ? () => {
                  setTarget(sheet.id);
                  setSheet(null);
                  setTab('carte');
                }
              : null
          }
        />
      )}
    </div>
  );
}
