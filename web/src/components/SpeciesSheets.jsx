import { useState } from 'react';
import { edibility, MONTHS } from '../format.js';

export default function SpeciesSheets({ species, onOpen }) {
  const [q, setQ] = useState('');
  const match = (s) => `${s.name} ${s.latin} ${s.group}`.toLowerCase().includes(q.toLowerCase());
  const edible = species.filter((s) => s.selectable && match(s));
  const deadly = species.filter((s) => !s.selectable && match(s));

  return (
    <main className="sheets">
      <div className="warning-banner">
        ⚠️ Ces fiches aident à reconnaître, elles ne remplacent pas un avis expert. <strong>Ne consomme jamais un champignon sans
        certitude absolue</strong> : fais vérifier ta récolte par un pharmacien ou une association mycologique. En cas de malaise
        après un repas de champignons : <strong>15</strong> ou centre antipoison.
      </div>
      <input className="sheet-filter" type="search" placeholder="Filtrer (nom, latin, famille)…" value={q} onChange={(e) => setQ(e.target.value)} />

      <h2>Comestibles recherchés</h2>
      <div className="grid">{edible.map((s) => <SheetCard key={s.id} s={s} onOpen={onOpen} />)}</div>

      <h2 className="deadly-title">Mortels : à connaître absolument</h2>
      <div className="grid">{deadly.map((s) => <SheetCard key={s.id} s={s} onOpen={onOpen} />)}</div>
    </main>
  );
}

function SheetCard({ s, onOpen }) {
  const e = edibility(s.edibility);
  return (
    <button className={`sheet-card tone-${e.tone}`} onClick={() => onOpen(s)}>
      <div className="sheet-photo" style={s.taxon?.photo ? { backgroundImage: `url(${s.taxon.photo})` } : undefined}>
        {!s.taxon?.photo && '🍄'}
      </div>
      <div className="sheet-body">
        <strong>{s.name}</strong>
        <em>{s.latin}</em>
        <span className={`badge tone-${e.tone}`}>{e.label}</span>
        <div className="months">
          {MONTHS.map((m, i) => (
            <span key={i} className={s.months.includes(i + 1) ? 'on' : ''}>{m}</span>
          ))}
        </div>
      </div>
    </button>
  );
}
