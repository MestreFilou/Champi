import { Component } from 'react';

// Filet de sécurité : une erreur d'affichage montre un message au lieu d'un écran blanc.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Champi :', error, info.componentStack);
  }

  // Dernier recours : oublier la vue mémorisée et les réponses en cache, qui peuvent dater d'une ancienne version
  reset = async () => {
    try {
      localStorage.removeItem('champi.vue');
      for (const key of await caches.keys()) if (key.startsWith('champi-api')) await caches.delete(key);
    } catch {
      /* on recharge quand même */
    }
    location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash">
        <h2>Oups, l’affichage a planté</h2>
        <p>Tes coins, ton carnet et tes forêts enregistrées ne sont pas touchés.</p>
        <pre>{String(this.state.error?.message ?? this.state.error)}</pre>
        <div className="tracker-row">
          <button className="primary" onClick={() => location.reload()}>Recharger</button>
          <button className="ghost" onClick={this.reset}>Repartir de zéro</button>
        </div>
        <p className="muted small">Si ça recommence, envoie une capture de ce message.</p>
      </div>
    );
  }
}
