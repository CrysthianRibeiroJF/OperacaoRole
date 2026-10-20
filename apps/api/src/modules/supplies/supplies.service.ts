import type { SuppliesDto, SupplyItemDto } from '@role/contracts';
import {
  can,
  expenseCategoryFor,
  quotaForCategory,
  suggestSupplies,
  type SupplyCategory,
} from '@role/domain';
import type { AppContext } from '../../context';
import { conflict, forbidden, notFound } from '../../errors';
import { newId } from '../../ids';
import { audit } from '../../lib/audit';
import {
  buildActor,
  confirmedUserIds,
  requireEvent,
  usersById,
  type EventRow,
} from '../events/event.queries';
import { createExpense } from '../expenses/expenses.service';
import { notify } from '../notifications/notifications.service';

function assertActive(event: EventRow) {
  if (event.status !== 'confirmed') {
    throw conflict('EVENT_NOT_ACTIVE', 'A lista só é editável enquanto o rolê está confirmado');
  }
}

export async function listSupplies(
  ctx: AppContext,
  userId: string,
  eventId: string,
): Promise<SuppliesDto> {
  const event = await requireEvent(ctx.db, eventId);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'event.viewInternal')) throw forbidden('Confirme presença para ver a lista');

  const rows = await ctx.db
    .selectFrom('supply_items')
    .selectAll()
    .where('event_id', '=', eventId)
    .orderBy('created_at')
    .orderBy('id')
    .execute();
  const users = await usersById(
    ctx.db,
    rows.flatMap((r) => (r.assignee_id ? [r.assignee_id] : [])),
  );

  const items: SupplyItemDto[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    quantityLabel: r.quantity_label,
    estPriceCents: r.est_price_cents,
    realPriceCents: r.real_price_cents,
    assignee: r.assignee_id ? (users.get(r.assignee_id) ?? null) : null,
    done: r.done === 1,
    hasExpense: !!r.expense_id,
  }));

  return {
    items,
    estimatedCents: rows.reduce((s, r) => s + (r.est_price_cents ?? 0), 0),
    realCents: rows.reduce((s, r) => s + (r.real_price_cents ?? 0), 0),
    doneCount: rows.filter((r) => r.done === 1).length,
  };
}

async function loadItem(ctx: AppContext, itemId: string) {
  const item = await ctx.db
    .selectFrom('supply_items')
    .selectAll()
    .where('id', '=', itemId)
    .executeTakeFirst();
  if (!item) throw notFound('Item não encontrado');
  const event = await requireEvent(ctx.db, item.event_id);
  return { item, event };
}

export async function createSupply(
  ctx: AppContext,
  userId: string,
  eventId: string,
  input: {
    name: string;
    category: SupplyCategory;
    quantityLabel: string;
    estPriceCents?: number | null | undefined;
  },
): Promise<void> {
  const event = await requireEvent(ctx.db, eventId);
  assertActive(event);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'supplies.edit')) throw forbidden('Só o General de Suprimentos edita a lista');

  await ctx.db
    .insertInto('supply_items')
    .values({
      id: newId(),
      event_id: eventId,
      name: input.name,
      category: input.category,
      quantity_label: input.quantityLabel,
      est_price_cents: input.estPriceCents ?? null,
      real_price_cents: null,
      assignee_id: null,
      done: 0,
      expense_id: null,
      created_by: userId,
      created_at: ctx.clock.now().toISOString(),
    })
    .execute();
}

export async function updateSupply(
  ctx: AppContext,
  userId: string,
  itemId: string,
  patch: {
    name?: string;
    category?: SupplyCategory;
    quantityLabel?: string;
    estPriceCents?: number | null;
  },
): Promise<void> {
  const { item, event } = await loadItem(ctx, itemId);
  assertActive(event);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'supplies.edit')) throw forbidden('Só o General de Suprimentos edita a lista');
  if (item.done === 1) throw conflict('ITEM_DONE', 'Este item já foi comprado');

  const set: Record<string, unknown> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.category !== undefined) set.category = patch.category;
  if (patch.quantityLabel !== undefined) set.quantity_label = patch.quantityLabel;
  if (patch.estPriceCents !== undefined) set.est_price_cents = patch.estPriceCents;
  if (Object.keys(set).length === 0) return;
  await ctx.db.updateTable('supply_items').set(set).where('id', '=', itemId).execute();
}

