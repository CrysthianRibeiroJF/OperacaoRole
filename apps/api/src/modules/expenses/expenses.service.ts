import type { ExpenseDto } from '@role/contracts';
import { can, isContestable } from '@role/domain';
import type { Readable } from 'node:stream';
import type { AppContext } from '../../context';
import { AppError, conflict, forbidden, notFound, unprocessable } from '../../errors';
import { newId } from '../../ids';
import { audit } from '../../lib/audit';
import { formatBRL } from '../../lib/format';
import { detectFile } from '../../lib/sniff';
import { notify } from '../notifications/notifications.service';
import {
  buildActor,
  confirmedUserIds,
  getTreasurerId,
  requireEvent,
  usersById,
  type EventRow,
} from '../events/event.queries';

function assertOpenForExpenses(event: EventRow) {
  if (event.status === 'closed')
    throw conflict('EVENT_CLOSED', 'A conta deste rolê já foi fechada');
  if (event.status !== 'confirmed')
    throw conflict('EVENT_NOT_ACTIVE', 'Só dá para lançar despesas em rolês confirmados');
}

export async function createExpense(
  ctx: AppContext,
  userId: string,
  eventId: string,
  input: {
    description: string;
    category: string;
    amountCents: number;
    quota: 'global' | 'alcohol' | 'meat' | 'vegetarian' | 'custom';
    customParticipantIds?: string[] | undefined;
  },
): Promise<ExpenseDto> {
  const id = newId();
  await ctx.db.transaction().execute(async (trx) => {
    const now = ctx.clock.now();
    const event = await requireEvent(trx, eventId);
    assertOpenForExpenses(event);
    const { actor } = await buildActor(trx, event, userId);
    if (!can(actor, 'expense.create')) throw forbidden('Só quem confirmou presença lança despesas');

    let participantIds: string[] = [];
    if (input.quota === 'custom') {
      const members = new Set(await confirmedUserIds(trx, eventId));
      participantIds = [...new Set(input.customParticipantIds ?? [])];
      if (participantIds.some((p) => !members.has(p))) {
        throw unprocessable('INVALID_PARTICIPANTS', 'Só dá para dividir entre quem está no rolê');
      }
    }

    // O Tesoureiro aprova o que ele mesmo lança; o resto passa pelo limite definido para o rolê.
    const needsApproval =
      !can(actor, 'expense.review') && input.amountCents > event.expense_approval_threshold_cents;

    await trx
      .insertInto('expenses')
      .values({
        id,
        event_id: eventId,
        paid_by: userId,
        description: input.description,
        category: input.category,
        amount_cents: input.amountCents,
        quota: input.quota,
        status: needsApproval ? 'pending' : 'approved',
        reject_reason: null,
        reviewed_by: null,
        receipt_key: null,
        receipt_mime: null,
        created_at: now.toISOString(),
      })
      .execute();
    if (participantIds.length > 0) {
      await trx
        .insertInto('expense_participants')
        .values(participantIds.map((p) => ({ expense_id: id, user_id: p })))
        .execute();
    }

    if (needsApproval) {
      const names = await usersById(trx, [userId]);
      await notify(trx, now, {
        userIds: [await getTreasurerId(trx, event)],
        eventId,
        kind: 'expense.needs_approval',
        title: 'Despesa aguardando aprovação',
        body: `${names.get(userId)?.name ?? 'Alguém'} lançou ${formatBRL(input.amountCents)} (${input.description}).`,
        dedupeKey: `expense.needs_approval:${id}`,
      });
    }
    await audit(trx, now, {
      eventId,
      actorId: userId,
      action: 'expense.created',
      entity: 'expense',
      entityId: id,
      data: { amountCents: input.amountCents, quota: input.quota, needsApproval },
    });
  });

  return (await listExpenses(ctx, userId, eventId, new Set([id])))[0]!;
}

export async function attachReceipt(
  ctx: AppContext,
  userId: string,
  expenseId: string,
  data: Buffer,
): Promise<void> {
  const detected = detectFile(data);
  if (!detected)
    throw new AppError(415, 'UNSUPPORTED_FILE', 'Envie uma imagem (JPG, PNG, WebP) ou PDF');

  const expense = await ctx.db
    .selectFrom('expenses')
    .selectAll()
    .where('id', '=', expenseId)
    .executeTakeFirst();
  if (!expense) throw notFound('Despesa não encontrada');
  if (expense.paid_by !== userId) throw forbidden('Só quem lançou a despesa anexa a nota');
  assertOpenForExpenses(await requireEvent(ctx.db, expense.event_id));

  const key = await ctx.storage.save(`receipts/${expense.event_id}`, data, detected.extension);
  await ctx.db
    .updateTable('expenses')
    .set({ receipt_key: key, receipt_mime: detected.mime })
    .where('id', '=', expenseId)
    .execute();
}

