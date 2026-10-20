import type { EventDetail, RefundsDto } from '@role/contracts';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../../components/Button';
import { Avatar, Badge, Spinner } from '../../../components/misc';
import { api } from '../../../lib/api';
import { formatBRL } from '../../../lib/format';
import { eventKeys, keys, useAction } from '../../../lib/queries';

/**
 * Devolução do sinal de um rolê cancelado. O app não mexe em dinheiro (D-003): o Tesoureiro devolve
 * por Pix fora daqui e só marca quem já recebeu; cada pessoa vê apenas a própria linha.
 */
export function RefundsSection({ detail }: { detail: EventDetail }) {
  const { event } = detail;
  const { data, isPending } = useQuery({
    queryKey: keys.refunds(event.id),
    queryFn: () => api.get<RefundsDto>(`/events/${event.id}/refunds`),
    enabled: event.status === 'cancelled' && detail.deposit.required,
  });
  const mark = useAction((userId: string) => api.post(`/events/${event.id}/refunds/${userId}`), {
    invalidate: [keys.refunds(event.id), ...eventKeys(event.id, event.code)],
    success: 'Devolução registrada',
  });

  if (event.status !== 'cancelled' || !detail.deposit.required) return null;
  if (isPending) return <Spinner />;
  if (!data || data.items.length === 0) return null;

  const pending = data.items.filter((i) => !i.refundedAt).length;
  return (
    <section className="card space-y-3 p-5">
      <div>
        <h2>Devolução do sinal</h2>
        <p className="mt-1 text-sm text-muted">
          {data.canManage
            ? pending > 0
              ? 'O rolê foi cancelado. Devolva cada sinal por Pix e marque aqui quando fizer.'
              : 'Tudo devolvido. Missão encerrada.'
            : 'O rolê foi cancelado. O Tesoureiro devolve o sinal por Pix e marca aqui quando fizer.'}
        </p>
      </div>
      <ul className="divide-y divide-line">
        {data.items.map((item) => (
          <li key={item.user.id} className="flex items-center gap-3 py-3">
            <Avatar user={item.user} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{item.user.name}</p>
              <p className="mono text-sm text-muted">{formatBRL(item.amountCents)}</p>
            </div>
            {item.refundedAt ? (
              <Badge tone="ok">Devolvido</Badge>
            ) : data.canManage ? (
              <Button
                size="sm"
                variant="soft"
                loading={mark.isPending && mark.variables === item.user.id}
                onClick={() => mark.mutate(item.user.id)}
              >
                Marcar como devolvido
              </Button>
            ) : (
              <Badge tone="warn">A devolver</Badge>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
