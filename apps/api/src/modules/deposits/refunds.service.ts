import type { RefundDto, RefundsDto } from '@role/contracts';
import { can } from '@role/domain';
import type { AppContext } from '../../context';
import { conflict, forbidden, notFound } from '../../errors';
import { audit } from '../../lib/audit';
import { formatBRL } from '../../lib/format';
import {
  buildActor,
  getTreasurerId,
  loadParties,
  partyOf,
  requireEvent,
  usersById,
} from '../events/event.queries';
import { notify } from '../notifications/notifications.service';

/**
 * Devolução de sinal de rolê cancelado. O app não movimenta dinheiro (D-003): o Tesoureiro devolve
 * por Pix, fora do app, e aqui só marca quem já recebeu de volta, para ninguém ficar sem resposta.
 */
async function eligible(ctx: AppContext, eventId: string, treasurerId: string) {
  return ctx.db
    .selectFrom('participations')
    .select(['user_id', 'responded_at'])
    .where('event_id', '=', eventId)
    .where('response', '=', 'in')
    .where('deposit_status', '=', 'approved')
    .where('user_id', '!=', treasurerId)
    .orderBy('responded_at')
    .execute();
}

export async function listRefunds(
  ctx: AppContext,
  userId: string,
  eventId: string,
): Promise<RefundsDto> {
  const event = await requireEvent(ctx.db, eventId);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'event.viewInternal')) throw forbidden('Só quem participou vê as devoluções');
  if (event.status !== 'cancelled' || !event.deposit_opened_at)
    return { canManage: false, items: [] };

  const canManage = can(actor, 'deposit.review');
  const treasurerId = await getTreasurerId(ctx.db, event);
  const [rows, done] = await Promise.all([
    eligible(ctx, eventId, treasurerId),
    ctx.db.selectFrom('deposit_refunds').selectAll().where('event_id', '=', eventId).execute(),
  ]);
  const users = await usersById(
    ctx.db,
    rows.map((r) => r.user_id),
  );
  const amount = event.deposit_cents ?? 0;
  const parties = await loadParties(ctx.db, eventId);

  const items: RefundDto[] = rows
    .filter((r) => canManage || r.user_id === userId)
    .map((r) => ({
      user: users.get(r.user_id) ?? { id: r.user_id, name: '—' },
      // O sinal foi pago por cota (casal = dois sinais): a devolução acompanha.
      amountCents: amount * partyOf(parties, r.user_id).units,
      refundedAt: done.find((d) => d.user_id === r.user_id)?.refunded_at ?? null,
    }));
  return { canManage, items };
}

export async function markRefunded(
  ctx: AppContext,
  managerId: string,
  eventId: string,
  targetId: string,
): Promise<void> {
  await ctx.db.transaction().execute(async (trx) => {
    const now = ctx.clock.now();
    const event = await requireEvent(trx, eventId);
    const { actor } = await buildActor(trx, event, managerId);
    if (!can(actor, 'deposit.review')) throw forbidden('Só o Tesoureiro registra devoluções');
    if (event.status !== 'cancelled')
      throw conflict('EVENT_NOT_CANCELLED', 'Só rolês cancelados têm devolução de sinal');

    const treasurerId = await getTreasurerId(trx, event);
    const rows = await trx
      .selectFrom('participations')
      .select('user_id')
      .where('event_id', '=', eventId)
      .where('user_id', '=', targetId)
      .where('deposit_status', '=', 'approved')
      .where('user_id', '!=', treasurerId)
      .executeTakeFirst();
    if (!rows) throw notFound('Essa pessoa não tem sinal aprovado a devolver');

    await trx
      .insertInto('deposit_refunds')
      .values({
        event_id: eventId,
        user_id: targetId,
        refunded_at: now.toISOString(),
        marked_by: managerId,
      })
      .onConflict((oc) => oc.doNothing())
      .execute();
    await notify(trx, now, {
      userIds: [targetId],
      eventId,
      kind: 'deposit.refunded',
      title: 'Devolução do sinal registrada',
      body: `O Tesoureiro registrou a devolução de ${formatBRL((event.deposit_cents ?? 0) * partyOf(await loadParties(trx, eventId), targetId).units)} de ${event.title}. Confira o Pix recebido.`,
      dedupeKey: `deposit.refunded:${eventId}:${targetId}`,
    });
    await audit(trx, now, {
      eventId,
      actorId: managerId,
      action: 'deposit.refunded',
      entity: 'participation',
      entityId: targetId,
    });
  });
}
