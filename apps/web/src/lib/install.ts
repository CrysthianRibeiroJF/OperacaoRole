import { useCallback, useEffect, useState } from 'react';
import { track } from './telemetry';

/**
 * Instalação do app na tela inicial.
 * - Android e desktop (Chrome, Edge): o navegador dispara `beforeinstallprompt`; guardamos o evento e abrimos o diálogo no clique.
 * - iPhone e iPad (Safari): não existe diálogo; mostramos o caminho "Compartilhar > Adicionar à Tela de Início".
 */
export type Platform = 'ios' | 'android' | 'desktop';

export function detectPlatform(userAgent: string, maxTouchPoints = 0): Platform {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios';
  // iPadOS 13+ se apresenta como Mac, mas tem tela de toque.
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return 'ios';
  if (/Android/.test(userAgent)) return 'android';
  return 'desktop';
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const DISMISS_KEY = 'role-install-dismissed';
const DISMISS_DAYS = 14;

/** Chame uma vez na partida do app, antes de qualquer tela. */
export function initInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return !!at && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

export type InstallState =
  | { kind: 'hidden' }
  | { kind: 'prompt' } // dá para abrir o diálogo do navegador
  | { kind: 'ios' }; // só instruções

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);

  let state: InstallState = { kind: 'hidden' };
  if (!isStandalone() && !recentlyDismissed()) {
    if (deferred) state = { kind: 'prompt' };
    else if (detectPlatform(navigator.userAgent, navigator.maxTouchPoints) === 'ios')
      state = { kind: 'ios' };
  }

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') track('install_accepted');
    deferred = null;
    listeners.forEach((l) => l());
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* sem armazenamento (modo privado): o aviso volta na próxima visita */
    }
    force((n) => n + 1);
  }, []);

  return { state, install, dismiss };
}
