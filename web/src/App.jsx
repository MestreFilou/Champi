import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import MapView from './components/MapView.jsx';
import SearchBox from './components/SearchBox.jsx';
import Analysis from './components/Analysis.jsx';
import Observations from './components/Observations.jsx';
import SpeciesSheets from './components/SpeciesSheets.jsx';
import SpeciesDetail from './components/SpeciesDetail.jsx';
import Zones, { MAX_SELECTION } from './components/Zones.jsx';
import MapLegend from './components/MapLegend.jsx';
import Forests from './components/Forests.jsx';
import { forestKey, useForests } from './useForests.js';
import TrackerPanel from './components/TrackerPanel.jsx';
import Access from './components/Access.jsx';
import BeforeYouGo from './components/BeforeYouGo.jsx';
import Offline, { useOnline } from './components/Offline.jsx';
import BottomSheet from './components/BottomSheet.jsx';
import MobileSummary from './components/MobileSummary.jsx';
import { useTracker } from './useTracker.js';
import { useCarnet } from './useCarnet.js';
import Carnet from './components/Carnet.jsx';
import EntryForm from './components/EntryForm.jsx';
import { useIsMobile } from './useIsMobile.js';
import { circleBbox, featureCenter, inBbox, inGeojson } from './geo.js';
import { speciesColor, zoneLevel } from './format.js';

// Emprise des zones favorables : la forêt choisie si on en a une, sinon un disque autour du clic.
const areaFromPlace = (p) => {
  if (!p.bbox) return null;
  const [s, n, w, e] = p.bbox;
  return { s, w, n, e, outline: p.geojson, label: p.name };
};

// Dernière vue (forêt, point, espèce, rayon) : au rechargement, et surtout hors ligne, on retrouve
// le même secteur, donc les mêmes requêtes, que le service worker sait resservir depuis son cache.
const VIEW_KEY = 'champi.vue';
const savedView = (() => {
  try {
    return JSON.parse(localStorage.getItem(VIEW_KEY)) ?? {};
  } catch {
    return {};
  }
})();
const initialArea = () => {
  if (savedView.place) return areaFromPlace(savedView.place);
  if (savedView.point) return { ...circleBbox(savedView.point.lat, savedView.point.lon, Math.max(savedView.radius ?? 1, 1.5)), label: null };
  return null;
};

// Résumé par espèce recalculé sur les seuls peuplements de la forêt (le serveur travaille sur son rectangle),
// avec les mêmes règles que server/lib/zones.js : note atteinte sur au moins 10 ha, et un peuplement
// « convient » quand sa note atteint 60 % de la note météo de l'espèce.
function summarize(species, features) {
  const total = features.reduce((sum, f) => sum + f.properties.area, 0) || 1;
  const minHa = Math.min(10, total);
  return species
    .map((s) => {
      const scored = [];
      let favorable = 0;
      for (const f of features) {
        const sc = f.properties.scores[s.id] ?? 0;
        if (!sc) continue;
        scored.push([sc, f.properties.area]);
        if (s.weatherScore > 0 && sc >= 0.6 * s.weatherScore) favorable += f.properties.area;
      }
      scored.sort((a, b) => b[0] - a[0]);
      let area = 0;
      const best = scored.find(([, ha]) => (area += ha) >= minHa)?.[0] ?? 0;
      return { ...s, best, favorableShare: Math.round((100 * favorable) / total) / 100 };
    })
    .sort((a, b) => b.best - a.best);
}

