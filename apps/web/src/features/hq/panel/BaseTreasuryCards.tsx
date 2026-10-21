import type { BasePanel, TreasuryPanel } from '@role/contracts';
import { Badge } from '../../../components/misc';
import { formatBRL } from '../../../lib/format';
import { ProgressBar, Stat, TabLink, toneFor } from './parts';

/** Painel do General da Base: o que já está preenchido e quem ainda está sem cama. */
export function BasePanelCard({ data }: { data: BasePanel }) {
  return (
    <section className="card space-y-4 p-5">
      <div>
        <p className="eyebrow">General da Base</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <h2>Base</h2>
          <p className="mono text-2xl font-semibold leading-none">{data.percent}%</p>
        </div>
        <div className="mt-3">
          <ProgressBar
            percent={data.percent}
            tone={toneFor(data.percent)}
            label="Prontidão da Base"
          />
        </div>
      </div>

      <ul className="flex flex-wrap gap-1.5" aria-label="Informações da Base">
        {data.info.map((i) => (
          <li key={i.key}>
            <Badge tone={i.done ? 'ok' : 'neutral'}>
              {i.done ? '✓' : '○'} {i.label}
            </Badge>
          </li>
        ))}
      </ul>

      {data.rooms.total > 0 ? (
        <div className="space-y-2">
          <h3 className="text-base">Quartos</h3>
          <p className="text-sm text-muted">
            {data.rooms.total} {data.rooms.total === 1 ? 'quarto' : 'quartos'}, {data.rooms.beds}{' '}
            camas de solteiro{data.rooms.doubleBeds > 0 && ` e ${data.rooms.doubleBeds} de casal`},{' '}
            {data.rooms.occupied} confirmações alocadas.
          </p>
          {data.withoutBed.length > 0 && (
            <p className="text-sm">
              Sem cama:{' '}
              <strong>{data.withoutBed.map((u) => u.name.split(' ')[0]).join(', ')}</strong>
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">Nenhum quarto cadastrado ainda.</p>
      )}

      <TabLink tab="base">Abrir a Base</TabLink>
    </section>
  );
}

/** Painel do General do Tesouro: sinais por situação e a fotografia das despesas. */
export function TreasuryPanelCard({ data }: { data: TreasuryPanel }) {
  const d = data.deposit;
  const e = data.expenses;
  return (
    <section className="card space-y-4 p-5">
      <div>
        <p className="eyebrow">General do Tesouro</p>
        <h2 className="mt-2">Tesouro</h2>
        {data.settled && (
          <p className="mt-1 text-sm font-bold text-ok">
            Conta fechada. Os números são definitivos.
          </p>
        )}
      </div>

      {d.required && d.open ? (
        <div className="space-y-2.5">
          <h3 className="text-base">Sinal por Pix</h3>
          <dl className="grid grid-cols-2 gap-2.5">
            <Stat
              label="Aprovados"
              value={d.approved}
              hint={`${formatBRL(d.collectedCents)} recebidos`}
            />
            <Stat label="Em análise" value={d.submitted} hint="comprovante enviado" />
            <Stat
              label="Faltam pagar"
              value={d.pending + d.rejected}
              hint={`${d.rejected} recusado(s)`}
            />
            <Stat label="Fila de espera" value={d.waitlisted} hint="perdeu o prazo" />
          </dl>
        </div>
      ) : (
        <p className="text-sm text-muted">
          {d.required
            ? 'A janela do sinal abre quando o rolê for confirmado.'
            : 'Este rolê não pede sinal.'}
        </p>
      )}

      <div className="space-y-2.5">
        <h3 className="text-base">Despesas</h3>
        <dl className="grid grid-cols-2 gap-2.5">
          <Stat
            label="Aprovadas"
            value={formatBRL(e.approvedCents)}
            hint={`${e.count} lançamento(s)`}
          />
          <Stat
            label="Por cabeça"
            value={e.perHeadCents === null ? '—' : formatBRL(e.perHeadCents)}
            hint="média do que já foi gasto"
          />
          <Stat label="A aprovar" value={e.pendingCount} hint="acima do limite" />
          <Stat label="Contestações" value={e.openContests} hint="abertas" />
        </dl>
      </div>

      <TabLink tab="cofre">Abrir o Cofre</TabLink>
    </section>
  );
}
