import type { FleetPanel } from '@role/contracts';
import { Badge } from '../../../components/misc';
import { formatBRL } from '../../../lib/format';
import { ProgressBar, Stat, StopsTimeline, TabLink, toneFor } from './parts';

const firstNames = (users: { name: string }[]) => users.map((u) => u.name.split(' ')[0]).join(', ');

/** Painel do General da Frota: quem vai como, lugares, Uber, pontos de encontro e horários. */
export function FleetPanelCard({ data }: { data: FleetPanel }) {
  return (
    <section className="card space-y-5 p-5">
      <div>
        <p className="eyebrow">General da Frota</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <h2>Transporte</h2>
          <p className="mono text-2xl font-semibold leading-none">{data.percentCovered}%</p>
        </div>
        <div className="mt-3">
          <ProgressBar
            percent={data.percentCovered}
            tone={toneFor(data.percentCovered)}
            label="Pessoas com transporte definido"
          />
        </div>
        <p className="mt-1.5 text-xs text-muted">
          {data.headcount - data.undecided} de {data.headcount} com transporte definido
        </p>
      </div>

      {data.seatShortfall > 0 && (
        <p className="rounded-xl bg-danger-soft p-3 text-sm font-bold text-danger">
          Faltam {data.seatShortfall} {data.seatShortfall === 1 ? 'lugar' : 'lugares'} nos carros
          para quem ainda não se resolveu. Chame mais carros ou combine app.
        </p>
      )}

      <dl className="grid grid-cols-2 gap-2.5">
        <Stat label="Carros" value={data.vehicles.length} hint={`${data.drivers} motorista(s)`} />
        <Stat
          label="Lugares livres"
          value={`${data.seatsFree}/${data.seatsTotal}`}
          hint="nos carros cadastrados"
        />
        <Stat label="Vão de app" value={data.appRiders} hint="Uber, 99, táxi" />
        <Stat label="Conta própria" value={data.ownRiders} hint="vão por fora" />
      </dl>

      <div className="space-y-2">
        <h3 className="text-base">Pontos de encontro e paradas</h3>
        {data.stops.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhum ponto ainda. Cadastre o ponto de encontro, as paradas e onde chamar o app, na aba
            Frotas.
          </p>
        ) : (
          <StopsTimeline stops={data.stops} />
        )}
      </div>

      {data.vehicles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-base">Saída de cada carro</h3>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {data.vehicles.map((v) => (
              <li key={v.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-bold">{v.label}</p>
                  <p className="text-xs text-muted">
                    {v.driver.name.split(' ')[0]} dirige
                    {v.departureTime && ` · sai às ${v.departureTime}`}
                    {v.departurePlace && ` de ${v.departurePlace}`}
                  </p>
                </div>
                <Badge tone={v.taken >= v.seats ? 'ok' : 'neutral'}>
                  {v.taken}/{v.seats} lugares
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2.5">
        <h3 className="text-base">Quem vai de app</h3>
        {data.appRiderUsers.length === 0 ? (
          <p className="text-sm text-muted">Ninguém declarou app até agora.</p>
        ) : (
          <p className="text-sm">
            <strong>{firstNames(data.appRiderUsers)}</strong>
            {data.rideEstimateCents > 0 && (
              <>
                {' '}
                · estimativa somada das corridas{' '}
                <strong>{formatBRL(data.rideEstimateCents)}</strong>{' '}
                <span className="text-muted">(informativa, fica fora do rateio)</span>
              </>
            )}
          </p>
        )}
        {data.ownRiderUsers.length > 0 && (
          <p className="text-sm text-muted">
            Por conta própria:{' '}
            <strong className="text-ink">{firstNames(data.ownRiderUsers)}</strong>
          </p>
        )}
      </div>

      {data.undecidedUsers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-base">Ainda sem transporte definido</h3>
          <ul className="flex flex-wrap gap-1.5">
            {data.undecidedUsers.map((u) => (
              <li key={u.id}>
                <Badge tone="warn">{u.name.split(' ')[0]}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      <TabLink tab="frotas">Gerenciar carros e pontos na aba Frotas</TabLink>
    </section>
  );
}