export default function App() {
  const [tab, setTab] = useState('carte');
  const [species, setSpecies] = useState([]);
  // Espèces affichées sur la carte : [] = toutes ; une seule = vue détaillée de cette espèce
  const [selection, setSelection] = useState(savedView.selection ?? (savedView.focus && savedView.focus !== 'all' ? [savedView.focus] : []));
  const target = selection.length === 1 ? selection[0] : 'all'; // espèce dont on montre la fiche, les prévisions, les observations
  const [point, setPoint] = useState(savedView.point ?? null);
  const [radius, setRadius] = useState(savedView.radius ?? 1);
  const [place, setPlace] = useState(savedView.place ?? null);
  const [analysis, setAnalysis] = useState({ loading: false });
  const [observations, setObservations] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [zoneArea, setZoneArea] = useState(initialArea);
  const [showZones, setShowZones] = useState(true);
  const [zones, setZones] = useState({});
  const [follow, setFollow] = useState(false);
  const [parkings, setParkings] = useState(null);
  const [leaflet, setLeaflet] = useState(null); // instance de la carte, pour l'emprise affichée
  const online = useOnline();
  const tracker = useTracker();
  const carnet = useCarnet();
  const [guide, setGuide] = useState(null); // cible de la boussole : un coin du carnet
  const [entryFor, setEntryFor] = useState(null); // coin dont on remplit la fiche de récolte
  const mobile = useIsMobile();
  const forests = useForests();
  const [canGoBack, setCanGoBack] = useState(false);
  const nav = useRef({ stack: [], index: -1 });
  const [panel, setPanel] = useState('peek'); // cran du panneau du bas sur téléphone

  useEffect(() => {
    api.species().then(setSpecies).catch(() => setSpecies([]));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify({ place, point, radius, selection }));
    } catch {
      /* contour de forêt trop lourd ou stockage bloqué : on s'en passe */
    }
  }, [place, point, radius, selection]);

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
    if (!point || target === 'all') {
      setObservations(null);
      return;
    }
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

  // Parkings : requête lente (Overpass), chargée à part pour ne pas retarder l'analyse
  useEffect(() => {
    if (!point) return;
    let stale = false;
    setParkings({ loading: true });
    api
      .parkings(point.lat, point.lon)
      .then((items) => !stale && setParkings({ items }))
      .catch((err) => !stale && setParkings({ error: err.message }));
    return () => {
      stale = true;
    };
  }, [point]);

  useEffect(() => {
    if (!zoneArea || !showZones) return;
    let stale = false;
    setZones((z) => ({ ...z, loading: true, error: null }));
    const { s, w, n, e, outline } = zoneArea;
    api
      .zones({ s, w, n, e })
      .then((fc) => {
        // Les peuplements sont pris dans l'emprise rectangulaire : on ne garde que ceux de la forêt elle-même.
        if (!Array.isArray(fc?.features) || !Array.isArray(fc?.species)) throw new Error('Réponse des zones dans un format inattendu : recharge la page.');
        if (!outline) return !stale && setZones({ data: fc });
        const features = fc.features.filter((f) => inGeojson(outline, ...featureCenter(f)));
        if (!stale) setZones({ data: { ...fc, features, species: summarize(fc.species, features) } });
      })
      .catch((err) => !stale && setZones({ error: err.message }));
    return () => {
      stale = true;
    };
  }, [zoneArea, showZones]);

  const pickPoint = (lat, lon) => {
    // Un clic dans la forêt choisie garde la forêt (contour et zones) ; ailleurs, on repart sur ce point.
    if (!place?.bbox || !inBbox(areaFromPlace(place), lat, lon)) setPlace(null);
    if (!inBbox(zoneArea, lat, lon)) setZoneArea({ ...circleBbox(lat, lon, Math.max(radius, 1.5)), label: null });
    setPoint({ lat, lon });
  };

  // Historique : chaque changement d'onglet, de secteur, de rayon ou d'espèces devient une étape.
  // La flèche ← et le bouton retour du téléphone reviennent à l'étape précédente.
  useEffect(() => {
    const h = nav.current;
    const snap = { tab, place, point, radius, selection, zoneArea };
    const cur = h.stack[h.index];
    // Rien de nouveau (ou on vient de revenir en arrière vers cette étape)
    if (cur && ['tab', 'place', 'point', 'radius', 'selection'].every((k) => cur[k] === snap[k])) return;
    h.stack = [...h.stack.slice(0, h.index + 1), snap];
    h.index = h.stack.length - 1;
    if (h.index === 0) window.history.replaceState({ champi: 0 }, '');
    else window.history.pushState({ champi: h.index }, '');
    setCanGoBack(h.index > 0);
  }, [tab, place, point, radius, selection]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onPop = (e) => {
      const h = nav.current;
      const i = e.state?.champi;
      const v = h.stack[i];
      if (!v) return;
      h.index = i;
      setTab(v.tab);
      setPlace(v.place);
      setPoint(v.point);
      setRadius(v.radius);
      setSelection(v.selection);
      setZoneArea(v.zoneArea);
      setCanGoBack(i > 0);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const toggleSpecies = (id) =>
    setSelection((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : sel.length >= MAX_SELECTION ? sel : [...sel, id]));

  const openForest = (f) => {
    setPlace(f.place ?? null);
    setPoint(f.point);
    setRadius(f.radius ?? 1);
    setZoneArea(f.zoneArea ?? (f.place ? areaFromPlace(f.place) : { ...circleBbox(f.point.lat, f.point.lon, 1.5), label: null }));
    setSelection(f.selection ?? []);
    setTab('carte');
    setPanel('peek');
  };

  const currentKey = forestKey({ place, point });
  const isSaved = forests.forests.some((f) => f.key === currentKey);
  const toggleSaved = () =>
    isSaved
      ? forests.remove(currentKey)
      : forests.save({ place, point, radius, zoneArea, selection }, place?.name ?? `Secteur ${point.lat.toFixed(3)}, ${point.lon.toFixed(3)}`);

  // Vue de départ de la carte quand elle (ré)apparaît : la forêt ou le point en cours
  const initialView = place?.bbox
    ? { center: [(place.bbox[0] + place.bbox[1]) / 2, (place.bbox[2] + place.bbox[3]) / 2], zoom: 12 }
    : point
      ? { center: [point.lat, point.lon], zoom: 14 }
      : undefined;

  // En sortie, la carte passe devant : on replie le panneau.
  useEffect(() => {
    if (tracker.sortie.status === 'recording') setPanel('peek');
  }, [tracker.sortie.status]);

  const bySpeciesId = useMemo(() => Object.fromEntries(species.map((s) => [s.id, s])), [species]);
  const speciesNames = useMemo(() => Object.fromEntries(species.map((s) => [s.id, s.name])), [species]);
  // Espèces choisies : seulement les peuplements où l'une d'elles a une chance
  const shownZones = useMemo(() => {
    if (!zones.data || !Array.isArray(zones.data.features)) return null;
    if (!selection.length) return zones.data;
    const keep = (f) => selection.some((id) => zoneLevel(f.properties.scores?.[id] ?? 0));
    return { ...zones.data, features: zones.data.features.filter(keep) };
  }, [zones.data, selection]);

  const guideTo = (spot) => {
    setGuide({ lat: spot.lat, lon: spot.lon, label: spot.name });
    tracker.locate();
    setTab('carte');
    pickPoint(spot.lat, spot.lon); // centre la carte sur le coin et analyse le secteur
  };

  const showSpot = (spot) => {
    setTab('carte');
    pickPoint(spot.lat, spot.lon);
  };

  const onSpotAction = (action, spot) => {
    if (action === 'entry') setEntryFor(spot.id);
    if (action === 'guide') guideTo(spot);
    if (action === 'carnet') setTab('carnet');
  };
  const selectable = species.filter((s) => s.selectable);

  const searchBox = (
    <SearchBox
      current={place}
      onSelect={(p) => {
        setPlace(p);
        setZoneArea(areaFromPlace(p) ?? { ...circleBbox(p.lat, p.lon, Math.max(radius, 1.5)), label: null });
        setPoint({ lat: p.lat, lon: p.lon });
        setPanel('peek');
      }}
    />
  );

  const controls = (
    <div className="controls-block">
      <div className="picker" role="group" aria-label="Espèces affichées sur la carte">
        <button className={selection.length === 0 ? 'chip on' : 'chip'} onClick={() => setSelection([])}>Toutes</button>
        {selectable.map((s) => {
          const on = selection.includes(s.id);
          return (
            <button
              key={s.id}
              className={on ? 'chip on' : 'chip'}
              style={on ? { borderColor: speciesColor(s.id), background: `${speciesColor(s.id)}26` } : undefined}
              onClick={() => toggleSpecies(s.id)}
              disabled={!on && selection.length >= MAX_SELECTION}
              aria-pressed={on}
            >
              <i style={{ background: speciesColor(s.id) }} />
              {s.name.replace(/ \(.*\)/, '')}
            </button>
          );
        })}
      </div>
      <div className="controls-row">
        <label>
          Rayon d’analyse
          <select id="radius" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
            {[0.5, 1, 2, 3].map((r) => (
              <option key={r} value={r}>{r} km</option>
            ))}
          </select>
        </label>
        {point && (
          <button className={isSaved ? 'ghost on' : 'ghost'} onClick={toggleSaved}>
            {isSaved ? '★ Dans Mes forêts' : '☆ Enregistrer dans Mes forêts'}
          </button>
        )}
      </div>
    </div>
  );

  const details = (
    <>
      {!point && (
        <div className="empty">
          <p><strong>Cherche une forêt</strong> ou <strong>{mobile ? 'touche' : 'clique sur'} la carte</strong> pour analyser un secteur.</p>
          <p className="muted">Active la couche « Essences (BD Forêt) » pour repérer chênaies, hêtraies et pinèdes.</p>
        </div>
      )}
      {point && (
        <Analysis
          state={analysis}
          target={target}
          speciesById={bySpeciesId}
          onPickSpecies={(id) => setSelection([id])}
          onOpenSheet={(id) => setSheet(bySpeciesId[id])}
        >
          <Zones
            state={zones}
            selection={selection}
            onToggle={toggleSpecies}
            onClear={() => setSelection([])}
            speciesById={bySpeciesId}
            area={zoneArea}
            results={analysis.data?.results}
            days={analysis.data?.weather.days}
            show={showZones}
            onShow={setShowZones}
          />
        </Analysis>
      )}
      {point && <Access state={parkings} />}
      {point && target !== 'all' && <Observations data={observations} species={bySpeciesId[target]} />}
      <Offline
        map={leaflet}
        label={place?.name ?? (point ? `Secteur ${point.lat.toFixed(3)}, ${point.lon.toFixed(3)}` : null)}
        prefetch={() =>
          Promise.allSettled([
            point && api.analyze(point.lat, point.lon, radius),
            point && api.parkings(point.lat, point.lon),
            point && target !== 'all' && api.observations(target, point.lat, point.lon, 40),
            zoneArea && api.zones({ s: zoneArea.s, w: zoneArea.w, n: zoneArea.n, e: zoneArea.e }),
          ])
        }
      />
      <BeforeYouGo place={place} />
    </>
  );

  const map = (
    <section className="map-wrap">
      <MapView
        initialView={initialView}
        point={point}
        radius={radius}
        place={place}
        observations={observations?.items}
        parkings={parkings?.items}
        zones={showZones ? shownZones : null}
        zonesKey={`${selection.join(',')}:${zoneArea?.s},${zoneArea?.w}:${shownZones?.features.length}`}
        selection={selection}
        speciesNames={speciesNames}
        speciesBest={Object.fromEntries((zones.data?.species ?? []).map((s) => [s.id, s.best]))}
        tracker={tracker}
        spots={carnet.spots}
        follow={follow}
        onFollow={setFollow}
        onPick={pickPoint}
        onSpotAction={onSpotAction}
        onReady={setLeaflet}
      />
      <MapLegend selection={selection} speciesById={bySpeciesId} visible={showZones && !!shownZones?.features.length} />
      <TrackerPanel
        tracker={tracker}
        spots={carnet.spots}
        guide={guide}
        onClearGuide={() => setGuide(null)}
        onMarkSpot={(pos) => setEntryFor(carnet.addSpot(pos))}
        follow={follow}
        onFollow={setFollow}
        onAnalyzeHere={(p) => {
          pickPoint(p.lat, p.lon);
          setPanel('half');
        }}
      />
    </section>
  );

  return (
    <div className="app">
      <header className="topbar">
        {canGoBack && (
          <button className="back" onClick={() => window.history.back()} aria-label="Revenir en arrière" title="Revenir en arrière">←</button>
        )}
        <div className="brand">
          <span className="logo">🍄</span>
          <div>
            <h1>Champi</h1>
            <p>Où et quand chercher les champignons</p>
          </div>
        </div>
        <nav className="tabs">
          <button className={tab === 'carte' ? 'active' : ''} onClick={() => setTab('carte')}>Carte</button>
          <button className={tab === 'forets' ? 'active' : ''} onClick={() => setTab('forets')}>Forêts</button>
          <button className={tab === 'carnet' ? 'active' : ''} onClick={() => setTab('carnet')}>Carnet</button>
          <button className={tab === 'fiches' ? 'active' : ''} onClick={() => setTab('fiches')}>Fiches</button>
        </nav>
      </header>
      {!online && <div className="offline-banner">Hors ligne : affichage des données et cartes enregistrées. Le GPS continue de marcher.</div>}

      {tab === 'carte' && !mobile && (
        <main className={tracker.sortie.status === 'idle' ? 'map-layout' : 'map-layout tracking'}>
          <aside className="sidebar">
            {searchBox}
            {controls}
            {details}
          </aside>
          {map}
        </main>
      )}

      {tab === 'carte' && mobile && (
        <main className="m-layout" data-panel={panel}>
          {map}
          <div className="m-search">{searchBox}</div>
          <BottomSheet
            snap={panel}
            onSnap={setPanel}
            grip={<MobileSummary point={point} state={analysis} target={target} selection={selection} species={bySpeciesId[target]} zones={zones.data} speciesById={bySpeciesId} />}
          >
            {controls}
            {details}
          </BottomSheet>
        </main>
      )}

      {tab === 'fiches' && <SpeciesSheets species={species} onOpen={setSheet} />}

      {tab === 'forets' && <Forests forests={forests} speciesById={bySpeciesId} onOpen={openForest} />}

      {tab === 'carnet' && (
        <Carnet carnet={carnet} speciesById={bySpeciesId} onShowOnMap={showSpot} onGuide={guideTo} onAddEntry={setEntryFor} />
      )}

      {entryFor && carnet.spots.find((s) => s.id === entryFor) && (
        <EntryForm
          spot={carnet.spots.find((s) => s.id === entryFor)}
          species={species.filter((s) => s.selectable)}
          defaultSpecies={target === 'all' ? '' : target}
          onSave={(entry) => carnet.addEntry(entryFor, entry)}
          onClose={() => setEntryFor(null)}
        />
      )}

      {sheet && (
        <SpeciesDetail
          species={sheet}
          speciesById={bySpeciesId}
          onClose={() => setSheet(null)}
          onSearch={
            sheet.selectable
              ? () => {
                  setSelection([sheet.id]);
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
