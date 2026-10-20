import type { DepositConfig, DepositQueueItem } from '@role/contracts';
import { can, depositReminderTimes } from '@role/domain';
import type { Readable } from 'node:stream';
import type { AppContext, Db } from '../../context';
import { AppError, conflict, forbidden, notFound, unprocessable } from '../../errors';
import { newId } from '../../ids';
import { audit } from '../../lib/audit';
import { fmtDateTime, formatBRL } from '../../lib/format';
import { detectFile } from '../../lib/sniff';
import { scheduleJob } from '../jobs/schedule';
import { dayBucket, notify } from '../notifications/notifications.service';
import {
  buildActor,
  confirmedUserIds,
  effectiveDepositStatus,
  getParticipation,
  getTreasurerId,
  requireEvent,
  usersById,
  type EventRow,
} from '../events/event.queries';

const DEFAULT_WINDOW_MS = 48 * 3_600_000;

export function toDepositConfig(event: EventRow): DepositConfig {
  return {
    required: event.deposit_required === 1,
    amountCents: event.deposit_cents,
    pixKey: event.deposit_pix_key,
    deadlineAt: event.deposit_deadline_at,
    openedAt: event.deposit_opened_at,
  };
}

async function scheduleDepositJobs(db: Db, now: Date, event: EventRow, deadline: Date) {
  const stamp = deadline.toISOString();
  await scheduleJob(db, now, {
    kind: 'deposit.expire',
    runAt: deadline,
    payload: { eventId: event.id },
    dedupeKey: `deposit.expire:${event.id}:${stamp}`,
  });
  for (const runAt of depositReminderTimes(deadline)) {
    if (runAt.getTime() <= now.getTime()) continue;
    const hours = Math.round((deadline.getTime() - runAt.getTime()) / 3_600_000);
    await scheduleJob(db, now, {
      kind: 'deposit.remind',
      runAt,
      payload: { eventId: event.id, hours },
      dedupeKey: `deposit.remind:${event.id}:${hours}:${stamp}`,
    });
  }
}

/**
 * Abre a Janela do Sinal quando o rolê está confirmado e a configuração está completa (RN-10/RN-11).
 * Idempotente: chamar de novo não reabre nem duplica avisos.
 */
export async function openDepositWindowIfReady(
  db: Db,
  now: Date,
  event: EventRow,
): Promise<EventRow> {
  const ready =
    event.deposit_required === 1 &&
    event.status === 'confirmed' &&
    !event.deposit_opened_at &&
    event.deposit_cents !== null &&
    event.deposit_pix_key !== null;
  if (!ready) return event;

  const deadline = event.deposit_deadline_at
    ? new Date(event.deposit_deadline_at)
    : new Date(now.getTime() + DEFAULT_WINDOW_MS);

  await db
    .updateTable('events')
    .set({ deposit_opened_at: now.toISOString(), deposit_deadline_at: deadline.toISOString() })
    .where('id', '=', event.id)
    .execute();
  await db
    .updateTable('participations')
    .set({ deposit_status: 'pending' })
    .where('event_id', '=', event.id)
    .where('response', '=', 'in')
    .execute();

  const treasurerId = await getTreasurerId(db, event);
  const payers = (await confirmedUserIds(db, event.id)).filter((id) => id !== treasurerId);
  await notify(db, now, {
    userIds: payers,
    eventId: event.id,
    kind: 'deposit.window_opened',
    title: 'Hora do sinal',
    body: `Pague ${formatBRL(event.deposit_cents!)} no Pix e anexe o comprovante até ${fmtDateTime(deadline)}. Sem comprovante, a vaga vai para a fila de espera.`,
    dedupeKey: `deposit.window_opened:${event.id}`,
  });
  await scheduleDepositJobs(db, now, event, deadline);
  await audit(db, now, {
    eventId: event.id,
    actorId: null,
    action: 'deposit.window_opened',
    entity: 'event',
    entityId: event.id,
    data: { deadline: deadline.toISOString(), amountCents: event.deposit_cents },
  });

  return requireEvent(db, event.id);
}