export async function openReceipt(
  ctx: AppContext,
  userId: string,
  expenseId: string,
): Promise<{ stream: Readable; mime: string }> {
  const expense = await ctx.db
    .selectFrom('expenses')
    .selectAll()
    .where('id', '=', expenseId)
    .executeTakeFirst();
  if (!expense || !expense.receipt_key || !expense.receipt_mime)
    throw notFound('Nota não encontrada');
  const event = await requireEvent(ctx.db, expense.event_id);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'event.viewInternal')) throw forbidden('Sem acesso a esta nota');
  return { stream: ctx.storage.open(expense.receipt_key), mime: expense.receipt_mime };
}

export async function listExpenses(
  ctx: AppContext,
  userId: string,
  eventId: string,
  only?: ReadonlySet<string>,
): Promise<ExpenseDto[]> {
  const event = await requireEvent(ctx.db, eventId);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'event.viewInternal')) throw forbidden('Confirme presença para ver as despesas');

  const now = ctx.clock.now();
  let rows = await ctx.db
    .selectFrom('expenses')
    .selectAll()
    .where('event_id', '=', eventId)
    .orderBy('created_at', 'desc')
    .execute();
  if (only) rows = rows.filter((r) => only.has(r.id));

  const ids = rows.map((r) => r.id);
  const [parts, contests] = await Promise.all([
    ids.length
      ? ctx.db
          .selectFrom('expense_participants')
          .selectAll()
          .where('expense_id', 'in', ids)
          .execute()
      : Promise.resolve([]),
    ids.length
      ? ctx.db.selectFrom('expense_contests').selectAll().where('expense_id', 'in', ids).execute()
      : Promise.resolve([]),
  ]);
  const users = await usersById(ctx.db, [
    ...rows.map((r) => r.paid_by),
    ...parts.map((p) => p.user_id),
    ...contests.map((c) => c.by_user),
  ]);
  const user = (id: string) => users.get(id) ?? { id, name: '—' };

  return rows.map((r) => {
    const contest = contests.find((c) => c.expense_id === r.id);
    return {
      id: r.id,
      description: r.description,
      category: r.category as ExpenseDto['category'],
      amountCents: r.amount_cents,
      quota: r.quota,
      customParticipants: parts.filter((p) => p.expense_id === r.id).map((p) => user(p.user_id)),
      paidBy: user(r.paid_by),
      status: r.status,
      rejectReason: r.reject_reason,
      hasReceipt: !!r.receipt_key,
      contest: contest
        ? {
            reason: contest.reason,
            by: user(contest.by_user),
            at: contest.created_at,
            resolvedAt: contest.resolved_at,
            resolution: contest.resolution,
          }
        : null,
      contestable:
        event.status === 'confirmed' &&
        r.status !== 'rejected' &&
        !contest &&
        isContestable(new Date(r.created_at), now),
      createdAt: r.created_at,
    };
  });
}

export async function reviewExpense(
  ctx: AppContext,
  reviewerId: string,
  expenseId: string,
  input: { decision: 'approve' | 'reject'; reason?: string | undefined },
): Promise<void> {
  await ctx.db.transaction().execute(async (trx) => {
    const now = ctx.clock.now();
    const expense = await trx
      .selectFrom('expenses')
      .selectAll()
      .where('id', '=', expenseId)
      .executeTakeFirst();
    if (!expense) throw notFound('Despesa não encontrada');
    const event = await requireEvent(trx, expense.event_id);
    assertOpenForExpenses(event);
    const { actor } = await buildActor(trx, event, reviewerId);
    if (!can(actor, 'expense.review')) throw forbidden('Só o Tesoureiro aprova despesas');
    if (expense.status !== 'pending')
      throw conflict('ALREADY_REVIEWED', 'Esta despesa já foi analisada');

    const approve = input.decision === 'approve';
    await trx
      .updateTable('expenses')
      .set({
        status: approve ? 'approved' : 'rejected',
        reject_reason: approve ? null : (input.reason ?? null),
        reviewed_by: reviewerId,
      })
      .where('id', '=', expenseId)
      .execute();
    await notify(trx, now, {
      userIds: [expense.paid_by],
      eventId: event.id,
      kind: approve ? 'expense.approved' : 'expense.rejected',
      title: approve ? 'Despesa aprovada ✅' : 'Despesa recusada',
      body: approve
        ? `${expense.description} (${formatBRL(expense.amount_cents)}) entrou na conta do rolê.`
        : `${expense.description} foi recusada: ${input.reason}.`,
      dedupeKey: `expense.review:${expenseId}`,
    });
    await audit(trx, now, {
      eventId: event.id,
      actorId: reviewerId,
      action: approve ? 'expense.approved' : 'expense.rejected',
      entity: 'expense',
      entityId: expenseId,
      data: { reason: input.reason ?? null },
    });
  });
}

