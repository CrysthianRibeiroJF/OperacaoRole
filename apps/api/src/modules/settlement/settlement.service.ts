import type { BalanceDto, SettlementDto, TransferDto, VaultDto } from '@role/contracts';
import {
  can,
  computeSettlement,
  settlementReminderTimes,
  type Balance,
  type SettlementResult,
} from '@role/domain';
import type { AppContext, Db } from '../../context';
import { conflict, forbidden, notFound } from '../../errors';
import { newId } from '../../ids';
import { audit } from '../../lib/audit';
import { formatBRL } from '../../lib/format';
import { scheduleFilePurge } from '../events/retention.service';
import { scheduleJob } from '../jobs/schedule';
import { dayBucket, notify } from '../notifications/notifications.service';
import {
  buildActor,
  effectiveDepositStatus,
  getTreasurerId,
  requireEvent,
  usersById,
  type EventRow,
} from '../events/event.queries';

/* -------------------------------------------------------------------------------------------- */
/* Entrada do motor de rateio, montada a partir do banco                                         */
/* -------------------------------------------------------------------------------------------- */

interface Computed {
  result: SettlementResult;
  treasurerId: string;
  unresolved: { expenseId: string; description: string }[];
}

/**
 * Roster = confirmados que estão quites com o sinal (quando exigido). O Tesoureiro segura o
 * dinheiro e sempre participa. Só despesas aprovadas entram na conta.
 */
async function compute(db: Db, event: EventRow): Promise<Computed> {
  const treasurerId = await getTreasurerId(db, event);
  const parts = await db
    .selectFrom('participations')
    .selectAll()
    .where('event_id', '=', event.id)
    .where('response', '=', 'in')
    .execute();

  const windowOpen = !!event.deposit_opened_at;
  const roster = parts
    .filter((p) => !windowOpen || effectiveDepositStatus(event, p, treasurerId) === 'approved')
    .map((p) => ({ userId: p.user_id, drinksAlcohol: p.drinks_alcohol === 1, diet: p.diet }));

  const deposits =
    windowOpen && event.deposit_cents
      ? parts
          .filter((p) => p.deposit_status === 'approved' && p.user_id !== treasurerId)
          .map((p) => ({ userId: p.user_id, amountCents: event.deposit_cents! }))
      : [];

  const expenses = await db
    .selectFrom('expenses')
    .selectAll()
    .where('event_id', '=', event.id)
    .where('status', '=', 'approved')
    .execute();
  const custom = expenses.length
    ? await db
        .selectFrom('expense_participants')
        .selectAll()
        .where(
          'expense_id',
          'in',
          expenses.map((e) => e.id),
        )
        .execute()
    : [];

  const result = computeSettlement({
    roster,
    treasurerId,
    deposits,
    expenses: expenses.map((e) => ({
      id: e.id,
      payerId: e.paid_by,
      amountCents: e.amount_cents,
      quota: e.quota,
      customParticipantIds: custom.filter((c) => c.expense_id === e.id).map((c) => c.user_id),
    })),
  });
  const descriptions = new Map(expenses.map((e) => [e.id, e.description]));
  return {
    result,
    treasurerId,
    unresolved: result.issues.map((i) => ({
      expenseId: i.expenseId,
      description: descriptions.get(i.expenseId) ?? '',
    })),
  };
}

const toBalanceDto = (
  b: Balance,
  name: (id: string) => { id: string; name: string },
): BalanceDto => ({
  user: name(b.userId),
  paidCents: b.paidCents,
  depositCents: b.depositCents,
  costCents: b.costCents,
  heldDepositsCents: b.heldDepositsCents,
  netCents: b.netCents,
});

/* -------------------------------------------------------------------------------------------- */
/* Fechamento                                                                                   */
/* -------------------------------------------------------------------------------------------- */

async function blockers(db: Db, event: EventRow, computed: Computed) {
  const pendingExpenses = await db
    .selectFrom('expenses')
    .select(['id', 'description'])
    .where('event_id', '=', event.id)
    .where('status', '=', 'pending')
    .execute();
  const openContests = await db
    .selectFrom('expense_contests')
    .innerJoin('expenses', 'expenses.id', 'expense_contests.expense_id')
    .select(['expenses.id as id', 'expenses.description as description'])
    .where('expenses.event_id', '=', event.id)
    .where('expense_contests.resolved_at', 'is', null)
    .execute();
  const pendingProofs = await db
    .selectFrom('participations')
    .select('user_id')
    .where('event_id', '=', event.id)
    .where('response', '=', 'in')
    .where('deposit_status', '=', 'submitted')
    .execute();
  return {
    pendingExpenses,
    openContests,
    pendingProofs: pendingProofs.length,
    unresolved: computed.unresolved,
  };
}

