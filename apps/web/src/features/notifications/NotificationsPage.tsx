import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  IconBell,
  IconCheck,
  IconClock,
  IconFlag,
  IconMedal,
  IconReceipt,
  IconWallet,
  Swallow,
} from '../../components/icons';
import { EmptyState, ErrorState, Spinner } from '../../components/misc';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { keys, useNotifications } from '../../lib/queries';
import { useQueryClient } from '@tanstack/react-query';

const icons: Record<string, (p: { size?: number }) => React.ReactNode> = {
  'event.confirmed': Swallow,
  'quorum.almost': Swallow,
  'quorum.below': IconFlag,
  'deposit.window_opened': IconWallet,
  'deposit.reminder': IconClock,
  'deposit.waitlisted': IconClock,
  'deposit.approved': IconCheck,
  'role.vacant': IconMedal,
  'settlement.closed': IconReceipt,
};

export function NotificationsPage() {
  const { data, isPending, isError, refetch } = useNotifications();
  const qc = useQueryClient();
  const unread = data?.unread ?? 0;

  // Abrir a tela conta como ler. O selo só some depois do refetch, então ainda dá para ver o que é novo.
  useEffect(() => {
    if (unread === 0) return;
    const timer = setTimeout(() => {
      void api
        .post('/notifications/read', {})
        .then(() => qc.invalidateQueries({ queryKey: keys.notifications }));
    }, 1500);
    return () => clearTimeout(timer);
  }, [unread, qc]);

  return (
    <div className="space-y-4">
      <h1>Avisos</h1>
      {isPending && <Spinner />}
      {isError && (
        <ErrorState message="Não consegui carregar os avisos." onRetry={() => void refetch()} />
      )}
      {data && data.items.length === 0 && (
        <EmptyState emoji="🔕" title="Tudo quieto por aqui">
          Quando algo precisar da sua atenção (prazo do sinal, missão pendente, conta fechada),
          aparece aqui.
        </EmptyState>
      )}
      <ul className="space-y-2">
        {data?.items.map((n) => {
          const body = (
            <div
              className={`card flex gap-3 p-4 ${n.readAt ? '' : 'border-navy/40 bg-navy-soft/40'}`}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sol-soft text-sol-ink">
                {(() => {
                  const I = icons[n.kind] ?? IconBell;
                  return <I size={20} />;
                })()}
              </span>
              <div className="min-w-0">
                <p className="font-extrabold">{n.title}</p>
                <p className="text-muted">{n.body}</p>
                <p className="mt-1 text-xs text-muted">{formatDateTime(n.createdAt)}</p>
              </div>
            </div>
          );
          return (
            <li key={n.id}>{n.eventId ? <Link to={`/role/${n.eventId}`}>{body}</Link> : body}</li>
          );
        })}
      </ul>
    </div>
  );
}
