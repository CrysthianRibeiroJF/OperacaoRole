import type { FeedItem } from '@role/contracts';
import { Link } from 'react-router-dom';
import { IconClock, IconPlus, Swallow } from '../../components/icons';
import { Countdown, EmptyState, ErrorState, Spinner } from '../../components/misc';
import { formatBRL, formatEventDates } from '../../lib/format';
import { useFeed, useSession } from '../../lib/queries';
import { InstallBanner } from '../../components/InstallBanner';
import { StatusTag, SwallowMeter, Ticket } from '../events/shared';

function EventRow({ item }: { item: FeedItem }) {
  const inside = item.myState === 'in';
  const to = inside ? `/role/${item.id}` : `/c/${item.code}`;
  const live = item.status === 'open' || item.status === 'confirmed';

  const notes: { key: string; tone: string; node: React.ReactNode }[] = [];
  if (item.status === 'open') {
    notes.push({
      key: 'deadline',
      tone: item.missing === 1 ? 'bg-sol-soft text-sol-ink' : 'text-muted',
      node: (
        <>
          <IconClock size={14} /> <Countdown until={item.responseDeadlineAt} />
          {item.missing > 0 && ` · falta${item.missing > 1 ? 'm' : ''} ${item.missing}`}
        </>
      ),
    });
  }
  if (item.status === 'confirmed' && item.belowQuorum) {
    notes.push({
      key: 'below',
      tone: 'bg-warn-soft text-warn',
      node: `Abaixo do mínimo (${item.confirmedCount}/${item.quorum})`,
    });
  }
  if (item.myState === 'out') notes.push({ key: 'out', tone: 'text-muted', node: 'Você passou' });
  if (item.isOrganizer) notes.push({ key: 'org', tone: 'text-navy-dark', node: 'Você criou' });
  if (item.myDepositStatus === 'pending')
    notes.push({ key: 'dep', tone: 'bg-carimbo-soft text-carimbo-dark', node: 'Falta o sinal' });
  if (item.myDepositStatus === 'submitted')
    notes.push({ key: 'dep', tone: 'text-navy-dark', node: 'Sinal em análise' });
  if (item.myDepositStatus === 'waitlisted')
    notes.push({ key: 'dep', tone: 'bg-danger-soft text-danger', node: 'Na fila de espera' });
  if (item.myDepositStatus === 'rejected')
    notes.push({ key: 'dep', tone: 'bg-danger-soft text-danger', node: 'Comprovante recusado' });

  return (
    <Link to={to} className="block transition-transform active:translate-y-px">
      <Ticket
        top={
          <div className="px-5 pb-5 pt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="eyebrow">Ordem nº {item.code}</span>
              <StatusTag status={item.status} />
            </div>
            <h3 className="font-display mt-2.5 text-[1.9rem] font-extrabold uppercase leading-[0.95] tracking-[0.005em]">
              {item.title}
            </h3>
            <p className="mt-1.5 text-sm text-muted">
              {item.destination} · {formatEventDates(item.startDate, item.endDate)}
            </p>
          </div>
        }
        bottom={
          <div className="space-y-3 px-5 pb-4 pt-5">
            <div className="flex items-center justify-between gap-3">
              {live ? (
                <SwallowMeter confirmed={item.confirmedCount} quorum={item.quorum} size={30} />
              ) : (
                <span />
              )}
              <span className="mono text-sm font-semibold">
                {formatBRL(item.costCapCents)}
                <span className="font-normal text-muted"> /pessoa</span>
              </span>
            </div>
            {notes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {notes.map((n) => (
                  <span
                    key={n.key}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold ${n.tone}`}
                  >
                    {n.node}
                  </span>
                ))}
              </div>
            )}
          </div>
        }
      />
    </Link>
  );
}

function Section({ title, items }: { title: string; items: FeedItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-4">
      <h2 className="eyebrow flex items-center gap-2 !font-medium !text-ink">
        {title}
        <span className="mono rounded-full bg-ink px-1.5 text-[11px] leading-5 text-surface">
          {items.length}
        </span>
      </h2>
      <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 md:[&>*]:self-start">
        {items.map((i) => (
          <EventRow key={i.id} item={i} />
        ))}
      </div>
    </section>
  );
}

export function FeedPage() {
  const { data: session } = useSession();
  const { data, isPending, isError, refetch } = useFeed();

  return (
    <div className="space-y-7">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <span className="grid size-5 place-items-center rounded-full bg-sol text-on-sol">
              <Swallow size={12} />
            </span>
            Oi, {session?.profile?.name.split(' ')[0]}
          </p>
          <h1 className="mt-2 text-[3rem]">Seus rolês</h1>
        </div>
        <Link
          to="/novo"
          className="key inline-flex min-h-11 items-center gap-1.5 rounded-[10px] bg-sol px-4 font-bold text-on-sol [--key-edge:var(--color-sol-dark)] hover:brightness-105"
        >
          <IconPlus size={18} /> Novo rolê
        </Link>
      </header>

      <InstallBanner />

      {isPending && <Spinner />}
      {isError && (
        <ErrorState message="Não consegui carregar seus rolês." onRetry={() => void refetch()} />
      )}

      {data && data.length === 0 && (
        <EmptyState emoji="🏝️" title="Nenhum rolê por aqui ainda">
          <p>
            Lance uma proposta em 2 minutos, mande o link no grupo e deixe o app juntar as primeiras
            andorinhas.
          </p>
          <Link
            to="/novo"
            className="key mt-5 inline-flex min-h-12 items-center rounded-[10px] bg-sol px-5 font-bold text-on-sol [--key-edge:var(--color-sol-dark)]"
          >
            Lançar o primeiro rolê
          </Link>
        </EmptyState>
      )}

      {data && (
        <>
          <Section title="Propostas abertas" items={data.filter((e) => e.status === 'open')} />
          <Section title="Confirmados" items={data.filter((e) => e.status === 'confirmed')} />
          <Section
            title="Histórico"
            items={data.filter((e) => ['closed', 'archived', 'cancelled'].includes(e.status))}
          />
        </>
      )}
    </div>
  );
}
