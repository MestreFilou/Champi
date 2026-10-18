import { useState } from 'react';
import { shrinkImage } from '../photos.js';

// Fiche de récolte : ce qu'on a trouvé à un coin.
export default function EntryForm({ spot, species, defaultSpecies, onSave, onClose }) {
  const [sp, setSp] = useState(defaultSpecies || '');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const pickPhoto = async (file) => {
    if (!file) return;
    try {
      const small = await shrinkImage(file);
      setPhoto(small);
      setPreview(URL.createObjectURL(small));
    } catch {
      setError('Impossible de lire cette photo.');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ species: sp || null, qty: qty.trim(), note: note.trim(), photoFile: photo });
      onClose();
    } catch (err) {
      setError(`Enregistrement impossible : ${err.message}`);
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal entry-form" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
        <h2>Récolte · {spot.name}</h2>
        <label>
          Espèce
          <select id="entry-species" value={sp} onChange={(e) => setSp(e.target.value)}>
            <option value="">Je ne sais pas encore</option>
            {species.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label>
          Quantité
          <input id="entry-qty" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="500 g, une poignée, 12 pieds…" />
        </label>
        <label>
          Note
          <textarea id="entry-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Au pied des vieux chênes, en bordure du chemin…" />
        </label>
        <label className="photo-pick">
          {preview ? <img src={preview} alt="Aperçu de la photo" /> : <span>📷 Ajouter une photo</span>}
          <input id="entry-photo" type="file" accept="image/*" capture="environment" onChange={(e) => pickPhoto(e.target.files[0])} />
        </label>
        {error && <p className="error small">{error}</p>}
        <div className="tracker-row">
          <button className="primary" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          <button className="ghost" type="button" onClick={onClose}>Plus tard</button>
        </div>
        <p className="muted small">Une photo ne remplace pas une identification : fais vérifier avant de consommer.</p>
      </form>
    </div>
  );
}