export async function closeSettlement(
  ctx: AppContext,
  userId: string,
  eventId: string,
): Promise<void> {
  await ctx.db.transaction().execute(async (trx) => {
    const now = ctx.clock.now();
    const event = await requireEvent(trx, eventId);
    const { actor } = await buildActor(trx, event, userId);
    if (!can(actor, 'settlement.close')) throw forbidden('Só o Tesoureiro fecha a conta');
    if (event.status === 'closed')
      throw conflict('ALREADY_CLOSED', 'A conta deste rolê já foi fechada');
    if (event.status !== 'confirmed')
      throw conflict('EVENT_NOT_ACTIVE', 'Só dá para fechar a conta de um rolê confirmado');

    const computed = await compute(trx, event);
    const b = await blockers(trx, event, computed);
    if (
      b.pendingExpenses.length ||
      b.openContests.length ||
      b.pendingProofs ||
      b.unresolved.length
    ) {
      throw conflict('SETTLEMENT_BLOCKED', 'Ainda há pendências antes de fechar a conta', b);
    }

    const settlementId = newId();
    await trx
      .insertInto('settlements')
      .values({
        id: settlementId,
        event_id: eventId,
        closed_by: userId,
        closed_at: now.toISOString(),
        total_expenses_cents: computed.result.totalExpensesCents,
      })
      .execute();
    if (computed.result.balances.length > 0) {
      await trx
        .insertInto('settlement_balances')
        .values(
          computed.result.balances.map((x) => ({
            settlement_id: settlementId,
            user_id: x.userId,
            paid_cents: x.paidCents,
            deposit_cents: x.depositCents,
            cost_cents: x.costCents,
            held_deposits_cents: x.heldDepositsCents,
            net_cents: x.netCents,
          })),
        )
        .execute();
    }
    if (computed.result.transfers.length > 0) {
      await trx
        .insertInto('settlement_transfers')
        .values(
          computed.result.transfers.map((t) => ({
            id: newId(),
            settlement_id: settlementId,
            from_user: t.fromUserId,
            to_user: t.toUserId,
            amount_cents: t.amountCents,
            paid_at: null,
            confirmed_by: null,
          })),
        )
        .execute();
    }
    await trx
      .updateTable('events')
      .set({ status: 'closed', closed_at: now.toISOString() })
      .where('id', '=', eventId)
      .execute();

    // Cobrança pós-rolê (RN-52): cada devedor recebe o aviso, privadamente.
    const users = await usersById(
      trx,
      computed.result.transfers.flatMap((t) => [t.fromUserId, t.toUserId]),
    );
    for (const t of computed.result.transfers) {
      await notify(trx, now, {
        userIds: [t.fromUserId],
        eventId,
        kind: 'settlement.closed',
        title: 'A conta do rolê fechou',
        body: `Seu saldo é de ${formatBRL(t.amountCents)} para ${users.get(t.toUserId)?.name ?? 'o grupo'}. Abra o Cofre para copiar a chave Pix e quitar.`,
        dedupeKey: `settlement.closed:${eventId}:${t.fromUserId}:${t.toUserId}`,
      });
    }
    const creditors = [...new Set(computed.result.transfers.map((t) => t.toUserId))];
    await notify(trx, now, {
      userIds: creditors,
      eventId,
      kind: 'settlement.receivable',
      title: 'A conta fechou: você tem a receber',
      body: 'Abra o Cofre para ver quem vai te pagar.',
      dedupeKey: `settlement.receivable:${eventId}`,
    });
    for (const [i, runAt] of settlementReminderTimes(now).entries()) {
      await scheduleJob(trx, now, {
        kind: 'settlement.remind',
        runAt,
        payload: { settlementId },
        dedupeKey: `settlement.remind:${settlementId}:${i}`,
      });
    }
    await scheduleFilePurge(trx, now, eventId);
    await audit(trx, now, {
      eventId,
      actorId: userId,
      action: 'settlement.closed',
      entity: 'settlement',
      entityId: settlementId,
      data: {
        totalExpensesCents: computed.result.totalExpensesCents,
        transfers: computed.result.transfers.length,
      },
    });
  });
}

/* -------------------------------------------------------------------------------------------- */
/* Leitura                                                                                      */
/* -------------------------------------------------------------------------------------------- */

