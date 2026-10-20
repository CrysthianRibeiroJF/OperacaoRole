import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type Tone = 'ok' | 'error';
interface ToastItem {
  id: number;
  tone: Tone;
  text: string;
}

interface ToastApi {
  ok: (text: string) => void;
  error: (text: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((tone: Tone, text: string) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, tone, text }]);
    setTimeout(
      () => setItems((prev) => prev.filter((t) => t.id !== id)),
      tone === 'error' ? 6000 : 3500,
    );
  }, []);

  const api = useMemo<ToastApi>(
    () => ({ ok: (t) => push('ok', t), error: (t) => push('error', t) }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4"
        role="status"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm font-bold shadow-lg ${
              t.tone === 'ok' ? 'bg-ink text-white' : 'bg-danger text-white'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast fora do ToastProvider');
  return ctx;
}