export async function configureDeposit(
  ctx: AppContext,
  userId: string,
  eventId: string,
  input: {
    required: boolean;
    amountCents?: number | undefined;
    pixKey?: string | undefined;
    deadlineAt?: string | undefined;
  },
): Promise<DepositConfig> {
  return ctx.db.transaction().execute(async (trx) => {
    const now = ctx.clock.now();
    let event = await requireEvent(trx, eventId);
    const { actor } = await buildActor(trx, event, userId);
    if (!can(actor, 'deposit.configure')) throw forbidden('Só o Tesoureiro configura o sinal');
    if (event.status !== 'open' && event.status !== 'confirmed') {
      throw conflict('EVENT_NOT_ACTIVE', 'Este rolê não aceita mais alterações');
    }

    if (!input.required) {
      if (event.deposit_opened_at) {
        throw conflict(
          'DEPOSIT_WINDOW_OPEN',
          'A janela do sinal já foi aberta e não pode ser desligada',
        );
      }
      await trx
        .updateTable('events')
        .set({ deposit_required: 0 })
        .where('id', '=', eventId)
        .execute();
      return toDepositConfig(await requireEvent(trx, eventId));
    }

    const amount = input.amountCents ?? event.deposit_cents;
    const pixKey = input.pixKey ?? event.deposit_pix_key;
    if (!amount || !pixKey) {
      throw unprocessable('DEPOSIT_INCOMPLETE', 'Informe o valor do sinal e a chave Pix');
    }
    if (event.deposit_opened_at && amount !== event.deposit_cents) {
      throw conflict(
        'DEPOSIT_AMOUNT_LOCKED',
        'O valor não muda depois que o pessoal começou a pagar',
      );
    }

    let deadline = event.deposit_deadline_at;
    if (input.deadlineAt) {
      const parsed = new Date(input.deadlineAt);
      if (parsed.getTime() <= now.getTime())
        throw unprocessable('DEADLINE_IN_PAST', 'O prazo precisa estar no futuro');
      deadline = parsed.toISOString();
    }

    await trx
      .updateTable('events')
      .set({
        deposit_required: 1,
        deposit_cents: amount,
        deposit_pix_key: pixKey,
        deposit_deadline_at: deadline,
      })
      .where('id', '=', eventId)
      .execute();
    event = await requireEvent(trx, eventId);

    if (event.deposit_opened_at && input.deadlineAt) {
      await scheduleDepositJobs(trx, now, event, new Date(event.deposit_deadline_at!));
    } else {
      event = await openDepositWindowIfReady(trx, now, event);
    }
    await audit(trx, now, {
      eventId,
      actorId: userId,
      action: 'deposit.configured',
      entity: 'event',
      entityId: eventId,
      data: { amountCents: amount, deadline },
    });
    return toDepositConfig(event);
  });
}

export async function submitProof(
  ctx: AppContext,
  userId: string,
  eventId: string,
  data: Buffer,
): Promise<void> {
  const detected = detectFile(data);
  if (!detected)
    throw new AppError(415, 'UNSUPPORTED_FILE', 'Envie uma imagem (JPG, PNG, WebP) ou PDF');

  const event = await requireEvent(ctx.db, eventId);
  const participation = await getParticipation(ctx.db, eventId, userId);
  if (!participation || participation.response !== 'in')
    throw forbidden('Confirme presença antes de enviar o sinal');
  if (event.status !== 'confirmed' || !event.deposit_opened_at) {
    throw conflict('DEPOSIT_NOT_OPEN', 'A janela do sinal não está aberta');
  }
  const treasurerId = await getTreasurerId(ctx.db, event);
  if (userId === treasurerId) throw conflict('NOT_NEEDED', 'O Tesoureiro não precisa enviar sinal');
  const status = effectiveDepositStatus(event, participation, treasurerId);
  if (status === 'approved') throw conflict('ALREADY_APPROVED', 'Seu sinal já foi aprovado');
  if (status === 'submitted') throw conflict('PROOF_PENDING', 'Seu comprovante já está em análise');

  const key = await ctx.storage.save(`proofs/${eventId}`, data, detected.extension);

  await ctx.db.transaction().execute(async (trx) => {
    const now = ctx.clock.now();
    await trx
      .insertInto('deposit_proofs')
      .values({
        id: newId(),
        event_id: eventId,
        user_id: userId,
        file_key: key,
        mime: detected.mime,
        size_bytes: data.length,
        status: 'submitted',
        reject_reason: null,
        reviewed_by: null,
        submitted_at: now.toISOString(),
        reviewed_at: null,
      })
      .execute();
    await trx
      .updateTable('participations')
      .set({ deposit_status: 'submitted' })
      .where('event_id', '=', eventId)
      .where('user_id', '=', userId)
      .execute();
    const names = await usersById(trx, [userId]);
    await notify(trx, now, {
      userIds: [treasurerId],
      eventId,
      kind: 'deposit.proof_submitted',
      title: 'Novo comprovante de sinal',
      body: `${names.get(userId)?.name ?? 'Alguém'} enviou o comprovante de ${event.title}. Confira e aprove.`,
      dedupeKey: `deposit.proof_submitted:${eventId}:${userId}:${now.getTime()}`,
    });
    await audit(trx, now, {
      eventId,
      actorId: userId,
      action: 'deposit.proof_submitted',
      entity: 'participation',
      entityId: userId,
    });
  });
}