export async function deleteSupply(ctx: AppContext, userId: string, itemId: string): Promise<void> {
  const { item, event } = await loadItem(ctx, itemId);
  assertActive(event);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'supplies.edit')) throw forbidden('Só o General de Suprimentos edita a lista');
  if (item.expense_id)
    throw conflict(
      'ITEM_HAS_EXPENSE',
      'Este item virou despesa. Recuse a despesa antes de remover.',
    );
  await ctx.db.deleteFrom('supply_items').where('id', '=', itemId).execute();
}

/** "Eu levo": qualquer confirmado assume um item livre (microtarefa). */
export async function claimSupply(ctx: AppContext, userId: string, itemId: string): Promise<void> {
  const { item, event } = await loadItem(ctx, itemId);
  assertActive(event);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'supplies.claim')) throw forbidden('Só quem confirmou presença assume itens');
  if (item.done === 1) throw conflict('ITEM_DONE', 'Este item já foi comprado');

  const res = await ctx.db
    .updateTable('supply_items')
    .set({ assignee_id: userId })
    .where('id', '=', itemId)
    .where('assignee_id', 'is', null)
    .executeTakeFirst();
  if (Number(res.numUpdatedRows) === 0)
    throw conflict('ITEM_TAKEN', 'Outra pessoa já assumiu este item');
  await audit(ctx.db, ctx.clock.now(), {
    eventId: event.id,
    actorId: userId,
    action: 'supply.claimed',
    entity: 'supply',
    entityId: itemId,
  });
}

export async function unclaimSupply(
  ctx: AppContext,
  userId: string,
  itemId: string,
): Promise<void> {
  const { item, event } = await loadItem(ctx, itemId);
  assertActive(event);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (item.assignee_id !== userId && !can(actor, 'supplies.edit')) {
    throw forbidden('Só quem assumiu (ou o General de Suprimentos) libera o item');
  }
  if (item.done === 1) throw conflict('ITEM_DONE', 'Este item já foi comprado');
  await ctx.db
    .updateTable('supply_items')
    .set({ assignee_id: null })
    .where('id', '=', itemId)
    .execute();
}

/**
 * Dá baixa no item. Com `createExpense`, o valor vira despesa paga por quem comprou, já com a cota
 * da categoria (carne só entre quem come carne, cerveja só entre quem bebe, e assim por diante).
 */
export async function markSupplyDone(
  ctx: AppContext,
  userId: string,
  itemId: string,
  input: { priceCents?: number | undefined; createExpense: boolean },
): Promise<void> {
  const { item, event } = await loadItem(ctx, itemId);
  assertActive(event);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (item.assignee_id !== userId && !can(actor, 'supplies.edit')) {
    throw forbidden('Só quem assumiu o item (ou o General de Suprimentos) dá baixa');
  }
  if (input.createExpense && input.priceCents === undefined) {
    throw conflict('PRICE_REQUIRED', 'Informe quanto foi pago para lançar a despesa');
  }

  // Reivindica atomicamente: dois cliques não geram duas despesas.
  const claim = await ctx.db
    .updateTable('supply_items')
    .set({
      done: 1,
      real_price_cents: input.priceCents ?? null,
      assignee_id: item.assignee_id ?? userId,
    })
    .where('id', '=', itemId)
    .where('done', '=', 0)
    .executeTakeFirst();
  if (Number(claim.numUpdatedRows) === 0) throw conflict('ITEM_DONE', 'Este item já foi comprado');

  if (input.createExpense && input.priceCents !== undefined) {
    const payerId = item.assignee_id ?? userId;
    try {
      const expense = await createExpense(ctx, payerId, event.id, {
        description: item.name,
        category: expenseCategoryFor(item.category),
        amountCents: input.priceCents,
        quota: quotaForCategory(item.category),
      });
      await ctx.db
        .updateTable('supply_items')
        .set({ expense_id: expense.id })
        .where('id', '=', itemId)
        .execute();
    } catch (err) {
      await ctx.db
        .updateTable('supply_items')
        .set({ done: 0, real_price_cents: null })
        .where('id', '=', itemId)
        .execute();
      throw err;
    }
  }
}