/** RN-39: qualquer confirmado contesta em até 72h; o Tesoureiro decide e registra. */
export async function contestExpense(
  ctx: AppContext,
  userId: string,
  expenseId: string,
  reason: string,
): Promise<void> {
  await ctx.db.transaction().execute(async (trx) => {
    const now = ctx.clock.now();
    const expense = await trx
      .selectFrom('expenses')
      .selectAll()
      .where('id', '=', expenseId)
      .executeTakeFirst();
    if (!expense) throw notFound('Despesa não encontrada');
    const event = await requireEvent(trx, expense.event_id);
    assertOpenForExpenses(event);
    const { actor } = await buildActor(trx, event, userId);
    if (actor.participation !== 'in') throw forbidden('Só quem está no rolê contesta despesas');
    if (expense.status === 'rejected')
      throw conflict('ALREADY_REJECTED', 'Esta despesa já foi recusada');
    if (!isContestable(new Date(expense.created_at), now)) {
      throw conflict('CONTEST_WINDOW_CLOSED', 'O prazo de 72h para contestar acabou');
    }
    const existing = await trx
      .selectFrom('expense_contests')
      .select('id')
      .where('expense_id', '=', expenseId)
      .executeTakeFirst();
    if (existing) throw conflict('ALREADY_CONTESTED', 'Esta despesa já foi contestada');

    await trx
      .insertInto('expense_contests')
      .values({
        id: newId(),
        expense_id: expenseId,
        by_user: userId,
        reason,
        created_at: now.toISOString(),
        resolved_at: null,
        resolved_by: null,
        resolution: null,
      })
      .execute();
    const names = await usersById(trx, [userId]);
    await notify(trx, now, {
      userIds: [await getTreasurerId(trx, event)],
      eventId: event.id,
      kind: 'expense.contested',
      title: 'Despesa contestada',
      body: `${names.get(userId)?.name ?? 'Alguém'} contestou "${expense.description}": ${reason}`,
      dedupeKey: `expense.contested:${expenseId}`,
    });
    await audit(trx, now, {
      eventId: event.id,
      actorId: userId,
      action: 'expense.contested',
      entity: 'expense',
      entityId: expenseId,
      data: { reason },
    });
  });
}

export async function resolveContest(
  ctx: AppContext,
  resolverId: string,
  expenseId: string,
  input: { decision: 'keep' | 'reject'; note: string },
): Promise<void> {
  await ctx.db.transaction().execute(async (trx) => {
    const now = ctx.clock.now();
    const expense = await trx
      .selectFrom('expenses')
      .selectAll()
      .where('id', '=', expenseId)
      .executeTakeFirst();
    if (!expense) throw notFound('Despesa não encontrada');
    const event = await requireEvent(trx, expense.event_id);
    assertOpenForExpenses(event);
    const { actor } = await buildActor(trx, event, resolverId);
    if (!can(actor, 'expense.resolveContest'))
      throw forbidden('Só o Tesoureiro decide contestações');

    const contest = await trx
      .selectFrom('expense_contests')
      .selectAll()
      .where('expense_id', '=', expenseId)
      .executeTakeFirst();
    if (!contest) throw notFound('Esta despesa não foi contestada');
    if (contest.resolved_at) throw conflict('ALREADY_RESOLVED', 'Esta contestação já foi decidida');

    await trx
      .updateTable('expense_contests')
      .set({ resolved_at: now.toISOString(), resolved_by: resolverId, resolution: input.note })
      .where('id', '=', contest.id)
      .execute();
    if (input.decision === 'reject') {
      await trx
        .updateTable('expenses')
        .set({ status: 'rejected', reject_reason: input.note, reviewed_by: resolverId })
        .where('id', '=', expenseId)
        .execute();
    }
    await notify(trx, now, {
      userIds: [contest.by_user, expense.paid_by],
      eventId: event.id,
      kind: 'expense.contest_resolved',
      title: 'Contestação decidida',
      body: `"${expense.description}": ${input.decision === 'keep' ? 'mantida' : 'removida da conta'}. ${input.note}`,
      dedupeKey: `expense.contest_resolved:${expenseId}`,
    });
    await audit(trx, now, {
      eventId: event.id,
      actorId: resolverId,
      action: 'expense.contest_resolved',
      entity: 'expense',
      entityId: expenseId,
      data: input,
    });
  });
}