export async function listDepositQueue(
  ctx: AppContext,
  userId: string,
  eventId: string,
): Promise<DepositQueueItem[]> {
  const event = await requireEvent(ctx.db, eventId);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'deposit.review')) throw forbidden('Só o Tesoureiro vê a fila de comprovantes');

  const treasurerId = await getTreasurerId(ctx.db, event);
  const rows = await ctx.db
    .selectFrom('participations')
    .selectAll()
    .where('event_id', '=', eventId)
    .where('response', '=', 'in')
    .orderBy('responded_at')
    .execute();
  const proofs = await ctx.db
    .selectFrom('deposit_proofs')
    .selectAll()
    .where('event_id', '=', eventId)
    .orderBy('submitted_at', 'desc')
    .execute();
  const latest = new Map<string, (typeof proofs)[number]>();
  for (const p of proofs) if (!latest.has(p.user_id)) latest.set(p.user_id, p);

  const users = await usersById(
    ctx.db,
    rows.map((r) => r.user_id),
  );
  return rows
    .filter((r) => r.user_id !== treasurerId)
    .map((r) => {
      const proof = latest.get(r.user_id);
      return {
        user: users.get(r.user_id) ?? { id: r.user_id, name: '—' },
        status: effectiveDepositStatus(event, r, treasurerId),
        submittedAt: proof?.submitted_at ?? null,
        rejectReason: proof?.status === 'rejected' ? proof.reject_reason : null,
        hasProof: !!proof,
      };
    });
}

export async function reviewDeposit(
  ctx: AppContext,
  reviewerId: string,
  eventId: string,
  targetUserId: string,
  input: { decision: 'approve' | 'reject'; reason?: string | undefined },
): Promise<void> {
  await ctx.db.transaction().execute(async (trx) => {
    const now = ctx.clock.now();
    const event = await requireEvent(trx, eventId);
    const { actor } = await buildActor(trx, event, reviewerId);
    if (!can(actor, 'deposit.review')) throw forbidden('Só o Tesoureiro valida comprovantes');
    if (event.status !== 'confirmed')
      throw conflict('EVENT_NOT_ACTIVE', 'Este rolê não aceita mais alterações');

    const proof = await trx
      .selectFrom('deposit_proofs')
      .selectAll()
      .where('event_id', '=', eventId)
      .where('user_id', '=', targetUserId)
      .where('status', '=', 'submitted')
      .orderBy('submitted_at', 'desc')
      .executeTakeFirst();
    if (!proof) throw notFound('Não há comprovante aguardando análise');

    const approve = input.decision === 'approve';
    await trx
      .updateTable('deposit_proofs')
      .set({
        status: approve ? 'approved' : 'rejected',
        reject_reason: approve ? null : (input.reason ?? null),
        reviewed_by: reviewerId,
        reviewed_at: now.toISOString(),
      })
      .where('id', '=', proof.id)
      .execute();
    await trx
      .updateTable('participations')
      .set({ deposit_status: approve ? 'approved' : 'rejected' })
      .where('event_id', '=', eventId)
      .where('user_id', '=', targetUserId)
      .execute();

    await notify(trx, now, {
      userIds: [targetUserId],
      eventId,
      kind: approve ? 'deposit.approved' : 'deposit.rejected',
      title: approve ? 'Sinal aprovado' : 'Comprovante recusado',
      body: approve
        ? `Sua vaga em ${event.title} está garantida. Agora você pode escolher seu lugar.`
        : `O Tesoureiro recusou o comprovante: ${input.reason}. Envie outro para garantir a vaga.`,
      dedupeKey: `deposit.review:${proof.id}`,
    });
    await audit(trx, now, {
      eventId,
      actorId: reviewerId,
      action: approve ? 'deposit.approved' : 'deposit.rejected',
      entity: 'participation',
      entityId: targetUserId,
      data: { reason: input.reason ?? null },
    });
  });
}

