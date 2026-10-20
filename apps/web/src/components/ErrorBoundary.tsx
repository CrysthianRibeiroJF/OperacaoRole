import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../lib/telemetry';
import { Button } from './Button';

/** Última rede de proteção: uma falha de tela não deixa o app em branco. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(
      Object.assign(error, { stack: `${error.stack ?? ''}${info.componentStack ?? ''}` }),
    );
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="mx-auto grid min-h-dvh max-w-sm place-content-center gap-4 p-6 text-center">
        <p className="eyebrow">Ocorrência registrada</p>
        <h1 className="font-display text-3xl font-extrabold">Algo escapou do controle</h1>
        <p className="text-muted">
          Já anotamos o problema. Recarregue a página; se continuar, volte daqui a pouco.
        </p>
        <Button onClick={() => window.location.assign('/')}>Voltar ao início</Button>
      </main>
    );
  }
}
