import type { EventCard } from '@role/contracts';
import type { AppContext } from '../../context';
import { forbidden } from '../../errors';
import { newId } from '../../ids';
import { audit } from '../../lib/audit';
import { inviteCrewToEvent } from '../crews/crews.service';
import { createEvent } from './event.service';
import { requireEvent, toEventCard } from './event.queries';

/**
 * "Repetir esse rolê": nasce uma proposta nova, aberta, com o que dá para reaproveitar (valor,
 * quórum, sinal, dados da Base, lista de compras, quartos e playlist). Cargos, carros, despesas e
 * respostas não vêm: a tropa responde de novo e os cargos voltam ao sorteio.
 */
export async function repeatEvent(
  ctx: AppContext,
  userId: string,
  sourceId: string,
  input: {
    startDate: string;
    endDate?: string | undefined;
    title?: string | undefined;
    responseHours: number;
    crewId?: string | undefined;
  },
): Promise<EventCard> {
  const source = await requireEvent(ctx.db, sourceId);
  if (source.organizer_id !== userId) throw forbidden('Só o Idealizador repete o rolê');

  const card = await createEvent(ctx, userId, {
    title: input.title ?? source.title,
    destination: source.destination,
    startDate: input.startDate,
    ...(input.endDate ? { endDate: input.endDate } : {}),
    costCapCents: source.cost_cap_cents,
    quorum: source.quorum,
    responseHours: input.responseHours,
    requiresDeposit: source.deposit_required === 1,
    ...(source.deposit_required === 1 && source.deposit_cents && source.deposit_pix_key
      ? { depositCents: source.deposit_cents, pixKey: source.deposit_pix_key }
      : {}),
  });

  const now = ctx.clock.now();
  await ctx.db.transaction().execute(async (trx) => {
    await trx
      .updateTable('events')
      .set({
        max_roles_per_user: source.max_roles_per_user,
        expense_approval_threshold_cents: source.expense_approval_threshold_cents,
        fixed_costs_cents: source.fixed_costs_cents,
        base_address: source.base_address,
        base_wifi_name: source.base_wifi_name,
        base_wifi_password: source.base_wifi_password,
        base_gate_code: source.base_gate_code,
        base_checkout_time: source.base_checkout_time,
        base_house_rules: source.base_house_rules,
        base_schedule: source.base_schedule,
        playlist_url: source.playlist_url,
      })
      .where('id', '=', card.id)
      .execute();

    const supplies = await trx
      .selectFrom('supply_items')
      .selectAll()
      .where('event_id', '=', sourceId)
      .orderBy('created_at')
      .execute();
    if (supplies.length > 0) {
      await trx
        .insertInto('supply_items')
        .values(
          supplies.map((s, i) => ({
            id: newId(),
            event_id: card.id,
            name: s.name,
            category: s.category,
            quantity_label: s.quantity_label,
            est_price_cents: s.est_price_cents,
            real_price_cents: null,
            assignee_id: null,
            done: 0,
            expense_id: null,
            created_by: userId,
            // Mantém a ordem da lista original (created_at é o critério de ordenação).
            created_at: new Date(now.getTime() + i).toISOString(),
          })),
        )
        .execute();
    }

    const rooms = await trx
      .selectFrom('rooms')
      .selectAll()
      .where('event_id', '=', sourceId)
      .orderBy('created_at')
      .execute();
    if (rooms.length > 0) {
      await trx
        .insertInto('rooms')
        .values(
          rooms.map((r, i) => ({
            id: newId(),
            event_id: card.id,
            name: r.name,
            beds: r.beds,
            created_at: new Date(now.getTime() + i).toISOString(),
          })),
        )
        .execute();
    }

    await audit(trx, now, {
      eventId: card.id,
      actorId: userId,
      action: 'event.repeated',
      entity: 'event',
      entityId: sourceId,
    });
  });

  if (input.crewId) await inviteCrewToEvent(ctx, userId, card.id, input.crewId);
  return toEventCard(ctx.db, await requireEvent(ctx.db, card.id));
}