export async function openProofFile(
  ctx: AppContext,
  requesterId: string,
  eventId: string,
  targetUserId: string,
): Promise<{ stream: Readable; mime: string }> {
  const event = await requireEvent(ctx.db, eventId);
  const { actor } = await buildActor(ctx.db, event, requesterId);
  const isOwner = requesterId === targetUserId;
  if (!isOwner && !can(actor, 'deposit.review')) throw forbidden('Sem acesso a este comprovante');

  const proof = await ctx.db
    .selectFrom('deposit_proofs')
    .selectAll()
    .where('event_id', '=', eventId)
    .where('user_id', '=', targetUserId)
    .orderBy('submitted_at', 'desc')
    .executeTakeFirst();
  if (!proof) throw notFound('Comprovante não encontrado');
  return { stream: ctx.storage.open(proof.file_key), mime: proof.mime };
}

/** Job: prazo do sinal venceu → quem não pagou volta para a lista de espera (RN-13). */
export async function expireDepositWindow(db: Db, now: Date, eventId: string): Promise<void> {
  const event = await requireEvent(db, eventId);
  if (event.status !== 'confirmed' || !event.deposit_opened_at || !event.deposit_deadline_at)
    return;
  if (new Date(event.deposit_deadline_at).getTime() > now.getTime()) return; // prazo foi estendido

  const treasurerId = await getTreasurerId(db, event);
  const late = await db
    .selectFrom('participations')
    .select('user_id')
    .where('event_id', '=', eventId)
    .where('response', '=', 'in')
    .where('deposit_status', 'in', ['pending', 'rejected'])
    .where('user_id', '!=', treasurerId)
    .execute();
  if (late.length === 0) return;

  const ids = late.map((l) => l.user_id);
  await db
    .updateTable('participations')
    .set({ deposit_status: 'waitlisted' })
    .where('event_id', '=', eventId)
    .where('user_id', 'in', ids)
    .execute();
  await notify(db, now, {
    userIds: ids,
    eventId,
    kind: 'deposit.waitlisted',
    title: 'Você foi para a fila de espera',
    body: `O prazo do sinal de ${event.title} acabou. Envie o comprovante e fale com o Tesoureiro para voltar à lista.`,
    dedupeKey: `deposit.waitlisted:${eventId}`,
  });
  await audit(db, now, {
    eventId,
    actorId: null,
    action: 'deposit.waitlisted',
    entity: 'event',
    entityId: eventId,
    data: { userIds: ids },
  });
}

/** Job: alerta de degola (RN-50: no máximo 1 por gatilho a cada 24h). */
export async function remindDeposit(
  db: Db,
  now: Date,
  eventId: string,
  hours: number,
): Promise<void> {
  const event = await requireEvent(db, eventId);
  if (event.status !== 'confirmed' || !event.deposit_opened_at || !event.deposit_deadline_at)
    return;
  const deadline = new Date(event.deposit_deadline_at);
  if (deadline.getTime() <= now.getTime()) return;

  const treasurerId = await getTreasurerId(db, event);
  const pending = await db
    .selectFrom('participations')
    .select('user_id')
    .where('event_id', '=', eventId)
    .where('response', '=', 'in')
    .where('deposit_status', 'in', ['pending', 'rejected'])
    .where('user_id', '!=', treasurerId)
    .execute();
  await notify(db, now, {
    userIds: pending.map((p) => p.user_id),
    eventId,
    kind: 'deposit.reminder',
    title: 'Atenção: prazo do sinal',
    body: `O prazo do Pix de ${event.title} vence ${fmtDateTime(deadline)}. Vagas não pagas vão para a fila de espera.`,
    dedupeKey: `deposit.reminder:${eventId}:${hours}h:${dayBucket(now)}`,
  });
}
