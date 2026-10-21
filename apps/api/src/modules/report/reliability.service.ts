import { isLatePayment, reliabilityOf, type Reliability } from '@role/domain';
import type { Db } from '../../context';

/**
 * Selo de cada pessoa, calculado do histórico (rolês encerrados, sinais perdidos e acertos em
 * atraso). Quem chama decide para quem mostrar: hoje só o Idealizador vê (D-005, sem expor ninguém).
 */
export async function reliabilityFor(
  db: Db,
  now: Date,
  userIds: readonly string[],
): Promise<Map<string, Reliability>> {
  const ids = [...new Set(userIds)];
  const result = new Map<string, Reliability>();
  if (ids.length === 0) return result;

  const [completed, missed, transfers] = await Promise.all([
    db
      .selectFrom('participations')
      .innerJoin('events', 'events.id', 'participations.event_id')
      .select(['participations.user_id as user_id', (eb) => eb.fn.countAll<number>().as('n')])
      .where('participations.user_id', 'in', ids)
      .where('participations.response', '=', 'in')
      .where('events.status', '=', 'closed')
      .groupBy('participations.user_id')
      .execute(),
    db
      .selectFrom('participations')
      .select(['user_id', (eb) => eb.fn.countAll<number>().as('n')])
      .where('user_id', 'in', ids)
      .where('deposit_status', '=', 'waitlisted')
      .groupBy('user_id')
      .execute(),
    db
      .selectFrom('settlement_transfers')
      .innerJoin('settlements', 'settlements.id', 'settlement_transfers.settlement_id')
      .select([
        'settlement_transfers.from_user as user_id',
        'settlement_transfers.paid_at as paid_at',
        'settlements.closed_at as closed_at',
      ])
      .where('settlement_transfers.from_user', 'in', ids)
      .execute(),
  ]);

  const count = (rows: { user_id: string; n: number }[], id: string) =>
    Number(rows.find((r) => r.user_id === id)?.n ?? 0);
  for (const id of ids) {
    const late = transfers.filter(
      (t) =>
        t.user_id === id &&
        isLatePayment(new Date(t.closed_at), t.paid_at ? new Date(t.paid_at) : null, now),
    ).length;
    result.set(
      id,
      reliabilityOf({
        completed: count(completed, id),
        missedDeposits: count(missed, id),
        latePayments: late,
      }),
    );
  }
  return result;
}