export async function getSettlement(
  ctx: AppContext,
  userId: string,
  eventId: string,
): Promise<SettlementDto> {
  const event = await requireEvent(ctx.db, eventId);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'event.viewInternal')) throw forbidden('Confirme presença para ver a conta');
  const isTreasurer = can(actor, 'settlement.viewAll');

  const stored = await ctx.db
    .selectFrom('settlements')
    .selectAll()
    .where('event_id', '=', eventId)
    .executeTakeFirst();
  const empty: SettlementDto = {
    closed: false,
    closedAt: null,
    totalExpensesCents: 0,
    balances: [],
    transfers: [],
    issues: [],
  };

  if (stored) {
    const [balances, transfers] = await Promise.all([
      ctx.db
        .selectFrom('settlement_balances')
        .selectAll()
        .where('settlement_id', '=', stored.id)
        .execute(),
      ctx.db
        .selectFrom('settlement_transfers')
        .selectAll()
        .where('settlement_id', '=', stored.id)
        .execute(),
    ]);
    const users = await usersById(ctx.db, [
      ...balances.map((b) => b.user_id),
      ...transfers.flatMap((t) => [t.from_user, t.to_user]),
    ]);
    const name = (id: string) => users.get(id) ?? { id, name: '—' };
    const pixKeys = await pixKeysFor(
      ctx.db,
      event,
      transfers.map((t) => t.to_user),
    );
    const visible = (t: { from_user: string; to_user: string }) =>
      isTreasurer || t.from_user === userId || t.to_user === userId;

    return {
      closed: true,
      closedAt: stored.closed_at,
      totalExpensesCents: stored.total_expenses_cents,
      balances: balances
        .filter((b) => isTreasurer || b.user_id === userId)
        .map((b) =>
          toBalanceDto(
            {
              userId: b.user_id,
              paidCents: b.paid_cents,
              depositCents: b.deposit_cents,
              costCents: b.cost_cents,
              heldDepositsCents: b.held_deposits_cents,
              netCents: b.net_cents,
            },
            name,
          ),
        ),
      transfers: transfers.filter(visible).map((t) => toTransferDto(t, name, pixKeys)),
      issues: [],
    };
  }

  if (!isTreasurer) return empty;

  // Prévia para o Tesoureiro enquanto a conta está aberta.
  const computed = await compute(ctx.db, event);
  const users = await usersById(ctx.db, [
    ...computed.result.balances.map((b) => b.userId),
    ...computed.result.transfers.flatMap((t) => [t.fromUserId, t.toUserId]),
  ]);
  const name = (id: string) => users.get(id) ?? { id, name: '—' };
  const pixKeys = await pixKeysFor(
    ctx.db,
    event,
    computed.result.transfers.map((t) => t.toUserId),
  );
  return {
    closed: false,
    closedAt: null,
    totalExpensesCents: computed.result.totalExpensesCents,
    balances: computed.result.balances.map((b) => toBalanceDto(b, name)),
    transfers: computed.result.transfers.map((t, i) =>
      toTransferDto(
        {
          id: `preview-${i}`,
          from_user: t.fromUserId,
          to_user: t.toUserId,
          amount_cents: t.amountCents,
          paid_at: null,
        },
        name,
        pixKeys,
      ),
    ),
    issues: computed.unresolved.map((u) => ({ ...u, code: 'NO_BENEFICIARIES' as const })),
  };
}

export async function getBlockers(ctx: AppContext, userId: string, eventId: string) {
  const event = await requireEvent(ctx.db, eventId);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'settlement.close'))
    throw forbidden('Só o Tesoureiro vê as pendências do fechamento');
  return blockers(ctx.db, event, await compute(ctx.db, event));
}

export async function getVault(
  ctx: AppContext,
  userId: string,
  eventId: string,
): Promise<VaultDto> {
  const event = await requireEvent(ctx.db, eventId);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'event.viewInternal')) throw forbidden('Confirme presença para abrir o Cofre');

  const stored = await ctx.db
    .selectFrom('settlements')
    .selectAll()
    .where('event_id', '=', eventId)
    .executeTakeFirst();
  const pendingRow = await ctx.db
    .selectFrom('expenses')
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('event_id', '=', eventId)
    .where('paid_by', '=', userId)
    .where('status', '=', 'pending')
    .executeTakeFirstOrThrow();

  if (stored) {
    const b = await ctx.db
      .selectFrom('settlement_balances')
      .selectAll()
      .where('settlement_id', '=', stored.id)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    return {
      paidByMeCents: b?.paid_cents ?? 0,
      depositPaidCents: b?.deposit_cents ?? 0,
      projectedShareCents: b?.cost_cents ?? 0,
      projectedNetCents: b?.net_cents ?? 0,
      pendingExpenses: Number(pendingRow.n),
      settled: true,
    };
  }

  const { result } = await compute(ctx.db, event);
  const mine = result.balances.find((x) => x.userId === userId);
  return {
    paidByMeCents: mine?.paidCents ?? 0,
    depositPaidCents: mine?.depositCents ?? 0,
    projectedShareCents: mine?.costCents ?? 0,
    projectedNetCents: mine?.netCents ?? 0,
    pendingExpenses: Number(pendingRow.n),
    settled: false,
  };
}

