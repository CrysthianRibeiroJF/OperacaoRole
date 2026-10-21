import type { OverviewPanel } from '@role/contracts';
import { ROLE_LABELS } from '@role/domain';
import { Badge } from '../../../components/misc';
import { ProgressBar, TabLink, toneFor } from './parts';

const ALERT_STYLE = {
  danger: 'bg-danger-soft text-danger',
  warn: 'bg-warn-soft text-warn',
  info: 'bg-navy-soft text-navy-dark',
} as const;

/** Visão geral do Idealizador: quão pronto está o rolê, área por área, e o que pede atenção agora. */
export function OverviewCard({ overview }: { overview: OverviewPanel }) {
  return (
    <section className="card space-y-5 p-5">
      <div>
        <p className="eyebrow">Visão do Idealizador</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <h2>Rolê pronto</h2>
          <p className="mono text-3xl font-semibold leading-none">{overview.percent}%</p>
        </div>
        <div className="mt-3">
          <ProgressBar
            percent={overview.percent}
            tone={toneFor(overview.percent)}
            label="Prontidão geral do rolê"
          />
        </div>
      </div>

      {overview.alerts.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-base">Precisa de atenção</h3>
          <ul className="space-y-2">
            {overview.alerts.map((a) => (
              <li
                key={a.key}
                className={`flex items-start justify-between gap-3 rounded-xl p-3 text-sm font-bold ${ALERT_STYLE[a.tone]}`}
              >
                <span>{a.text}</span>
                <TabLink tab={a.tab}>Abrir</TabLink>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-xl bg-ok-soft p-3 text-sm font-bold text-ok">
          Nada pedindo atenção agora.
        </p>
      )}

      <div className="space-y-3">
        <h3 className="text-base">Por área</h3>
        <ul className="space-y-3">
          {overview.parts.map((p) => (
            <li key={p.key} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-bold">{p.label}</span>
                <span className="mono text-sm font-semibold">{p.percent}%</span>
              </div>
              <ProgressBar percent={p.percent} tone={toneFor(p.percent)} label={p.label} />
              <div className="flex items-center justify-between gap-3 text-xs text-muted">
                <span>{p.hint}</span>
                <TabLink tab={p.tab}>Ver</TabLink>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {overview.vacantRoles.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          Cargos vagos que você cobre:
          {overview.vacantRoles.map((r) => (
            <Badge key={r} tone="sun">
              {ROLE_LABELS[r]}
            </Badge>
          ))}
        </p>
      )}
    </section>
  );
}
