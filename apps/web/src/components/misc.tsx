import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import type { PublicUser } from '@role/contracts';
import { centsToInput, initials, parseMoneyToCents, timeLeft } from '../lib/format';
import { Button } from './Button';
import { IconCopy } from './icons';
import { useToast } from './Toast';

/* ---------------------------------- Avatares ---------------------------------- */

const palette = [
  '#1a3d78',
  '#c2410c',
  '#0f766e',
  '#7c3aed',
  '#be123c',
  '#0369a1',
  '#a21caf',
  '#4d7c0f',
];
const colorFor = (id: string) =>
  palette[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % palette.length]!;

export function Avatar({ user, size = 36 }: { user: PublicUser; size?: number }) {
  return (
    <span
      title={user.name}
      aria-label={user.name}
      className="inline-grid shrink-0 place-items-center rounded-full font-extrabold text-white ring-2 ring-surface"
      style={{ width: size, height: size, background: colorFor(user.id), fontSize: size * 0.38 }}
    >
      {initials(user.name)}
    </span>
  );
}

export function AvatarStack({ users, max = 6 }: { users: PublicUser[]; max?: number }) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((u) => (
        <Avatar key={u.id} user={u} />
      ))}
      {extra > 0 && (
        <span className="z-0 grid size-9 place-items-center rounded-full bg-desk-deep text-xs font-extrabold text-ink ring-2 ring-surface">
          +{extra}
        </span>
      )}
    </div>
  );
}

/* ----------------------------------- Badges ----------------------------------- */

const tones = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-navy-soft text-navy-dark',
  sun: 'bg-sol-soft text-sol-ink',
  neutral: 'bg-desk-deep text-muted',
} as const;

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/* ---------------------------------- Contador ---------------------------------- */

export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function Countdown({ until, prefix = 'Faltam' }: { until: string; prefix?: string }) {
  const now = useNow();
  const { expired, label } = timeLeft(until, now);
  return (
    <span className={expired ? 'text-danger' : ''}>
      {expired ? 'Prazo encerrado' : `${prefix} ${label}`}
    </span>
  );
}

/* ------------------------------- Estados e ações ------------------------------- */

export function Spinner({ label = 'Carregando' }: { label?: string }) {
  return (
    <div className="grid place-items-center py-16" role="status" aria-label={label}>
      <span className="size-8 animate-spin rounded-full border-4 border-navy-soft border-t-navy" />
    </div>
  );
}

export function EmptyState({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="card px-6 py-10 text-center">
      <div
        className="mx-auto grid size-16 -rotate-3 place-items-center rounded-2xl bg-sol-soft text-4xl"
        aria-hidden
      >
        {emoji}
      </div>
      <h3 className="mt-4 text-lg">{title}</h3>
      {children && <div className="mt-2 text-muted">{children}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card px-6 py-10 text-center">
      <div
        className="mx-auto grid size-16 rotate-3 place-items-center rounded-2xl bg-carimbo-soft text-4xl"
        aria-hidden
      >
        🌧️
      </div>
      <p className="mt-3 font-bold">{message}</p>
      {onRetry && (
        <Button className="mt-4" variant="soft" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </div>
  );
}

export function CopyButton({ value, label = 'Copiar' }: { value: string; label?: string }) {
  const toast = useToast();
  return (
    <Button
      size="sm"
      variant="soft"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast.ok('Copiado!');
        } catch {
          toast.error('Não consegui copiar. Selecione e copie manualmente.');
        }
      }}
    >
      <IconCopy size={16} /> {label}
    </Button>
  );
}

/* ------------------------------------ Campos ----------------------------------- */

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-sm font-bold text-danger">{error}</span>
      ) : (
        hint && <span className="hint block">{hint}</span>
      )}
    </label>
  );
}

/** Campo de valor em reais: o usuário digita "120,50"; o estado do pai guarda centavos. */
export function MoneyInput({
  value,
  onChange,
  placeholder = '0,00',
  id,
}: {
  value: number | null;
  onChange: (cents: number | null) => void;
  placeholder?: string;
  id?: string;
}) {
  const [text, setText] = useState(centsToInput(value));
  useEffect(() => {
    // Só reescreve o texto quando o valor externo muda de fato (ex.: reset do formulário).
    if (parseMoneyToCents(text) !== value) setText(centsToInput(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-muted">
        R$
      </span>
      <input
        id={id}
        className="field pl-11"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          setText(e.target.value);
          onChange(parseMoneyToCents(e.target.value));
        }}
      />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
  icon,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-4 py-2 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}
    >
      <span className="flex items-center gap-2.5">
        {icon && <span className="text-muted">{icon}</span>}
        <span>
          <span className="block font-bold">{label}</span>
          {hint && <span className="hint block !mt-0">{hint}</span>}
        </span>
      </span>
      <span className="relative shrink-0">
        <input
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="block h-7 w-12 rounded-full bg-line transition-colors peer-checked:bg-ok peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-navy" />
        <span className="pointer-events-none absolute left-1 top-1 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