async function pixKeysFor(
  db: Db,
  event: EventRow,
  userIds: readonly string[],
): Promise<Map<string, string | null>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const rows = await db
    .selectFrom('users')
    .select(['id', 'pix_key'])
    .where('id', 'in', ids)
    .execute();
  const treasurerId = await getTreasurerId(db, event);
  // Se o credor é o Tesoureiro e não cadastrou Pix no perfil, usa a chave do sinal.
  return new Map(
    rows.map((r) => [r.id, r.pix_key ?? (r.id === treasurerId ? event.deposit_pix_key : null)]),
  );
}

function toTransferDto(
  t: {
    id: string;
    from_user: string;
    to_user: string;
    amount_cents: number;
    paid_at: string | null;
  },
  name: (id: string) => { id: string; name: string },
  pixKeys: Map<string, string | null>,
): TransferDto {
  return {
    id: t.id,
    from: name(t.from_user),
    to: name(t.to_user),
    amountCents: t.amount_cents,
    toPixKey: pixKeys.get(t.to_user) ?? null,
    paidAt: t.paid_at,
  };
}

/** O credor (ou o Tesoureiro) dá baixa quando o Pix cai na conta. */
export async function confirmTransfer(
  ctx: AppContext,
  userId: string,
  transferId: string,
): Promise<void> {
  await ctx.db.transaction().execute(async (trx) => {
    const now = ctx.clock.now();
    const transfer = await trx
      .selectFrom('settlement_transfers')
      .selectAll()
      .where('id', '=', transferId)
      .executeTakeFirst();
    if (!transfer) throw notFound('Transferência não encontrada');
    const settlement = await trx
      .selectFrom('settlements')
      .selectAll()
      .where('id', '=', transfer.settlement_id)
      .executeTakeFirstOrThrow();
    const event = await requireEvent(trx, settlement.event_id);
    const { actor } = await buildActor(trx, event, userId);
    if (transfer.to_user !== userId && !can(actor, 'settlement.close')) {
      throw forbidden('Só quem recebe (ou o Tesoureiro) confirma o pagamento');
    }
    if (transfer.paid_at) return;

    await trx
      .updateTable('settlement_transfers')
      .set({ paid_at: now.toISOString(), confirmed_by: userId })
      .where('id', '=', transferId)
      .execute();
    await notify(trx, now, {
      userIds: [transfer.from_user],
      eventId: event.id,
      kind: 'settlement.paid',
      title: 'Pagamento confirmado',
      body: `Seu pagamento de ${formatBRL(transfer.amount_cents)} foi confirmado. Obrigado!`,
      dedupeKey: `settlement.paid:${transferId}`,
    });
    await audit(trx, now, {
      eventId: event.id,
      actorId: userId,
      action: 'transfer.confirmed',
      entity: 'transfer',
      entityId: transferId,
    });
  });
}

/** Job: lembrete D+3 / D+7 só para quem ainda deve (RN-52), sempre em privado. */
export async function remindDebtors(db: Db, now: Date, settlementId: string): Promise<void> {
  const settlement = await db
    .selectFrom('settlements')
    .selectAll()
    .where('id', '=', settlementId)
    .executeTakeFirst();
  if (!settlement) return;
  const open = await db
    .selectFrom('settlement_transfers')
    .selectAll()
    .where('settlement_id', '=', settlementId)
    .where('paid_at', 'is', null)
    .execute();
  if (open.length === 0) return;
  const event = await requireEvent(db, settlement.event_id);
  const users = await usersById(
    db,
    open.map((t) => t.to_user),
  );
  for (const t of open) {
    await notify(db, now, {
      userIds: [t.from_user],
      eventId: event.id,
      kind: 'settlement.reminder',
      title: 'Lembrete: acerto do rolê',
      body: `Falta quitar ${formatBRL(t.amount_cents)} com ${users.get(t.to_user)?.name ?? 'o grupo'} (${event.title}).`,
      dedupeKey: `settlement.reminder:${t.id}:${dayBucket(now)}`,
    });
  }
}