export async function undoSupplyDone(
  ctx: AppContext,
  userId: string,
  itemId: string,
): Promise<void> {
  const { item, event } = await loadItem(ctx, itemId);
  assertActive(event);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (item.assignee_id !== userId && !can(actor, 'supplies.edit'))
    throw forbidden('Sem permissão para reabrir este item');
  if (item.expense_id)
    throw conflict('ITEM_HAS_EXPENSE', 'Este item virou despesa. Recuse a despesa para reabri-lo.');
  await ctx.db
    .updateTable('supply_items')
    .set({ done: 0, real_price_cents: null })
    .where('id', '=', itemId)
    .execute();
}

/** Monta a lista inicial a partir de quem está no rolê (RN: quantidade sugerida por pessoas × dias). */
export async function suggestSupplyList(
  ctx: AppContext,
  userId: string,
  eventId: string,
): Promise<number> {
  const event = await requireEvent(ctx.db, eventId);
  assertActive(event);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'supplies.edit')) throw forbidden('Só o General de Suprimentos monta a lista');

  const existing = await ctx.db
    .selectFrom('supply_items')
    .select('id')
    .where('event_id', '=', eventId)
    .executeTakeFirst();
  if (existing)
    throw conflict(
      'LIST_NOT_EMPTY',
      'A lista já tem itens. Edite-os ou remova antes de sugerir de novo.',
    );

  const members = await ctx.db
    .selectFrom('participations')
    .select(['drinks_alcohol', 'diet'])
    .where('event_id', '=', eventId)
    .where('response', '=', 'in')
    .execute();
  const start = new Date(`${event.start_date}T12:00:00Z`).getTime();
  const end = new Date(`${event.end_date ?? event.start_date}T12:00:00Z`).getTime();
  const days = Math.max(1, Math.round((end - start) / 86_400_000) + 1);

  const suggestions = suggestSupplies({
    people: members.length,
    drinkers: members.filter((m) => m.drinks_alcohol === 1).length,
    vegetarians: members.filter((m) => m.diet === 'vegetarian').length,
    days,
  });
  const now = ctx.clock.now();
  await ctx.db
    .insertInto('supply_items')
    .values(
      suggestions.map((s, i) => ({
        id: newId(),
        event_id: eventId,
        name: s.name,
        category: s.category,
        quantity_label: s.quantityLabel,
        est_price_cents: s.estPriceCents,
        real_price_cents: null,
        assignee_id: null,
        done: 0,
        expense_id: null,
        created_by: userId,
        // created_at crescente preserva a ordem sugerida.
        created_at: new Date(now.getTime() + i).toISOString(),
      })),
    )
    .execute();

  await notify(ctx.db, now, {
    userIds: (await confirmedUserIds(ctx.db, eventId)).filter((id) => id !== userId),
    eventId,
    kind: 'supplies.list_ready',
    title: 'A lista de mercado saiu',
    body: `${event.title}: abra a aba Mercado e assuma o que você pode levar.`,
    dedupeKey: `supplies.list_ready:${eventId}`,
  });
  await audit(ctx.db, now, {
    eventId,
    actorId: userId,
    action: 'supply.suggested',
    entity: 'event',
    entityId: eventId,
    data: { count: suggestions.length },
  });
  return suggestions.length;
}
