import { useRef, useState } from 'react';

// Panneau du bas sur téléphone, à trois crans : réduit (résumé), moitié, plein écran.
// On le tire par la poignée ou le résumé ; un simple toucher passe au cran suivant.
const NEXT = { peek: 'half', half: 'full', full: 'peek' };

export default function BottomSheet({ snap, onSnap, grip, children }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const [height, setHeight] = useState(null); // hauteur en cours de glissement, sinon celle du cran

  const onPointerDown = (e) => {
    drag.current = { y: e.clientY, h: ref.current.offsetHeight, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.y - e.clientY;
    if (Math.abs(dy) > 6) d.moved = true;
    if (!d.moved) return;
    const max = ref.current.parentElement.clientHeight;
    setHeight(Math.min(max, Math.max(96, d.h + dy)));
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      onSnap(NEXT[snap]);
      return;
    }
    // Cran le plus proche de la hauteur où on a lâché
    const max = ref.current.parentElement.clientHeight;
    const h = height ?? d.h;
    const ratio = h / max;
    onSnap(ratio < 0.3 ? 'peek' : ratio < 0.72 ? 'half' : 'full');
    setHeight(null);
  };

  return (
    <section
      ref={ref}
      className={`sheet sheet-${snap}${height != null ? ' dragging' : ''}`}
      style={height != null ? { height } : undefined}
      aria-label="Analyse du secteur"
    >
      <div
        className="sheet-grip"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="button"
        tabIndex={0}
        aria-label={snap === 'full' ? 'Réduire le panneau' : 'Agrandir le panneau'}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSnap(NEXT[snap])}
      >
        <span className="sheet-handle" />
        {grip}
      </div>
      <div className="sheet-body">{children}</div>
    </section>
  );
}
