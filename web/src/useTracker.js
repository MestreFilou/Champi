import { useCallback, useEffect, useRef, useState } from 'react';
import { distance } from './geo.js';

// Suivi GPS d'une sortie : position en direct et trace enregistrée (les coins vivent dans le carnet).
// La trace est gardée dans le navigateur (localStorage) : un rechargement ne perd rien.

const TRACK_KEY = 'champi.sortie';
const MAX_ACCURACY = 40; // m : au-delà, le point s'affiche mais n'entre pas dans la trace

const load = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage plein ou bloqué : on continue sans sauvegarde */
  }
};

const EMPTY = { status: 'idle', track: [], startedAt: null, endedAt: null };

export function useTracker() {
  // Une sortie en cours au moment d'un rechargement repart en pause : le GPS ne se relance qu'à la demande.
  const [sortie, setSortie] = useState(() => {
    const s = load(TRACK_KEY, EMPTY);
    return s.status === 'recording' ? { ...s, status: 'paused' } : s;
  });
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const watchId = useRef(null);
  const wakeLock = useRef(null);
  const recording = useRef(false);

  useEffect(() => save(TRACK_KEY, sortie), [sortie]);

  const onPosition = useCallback((p) => {
    const pt = { lat: p.coords.latitude, lon: p.coords.longitude, acc: Math.round(p.coords.accuracy), alt: p.coords.altitude, t: p.timestamp };
    setPosition(pt);
    setError(null);
    if (!recording.current || pt.acc > MAX_ACCURACY) return;
    setSortie((s) => {
      const last = s.track[s.track.length - 1];
      // On ignore le « tremblement » du GPS à l'arrêt : il faut avoir bougé de plus que l'imprécision.
      if (last && distance(last, pt) < Math.max(5, pt.acc / 2)) return s;
      return { ...s, track: [...s.track, pt] };
    });
  }, []);

  const onError = useCallback((e) => {
    const msg = {
      1: 'Accès à la position refusé. Autorise la localisation pour ce site dans les réglages du navigateur.',
      2: 'Position introuvable (pas de signal GPS ?).',
      3: 'Le GPS met trop de temps à répondre, nouvel essai…',
    }[e.code];
    setError(msg || e.message);
  }, []);

  const keepAwake = useCallback(async () => {
    try {
      wakeLock.current = await navigator.wakeLock?.request('screen');
    } catch {
      /* refusé (batterie faible…) : pas bloquant */
    }
  }, []);

  const watch = useCallback(() => {
    if (!window.isSecureContext) {
      setError('Le GPS ne marche qu’en HTTPS (ou sur localhost). Lance « npm run dev:mobile » pour l’ouvrir depuis le téléphone.');
      return false;
    }
    if (!navigator.geolocation) {
      setError('Ce navigateur ne donne pas accès à la position.');
      return false;
    }
    if (watchId.current == null) {
      watchId.current = navigator.geolocation.watchPosition(onPosition, onError, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30_000 });
    }
    return true;
  }, [onPosition, onError]);

  const unwatch = useCallback(() => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
  }, []);

  // Position seule, sans enregistrer de trace
  const locate = useCallback(() => watch(), [watch]);

  const start = useCallback(() => {
    if (!watch()) return;
    recording.current = true;
    keepAwake();
    setSortie((s) => (s.status === 'paused' ? { ...s, status: 'recording' } : { ...EMPTY, status: 'recording', startedAt: Date.now() }));
  }, [watch, keepAwake]);

  const pause = useCallback(() => {
    recording.current = false;
    setSortie((s) => ({ ...s, status: 'paused' }));
  }, []);

  const stop = useCallback(() => {
    recording.current = false;
    unwatch();
    setSortie((s) => ({ ...s, status: 'done', endedAt: Date.now() }));
  }, [unwatch]);

  const reset = useCallback(() => {
    recording.current = false;
    setSortie(EMPTY);
  }, []);

  // L'écran verrouillé libère le wake lock : on le reprend au retour sur l'appli.
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && recording.current && keepAwake();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      unwatch();
    };
  }, [keepAwake, unwatch]);

  return { sortie, position, error, locate, start, pause, stop, reset };
}
