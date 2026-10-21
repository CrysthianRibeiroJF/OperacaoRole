import { useQueryClient } from '@tanstack/react-query';
import type { NotificationDto } from '@role/contracts';
import {
  categoryOfKind,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_INFO,
  tabForKind,
  type NotificationCategory,
} from '@role/domain';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import {
  IconBell,
  IconCar,
  IconCart,
  IconCheck,
  IconMedal,
  IconReceipt,
  IconUsers,
  IconWallet,
  Swallow,
} from '../../components/icons';
import { EmptyState, ErrorState, Skeleton } from '../../components/misc';
import { api } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { keys, useAction, useNotifications } from '../../lib/queries';

const CATEGORY_ICON: Record<NotificationCategory, ReactNode> = {
  quorum: <Swallow size={20} />,
  deposit: <IconWallet size={20} />,
  roles: <IconMedal size={20} />,
  supplies: <IconCart size={20} />,
  fleet: <IconCar size={20} />,
  expenses: <IconReceipt size={20} />,
  settlement: <IconCheck size={20} />,
  social: <IconUsers size={20} />,
};

type FilterKey = 'all' | 'unread' | NotificationCategory;

/** Caixa de entrada do app: como tudo é interno, ela precisa ser fácil de varrer e de agir. */
export function NotificationsPage() {
  const { data, isPending, isError, refetch } = useNotifications();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>('all');

  const markAll = useAction(() => api.post('/notifications/read', {}), {
    invalidate: [keys.notifications],
    success: 'Tudo marcado como lido',
  });

  const items = useMemo(() => data?.items ?? [], [data]);
  const present = useMemo(
    () => NOTIFICATION_CATEGORIES.filter((c) => items.some((n) => categoryOfKind(n.kind) === c)),
    [items],
  );

  const visible = items.filter((n) =>
    filter === 'all' ? true : filter === 'unread' ? !n.readAt : categoryOfKind(n.kind) === filter,
  );
  const groups = groupByDay(visible);

  function open(n: NotificationDto) {
    if (n.readAt) return;
    void api
      .post('/notifications/read', { ids: [n.id] })
      .then(() => qc.invalidateQueries({ queryKey: keys.notifications }));
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">
            {data && data.unread > 0
              ? data.unread + (data.unread === 1 ? ' não lido' : ' não lidos')
              : 'Tudo em dia'}
          </p>
          <h1 className="mt-2 text-[3rem]">Avisos</h1>
        </div>
        {data && data.unread > 0 && (
          <Button
            size="sm"
            variant="soft"
            loading={markAll.isPending}
            onClick={() => markAll.mutate(undefined)}
          >
            <IconCheck size={16} /> Marcar lidos
          </Button>
        )}
      </header>

      {items.length > 0 && (
        <div
          role="tablist"
          aria-label="Filtrar avisos"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {(
            [
              ['all', 'Todos'],
              ['unread', 'Não lidos'],
              ...present.map((c) => [c, NOTIFICATION_CATEGORY_INFO[c].label] as const),
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key as FilterKey)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-bold transition-colors ${
                filter === key ? 'bg-ink text-surface' : 'bg-surface text-muted ring-1 ring-line'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {isPending && <Skeleton rows={4} />}
      {isError && (
        <ErrorState message="Não consegui carregar os avisos." onRetry={() => void refetch()} />
      )}

      {data && items.length === 0 && (
        <EmptyState emoji="🔕" title="Tudo quieto por aqui">
          Quando algo precisar da sua atenção (prazo do sinal, missão pendente, conta fechada),
          aparece aqui. Você escolhe o que quer ver em Conta, Avisos.
        </EmptyState>
      )}

      {data && items.length > 0 && visible.length === 0 && (
        <p className="card p-5 text-center text-muted">Nenhum aviso neste filtro.</p>
      )}

      {groups.map((g) => (
        <section key={g.label} className="space-y-2">
          <h3 className="eyebrow !text-ink">{g.label}</h3>
          <ul className="space-y-2">
            {g.items.map((n) => (
              <li key={n.id}>
                <NotificationItem n={n} onOpen={() => open(n)} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="px-1 text-center text-xs text-muted">
        <Link to="/perfil/avisos" className="font-bold text-navy-dark">
          Escolher quais avisos receber
        </Link>
      </p>
    </div>
  );
}

function NotificationItem({ n, onOpen }: { n: NotificationDto; onOpen: () => void }) {
  const category = categoryOfKind(n.kind);
  const unread = !n.readAt;
  const body = (
    <div
      className={`card flex gap-3 p-4 transition-colors ${unread ? 'border-navy/40 bg-navy-soft/60' : ''}`}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sol-soft text-sol-ink">
        {category ? CATEGORY_ICON[category] : <IconBell size={20} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-start justify-between gap-2 font-extrabold">
          <span>{n.title}</span>
          {unread && (
            <span
              className="mt-1.5 size-2.5 shrink-0 rounded-full bg-carimbo"
              aria-label="Não lido"
            />
          )}
        </p>
        <p className="text-sm text-muted">{n.body}</p>
        <p className="mono mt-1.5 text-[11px] text-muted">{timeAgo(n.createdAt)}</p>
      </div>
    </div>
  );
  // Avisos de enquete e tropa levam à própria tela; os demais, à aba certa do QG.
  if (n.link) {
    return (
      <Link to={n.link} onClick={onOpen}>
        {body}
      </Link>
    );
  }
  if (!n.eventId) return <div onClick={onOpen}>{body}</div>;
  return (
    <Link to={`/role/${n.eventId}?aba=${tabForKind(n.kind)}`} onClick={onOpen}>
      {body}
    </Link>
  );
}

function groupByDay(items: NotificationDto[]): { label: string; items: NotificationDto[] }[] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const day = 86_400_000;
  const buckets = new Map<string, NotificationDto[]>();
  for (const n of items) {
    const age = startOfToday.getTime() - new Date(n.createdAt).getTime();
    const label =
      age <= 0 ? 'Hoje' : age <= day ? 'Ontem' : age <= 7 * day ? 'Esta semana' : 'Antes';
    buckets.set(label, [...(buckets.get(label) ?? []), n]);
  }
  return ['Hoje', 'Ontem', 'Esta semana', 'Antes']
    .filter((l) => buckets.has(l))
    .map((label) => ({ label, items: buckets.get(label)! }));
}
