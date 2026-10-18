import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

export default function SearchBox({ onSelect }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const timer = useRef();
  const picked = useRef(null);

  // Debounce : Nominatim limite à 1 requête/s.
  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 3 || q === picked.current) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(() => {
      setLoading(true);
      setError(null);
      api
        .search(q)
        .then((r) => {
          setResults(r);
          setOpen(true);
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 600);
    return () => clearTimeout(timer.current);
  }, [q]);

  return (
    <div className="search">
      <input
        type="search"
        placeholder="Forêt de Fontainebleau, bois de…, commune"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
      />
      {loading && <span className="search-spinner" />}
      {error && <p className="error small">{error}</p>}
      {open && results.length > 0 && (
        <ul className="search-results">
          {results.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => {
                  onSelect(r);
                  setOpen(false);
                  picked.current = r.name;
                  setQ(r.name);
                }}
              >
                <span className="result-icon">{r.isForest ? '🌲' : '📍'}</span>
                <span>
                  <strong>{r.name}</strong>
                  <small>{r.label}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
