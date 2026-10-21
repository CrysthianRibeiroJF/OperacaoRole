import type { MyPanel } from '@role/contracts';
import { IconCheck } from '../../../components/icons';
import { Badge } from '../../../components/misc';
import { formatBRL } from '../../../lib/format';
import { ProgressBar, StopsTimeline, TabLink, toneFor } from './parts';

const RIDE_LABEL = {
  driver: 'Você dirige',
  passenger: 'Lugar no carro',
  app: 'De app (Uber, 99, táxi)',
  own: 'Por conta própria',
  none: 'Ainda sem definição',
} as const;

const DEPOSIT_LABEL = {
  none: '—',
  pending: 'Falta pagar',
  submitted: 'Em análise',
  approved: 'Aprovado',
  rejected: 'Comprovante recusado',
  waitlisted: 'Na fila de espera',
} as const;

/** Acompanhamento de cada andorinha: o que já está resolvido, o que falta e para onde ir agora. */
export function MineCard({ data, confirmed }: { data: MyPanel; confirmed: boolean }) {
  const net = data.finance.projectedNetCents;
  return (
    <section className="card space-y-5 p-5">
      <div>
        <p className="eyebrow">Seu andamento</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <h2>Meu acompanhamento</h2>
          {data.steps.length > 0 && (
            <p className="mono text-2xl font-semibold leading-none">{data.percent}%</p>
          )}
        </div>
        {data.steps.length > 0 && (
          <div className="mt-3">
            <ProgressBar
              percent={data.percent}
              tone={toneFor(data.percent)}
              label="Seu andamento no rolê"
            />
          </div>
        )}
      </div>

      {data.steps.length === 0 ? (
        <p className="text-sm text-muted">
          {confirmed
            ? 'Nada para resolver agora.'
            : 'O acompanhamento começa quando o rolê for confirmado: sinal, transporte, cama e bagagem.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {data.steps.map((s) => (
            <li
              key={s.key}
              className={`flex items-center justify-between gap-3 rounded-xl p-3 ${s.done ? 'bg-ok-soft' : 'bg-desk-deep'}`}
            >
              <span
                className={`flex items-start gap-2 text-sm ${s.done ? 'text-ok' : 'font-bold'}`}
              >
                {s.done ? <IconCheck size={17} /> : <span aria-hidden>○</span>}
                <span>{s.label}</span>
              </span>
              {!s.done && <TabLink tab={s.tab}>Resolver</TabLink>}
            </li>
          ))}
        </ul>
      )}

      <dl className="grid grid-cols-2 gap-2.5 text-sm">
        {data.deposit.required && (
          <div className="rounded-xl bg-desk-deep p-3">
            <dt className="text-xs text-muted">Sinal</dt>
            <dd className="font-bold">{DEPOSIT_LABEL[data.deposit.status]}</dd>
            {data.deposit.amountCents && (
              <p className="text-xs text-muted">{formatBRL(data.deposit.amountCents)}</p>
            )}
          </div>
        )}
        <div className="rounded-xl bg-desk-deep p-3">
          <dt className="text-xs text-muted">Como eu vou</dt>
          <dd className="font-bold">{RIDE_LABEL[data.ride.mode]}</dd>
          {data.ride.vehicleLabel && (
            <p className="text-xs text-muted">
              {data.ride.vehicleLabel}
              {data.ride.departureTime && ` · sai às ${data.ride.departureTime}`}
              {data.ride.departurePlace && ` de ${data.ride.departurePlace}`}
            </p>
          )}
        </div>
        <div className="rounded-xl bg-desk-deep p-3">
          <dt className="text-xs text-muted">Minha cama</dt>
          <dd className="font-bold">{data.room ?? 'Sem cama'}</dd>
        </div>
        <div className="rounded-xl bg-desk-deep p-3">
          <dt className="text-xs text-muted">Bagagem</dt>
          <dd className="font-bold">
            {data.packing.total === 0
              ? 'Sem lista'
              : `${data.packing.done} de ${data.packing.total}`}
          </dd>
        </div>
      </dl>

      {data.items.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-base">O que eu levo</h3>
          <ul className="flex flex-wrap gap-1.5">
            {data.items.map((i) => (
              <li key={i.id}>
                <Badge tone={i.done ? 'ok' : 'sun'}>
                  {i.done ? '✓' : '○'} {i.name}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      {confirmed && (
        <div className="rounded-xl bg-navy-soft p-3 text-sm">
          <p className="text-navy-dark">
            Minha parte até agora: <strong>{formatBRL(data.finance.projectedShareCents)}</strong>
            {data.finance.paidByMeCents > 0 && (
              <>
                {' '}
                · já adiantei <strong>{formatBRL(data.finance.paidByMeCents)}</strong>
              </>
            )}
          </p>
          <p className="mt-0.5 font-bold text-navy-dark">
            {net === 0
              ? 'Estou quite.'
              : net > 0
                ? `A receber ${formatBRL(net)}.`
                : `A pagar ${formatBRL(-net)}.`}
          </p>
        </div>
      )}

      {data.stops.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-base">Para onde ir</h3>
          <StopsTimeline stops={data.stops} />
        </div>
      )}
      {data.checkoutTime && (
        <p className="text-sm text-muted">
          Saída da casa: <strong className="text-ink">{data.checkoutTime}</strong>
        </p>
      )}
    </section>
  );
}
