import type { StopDto } from '@role/contracts';
import { STOP_KIND_LABELS, type PanelTab } from '@role/domain';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconCar, IconClock, IconPin } from '../../../components/icons';

/** Barra de progresso acessível: o valor também vai por texto, nunca só pela cor. */
export function ProgressBar({
  percent,
  tone = 'navy',
  label,
}: {
  percent: number;
  tone?: 'navy' | 'ok' | 'warn' | 'danger';
  label: string;
}) {
  const color = { navy: 'bg-navy', ok: 'bg-ok', warn: 'bg-warn', danger: 'bg-danger' }[tone];
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 overflow-hidden rounded-full bg-desk-deep"
    >
      <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

/** Verde quando pronto, âmbar no meio do caminho, vermelho quando está no começo. */
export const toneFor = (percent: number): 'ok' | 'warn' | 'danger' =>
  percent >= 100 ? 'ok' : percent >= 50 ? 'warn' : 'danger';

/** Leva para outra aba do QG mantendo a página. */
export function TabLink({ tab, children }: { tab: PanelTab; children: ReactNode }) {
  return (
    <Link
      to={{ search: `?aba=${tab}` }}
      replace
      className="inline-flex min-h-9 items-center text-sm font-bold text-navy-dark underline"
    >
      {children}
    </Link>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-desk-deep p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mono mt-0.5 text-lg font-semibold leading-tight">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const STOP_ICONS = {
  meeting: <IconPin size={16} />,
  stop: <IconClock size={16} />,
  rideshare: <IconCar size={16} />,
  return: <IconPin size={16} />,
} as const;

/** Linha do tempo dos pontos de encontro e paradas, já em ordem de horário. */
export function StopsTimeline({ stops }: { stops: StopDto[] }) {
  if (stops.length === 0) return null;
  return (
    <ol className="space-y-2">
      {stops.map((s) => (
        <li key={s.id} className="flex gap-3 rounded-xl bg-desk-deep p-3">
          <span className="mt-0.5 text-navy">{STOP_ICONS[s.kind]}</span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-2 font-bold">
              {s.time && <span className="mono text-sm">{s.time}</span>}
              {s.name}
            </p>
            <p className="text-xs text-muted">
              {STOP_KIND_LABELS[s.kind]}
              {s.address && ` · ${s.address}`}
            </p>
            {s.note && <p className="mt-0.5 text-sm">{s.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
