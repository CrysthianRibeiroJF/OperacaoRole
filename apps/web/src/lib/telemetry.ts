import type { TRACKED_EVENTS } from '@role/contracts';

type TrackedEvent = (typeof TRACKED_EVENTS)[number];

const MAX_ERRORS_PER_SESSION = 5;
let errorsSent = 0;
const seen = new Set<string>();

function send(path: string, body: object) {
  try {
    const data = JSON.stringify(body);
    // Fire-and-forget: telemetria nunca atrasa nem quebra a tela. `keepalive` sobrevive à navegação.
    void fetch(`/api/telemetry/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: data,
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => undefined);
  } catch {
    /* sem rede ou bloqueado: segue a vida */
  }
}

/** Registra um evento do funil. Com `once`, no máximo uma vez por aba e por chave (ex.: o código do convite). */
export function track(name: TrackedEvent, opts: { once?: string } = {}) {
  if (opts.once) {
    const key = `${name}:${opts.once}`;
    if (seen.has(key)) return;
    seen.add(key);
  }
  send('track', { name, path: location.pathname.slice(0, 200) });
}

/** Avisa o servidor de um erro do app. Limitado a poucos por sessão para não virar tempestade. */
export function reportError(error: unknown) {
  if (errorsSent >= MAX_ERRORS_PER_SESSION) return;
  errorsSent++;
  const err = error instanceof Error ? error : new Error(String(error));
  send('error', {
    message: (err.message || err.name || 'Erro desconhecido').slice(0, 300),
    stack: err.stack?.slice(0, 2000),
    path: location.pathname.slice(0, 200),
  });
}

export function initTelemetry() {
  window.addEventListener('error', (e) => reportError(e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason));
}
