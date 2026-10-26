import { Component, type ReactNode } from 'react';

/** Affiche une erreur lisible au lieu d'un écran vide ; les données ne sont pas affectées. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card danger stack">
        <h2>Cette page a rencontré un problème</h2>
        <p className="small">{this.state.error.message}</p>
        <p className="small">Vos données sont intactes. Revenez à l’accueil ou rechargez l’application.</p>
        <div className="btn-row">
          <a className="btn" href="#/">Accueil</a>
          <button className="btn primary" onClick={() => window.location.reload()}>Recharger</button>
        </div>
      </div>
    );
  }
}
