import { useEffect, useState } from 'react';

// Téléphone = écran étroit. On suit la largeur plutôt que le modèle d'appareil :
// une tablette en portrait ou une fenêtre réduite profitent aussi de l'ergonomie mobile.
const QUERY = '(max-width: 820px)';

export function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = (e) => setMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
}
