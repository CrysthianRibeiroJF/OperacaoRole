import { useEffect } from 'react';
import { useInstall } from '../lib/install';
import { track } from '../lib/telemetry';
import { Button } from './Button';
import { IconShare, Swallow } from './icons';

/** Convite para instalar o app: botão no Android e desktop, passo a passo no iPhone. Dispensável por 14 dias. */
export function InstallBanner() {
  const { state, install, dismiss } = useInstall();
  const visible = state.kind !== 'hidden';
  useEffect(() => {
    if (visible) track('install_shown', { once: 'banner' });
  }, [visible]);
  if (!visible) return null;

  return (
    <aside className="card flex items-start gap-3 p-4" aria-label="Instalar o app">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sol text-on-sol">
        <Swallow size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-extrabold">Tenha o Rolê na tela inicial</p>
        {state.kind === 'prompt' ? (
          <>
            <p className="mt-0.5 text-sm text-muted">
              Abre rápido, em tela cheia e funciona como um app de verdade.
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => void install()}>
                Instalar
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>
                Agora não
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-0.5 text-sm text-muted">
              No Safari, toque em <IconShare size={15} className="inline align-[-3px]" />{' '}
              <strong className="text-ink">Compartilhar</strong> e depois em{' '}
              <strong className="text-ink">Adicionar à Tela de Início</strong>.
            </p>
            <div className="mt-3">
              <Button size="sm" variant="ghost" onClick={dismiss}>
                Entendi
              </Button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
