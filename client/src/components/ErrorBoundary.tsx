import { Component, type ReactNode } from 'react';
import { Button, Card } from './ui';

/** Affiche un message plutôt qu'une page vide si un composant plante */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Card className="mx-auto mt-16 max-w-md space-y-4 text-center">
        <p className="text-lg font-bold">Oups, quelque chose a planté.</p>
        <p className="text-sm text-zinc-400">{this.state.error.message}</p>
        <Button onClick={() => location.reload()}>Recharger</Button>
      </Card>
    );
  }
}
