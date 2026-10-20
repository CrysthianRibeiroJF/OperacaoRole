import type {
  BaseInfo,
  CreateEventInput,
  EventCard,
  EventDetail,
  FeedItem,
  InviteView,
  RespondInput,
  RosterEntry,
} from '@role/contracts';
import { evaluateQuorum, can, ROLE_KEYS, vacantRoleAlertTime } from '@role/domain';
import type { AppContext, Db } from '../../context';
import { AppError, conflict, forbidden, notFound, unprocessable } from '../../errors';
import { newId, newInviteCode } from '../../ids';
import { audit } from '../../lib/audit';
import { openDepositWindowIfReady, toDepositConfig } from '../deposits/deposits.service';
import { scheduleJob } from '../jobs/schedule';
import { dayBucket, notify } from '../notifications/notifications.service';
import {
  buildActor,
  buildMyContext,
  confirmedUserIds,
  countConfirmed,
  effectiveDepositStatus,
  findEventByCode,
  getEventRoles,
  getParticipation,
  getTreasurerId,
  requireEvent,
  toEventCard,
  toEventCards,
  usersById,
  type EventRow,
} from './event.queries';

/* -------------------------------------------------------------------------------------------- */
/* Criação                                                                                      */
/* -------------------------------------------------------------------------------------------- */

export async function createEvent(
  ctx: AppContext,
  userId: string,
  input: CreateEventInput,
): Promise<EventCard> {
  const now = ctx.clock.now();
  const deadline = new Date(now.getTime() + input.responseHours * 3_600_000);

  const id = newId();
  await ctx.db.transaction().execute(async (trx) => {
    let inserted = false;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      try {
        await trx
          .insertInto('events')
          .values({
            id,
            code: newInviteCode(),
            organizer_id: userId,
            title: input.title,
            destination: input.destination,
            start_date: input.startDate,
            end_date: input.endDate ?? null,
            cost_cap_cents: input.costCapCents,
            quorum: input.quorum,
            status: 'open',
            response_deadline_at: deadline.toISOString(),
            created_at: now.toISOString(),
            confirmed_at: null,
            closed_at: null,
            cancelled_at: null,
            max_roles_per_user: 2,
            expense_approval_threshold_cents: ctx.config.EXPENSE_APPROVAL_THRESHOLD_CENTS,
            deposit_required: input.requiresDeposit ? 1 : 0,
            deposit_cents: input.requiresDeposit ? (input.depositCents ?? null) : null,
            deposit_pix_key: input.requiresDeposit ? (input.pixKey ?? null) : null,
            deposit_deadline_at: null,
            deposit_opened_at: null,
            base_address: null,
            base_wifi_name: null,
            base_wifi_password: null,
            base_gate_code: null,
            base_checkout_time: null,
            base_house_rules: null,
            base_schedule: null,
            fixed_costs_cents: null,
          })
          .execute();
        inserted = true;
      } catch (err) {
        // Colisão de código curto: tenta outro. Qualquer outro erro sobe.
        if (!(err instanceof Error) || !/UNIQUE.*events\.code/i.test(err.message)) throw err;
      }
    }
    if (!inserted)
      throw new AppError(500, 'CODE_COLLISION', 'Não foi possível gerar o convite. Tente de novo.');

    // RN-02: o Idealizador é a primeira andorinha.
    await trx
      .insertInto('participations')
      .values({
        id: newId(),
        event_id: id,
        user_id: userId,
        response: 'in',
        drinks_alcohol: 0,
        diet: 'omnivore',
        deposit_status: 'none',
        responded_at: now.toISOString(),
      })
      .execute();

    await scheduleJob(trx, now, {
      kind: 'event.expire',
      runAt: deadline,
      payload: { eventId: id },
      dedupeKey: `event.expire:${id}`,
    });
    await audit(trx, now, {
      eventId: id,
      actorId: userId,
      action: 'event.created',
      entity: 'event',
      entityId: id,
    });
  });

  return toEventCard(ctx.db, await requireEvent(ctx.db, id));
}

/* -------------------------------------------------------------------------------------------- */
/* Expiração e confirmação (motor de massa crítica)                                              */
/* -------------------------------------------------------------------------------------------- */

/** RN-04: proposta sem quórum depois do prazo é arquivada. Seguro de chamar várias vezes. */
export async function expireEventIfNeeded(db: Db, now: Date, eventId: string): Promise<void> {
  await db.transaction().execute(async (trx) => {
    const event = await requireEvent(trx, eventId);
    if (event.status !== 'open') return;
    const confirmedCount = await countConfirmed(trx, eventId);
    const result = evaluateQuorum({
      status: event.status,
      quorum: event.quorum,
      confirmedCount,
      responseDeadlineAt: new Date(event.response_deadline_at),
      now,
    });
    if (!result.changed) return;
    if (result.status === 'archived') {
      await trx
        .updateTable('events')
        .set({ status: 'archived' })
        .where('id', '=', eventId)
        .execute();
      await notify(trx, now, {
        userIds: await confirmedUserIds(trx, eventId),
        eventId,
        kind: 'event.archived',
        title: 'Proposta arquivada',
        body: `${event.title} não chegou a ${event.quorum} confirmações a tempo. Sem ressentimentos: é só lançar outra!`,
        dedupeKey: `event.archived:${eventId}`,
      });
      await audit(trx, now, {
        eventId,
        actorId: null,
        action: 'event.archived',
        entity: 'event',
        entityId: eventId,
      });
    }
  });
}

async function confirmEvent(trx: Db, now: Date, event: EventRow): Promise<EventRow> {
  await trx
    .updateTable('events')
    .set({ status: 'confirmed', confirmed_at: now.toISOString() })
    .where('id', '=', event.id)
    .execute();
  let updated = await requireEvent(trx, event.id);

  const members = await confirmedUserIds(trx, event.id);
  await notify(trx, now, {
    userIds: members,
    eventId: event.id,
    kind: 'event.confirmed',
    title: 'Rolê confirmado!',
    body: `${event.title} virou oficial com ${members.length} andorinhas. Hora de dividir as missões.`,
    dedupeKey: `event.confirmed:${event.id}`,
  });

  // Alerta de cargo vago 2 dias antes (ou logo em seguida, se o rolê está perto).
  const alertAt = vacantRoleAlertTime(new Date(`${event.start_date}T12:00:00-03:00`));
  await scheduleJob(trx, now, {
    kind: 'roles.vacant',
    runAt: alertAt.getTime() > now.getTime() ? alertAt : new Date(now.getTime() + 60_000),
    payload: { eventId: event.id },
    dedupeKey: `roles.vacant:${event.id}`,
  });

  updated = await openDepositWindowIfReady(trx, now, updated);
  await audit(trx, now, {
    eventId: event.id,
    actorId: null,
    action: 'event.confirmed',
    entity: 'event',
    entityId: event.id,
  });
  return updated;
}

/* -------------------------------------------------------------------------------------------- */
/* Respostas "Tô Dentro" / "Passo"                                                               */
/* -------------------------------------------------------------------------------------------- */

export async function respond(
  ctx: AppContext,
  userId: string,
  eventId: string,
  input: RespondInput,
): Promise<InviteView> {
  const now = ctx.clock.now();
  await expireEventIfNeeded(ctx.db, now, eventId);

  await ctx.db.transaction().execute(async (trx) => {
    const event = await requireEvent(trx, eventId);
    if (event.status === 'archived')
      throw conflict('EVENT_EXPIRED', 'O prazo desta proposta acabou');
    if (event.status === 'cancelled') throw conflict('EVENT_CANCELLED', 'Este rolê foi cancelado');
    if (event.status === 'closed') throw conflict('EVENT_CLOSED', 'Este rolê já foi encerrado');

    const isOrganizer = event.organizer_id === userId;
    if (isOrganizer && input.response === 'out') {
      throw unprocessable(
        'ORGANIZER_CANNOT_PASS',
        'Quem criou o rolê não pode ficar de fora. Cancele o rolê, se for o caso.',
      );
    }

    const existing = await getParticipation(trx, eventId, userId);
    const wasIn = existing?.response === 'in';
    const goingIn = input.response === 'in';

    const drinks = input.drinksAlcohol ?? existing?.drinks_alcohol === 1;
    const diet = input.diet ?? existing?.diet ?? 'omnivore';

    // Sinal: quem entra com a janela aberta nasce "pendente" (ou na fila, se o prazo já passou).
    let depositStatus = existing?.deposit_status ?? 'none';
    if (goingIn && !wasIn && event.deposit_opened_at) {
      const keep = depositStatus === 'approved' || depositStatus === 'submitted';
      if (!keep) {
        const late =
          event.deposit_deadline_at &&
          new Date(event.deposit_deadline_at).getTime() <= now.getTime();
        depositStatus = late ? 'waitlisted' : 'pending';
      }
    }

    if (existing) {
      await trx
        .updateTable('participations')
        .set({
          response: input.response,
          drinks_alcohol: drinks ? 1 : 0,
          diet,
          deposit_status: depositStatus,
          responded_at: wasIn === goingIn ? existing.responded_at : now.toISOString(),
        })
        .where('id', '=', existing.id)
        .execute();
    } else {
      await trx
        .insertInto('participations')
        .values({
          id: newId(),
          event_id: eventId,
          user_id: userId,
          response: input.response,
          drinks_alcohol: drinks ? 1 : 0,
          diet,
          deposit_status: depositStatus,
          responded_at: now.toISOString(),
        })
        .execute();
    }

    const changedSide = wasIn !== goingIn;
    if (!changedSide) return; // resposta repetida: idempotente, sem efeitos colaterais

    const names = await usersById(trx, [userId]);
    const who = names.get(userId)?.name ?? 'Alguém';
    const confirmedCount = await countConfirmed(trx, eventId);
    const quorum = evaluateQuorum({
      status: event.status,
      quorum: event.quorum,
      confirmedCount,
      responseDeadlineAt: new Date(event.response_deadline_at),
      now,
    });

    if (quorum.changed && quorum.status === 'confirmed') {
      await confirmEvent(trx, now, event);
    } else if (event.status === 'open' && goingIn && quorum.missing === 1) {
      const others = (await confirmedUserIds(trx, eventId)).filter((id) => id !== userId);
      await notify(trx, now, {
        userIds: others,
        eventId,
        kind: 'quorum.almost',
        title: 'Falta só 1!',
        body: `Falta apenas 1 pessoa confirmar para ${event.title} virar oficial!`,
        dedupeKey: `quorum.almost:${eventId}`,
      });
    }

    if (!goingIn && event.status === 'confirmed') {
      if (quorum.belowQuorum) {
        await notify(trx, now, {
          userIds: [event.organizer_id],
          eventId,
          kind: 'quorum.below',
          title: 'O rolê ficou abaixo do mínimo',
          body: `${who} saiu e ${event.title} tem ${confirmedCount} de ${event.quorum} confirmações. O rolê segue confirmado, mas vale reforçar o convite.`,
          dedupeKey: `quorum.below:${eventId}:${dayBucket(now)}`,
        });
      }
      if (
        existing &&
        (existing.deposit_status === 'approved' || existing.deposit_status === 'submitted')
      ) {
        await notify(trx, now, {
          userIds: [await getTreasurerId(trx, event)],
          eventId,
          kind: 'deposit.refund_check',
          title: 'Desistência com sinal pago',
          body: `${who} saiu de ${event.title} e já tinha enviado o sinal. Combinem a devolução fora do app.`,
          dedupeKey: `deposit.refund_check:${eventId}:${userId}:${now.getTime()}`,
        });
      }
    }

    await audit(trx, now, {
      eventId,
      actorId: userId,
      action: goingIn ? 'participation.in' : 'participation.out',
      entity: 'participation',
      entityId: userId,
    });
  });

  return getInviteForEvent(ctx.db, await requireEvent(ctx.db, eventId), userId);
}

export async function setPreferences(
  ctx: AppContext,
  userId: string,
  eventId: string,
  prefs: { drinksAlcohol: boolean; diet: 'omnivore' | 'vegetarian' },
): Promise<void> {
  const event = await requireEvent(ctx.db, eventId);
  if (event.status === 'closed') throw conflict('EVENT_CLOSED', 'O rolê já foi encerrado');
  const existing = await getParticipation(ctx.db, eventId, userId);
  if (!existing) throw forbidden('Responda ao convite antes de definir preferências');
  await ctx.db
    .updateTable('participations')
    .set({ drinks_alcohol: prefs.drinksAlcohol ? 1 : 0, diet: prefs.diet })
    .where('id', '=', existing.id)
    .execute();
  await audit(ctx.db, ctx.clock.now(), {
    eventId,
    actorId: userId,
    action: 'participation.preferences',
    entity: 'participation',
    entityId: userId,
    data: prefs,
  });
}

/* -------------------------------------------------------------------------------------------- */
/* Consultas                                                                                    */
/* -------------------------------------------------------------------------------------------- */

async function getInviteForEvent(
  db: Db,
  event: EventRow,
  userId: string | null,
): Promise<InviteView> {
  const [card, ids, me] = await Promise.all([
    toEventCard(db, event),
    confirmedUserIds(db, event.id),
    userId ? buildMyContext(db, event, userId) : Promise.resolve(null),
  ]);
  const users = await usersById(db, ids);
  return {
    event: card,
    confirmed: ids.map((id) => users.get(id)).filter((u): u is NonNullable<typeof u> => !!u),
    me,
  };
}

export async function getInvite(
  ctx: AppContext,
  code: string,
  userId: string | null,
): Promise<InviteView> {
  const found = await findEventByCode(ctx.db, code);
  if (!found) throw notFound('Convite não encontrado');
  await expireEventIfNeeded(ctx.db, ctx.clock.now(), found.id);
  return getInviteForEvent(ctx.db, await requireEvent(ctx.db, found.id), userId);
}

const statusRank = { open: 0, confirmed: 1, archived: 2, cancelled: 2, closed: 3 } as const;

export async function listFeed(ctx: AppContext, userId: string): Promise<FeedItem[]> {
  const now = ctx.clock.now();
  const rows = await ctx.db
    .selectFrom('events')
    .innerJoin('participations', 'participations.event_id', 'events.id')
    .selectAll('events')
    .select(['participations.response as my_response'])
    .where('participations.user_id', '=', userId)
    .execute();

  // Expira lazily o que já passou do prazo, para o feed nunca mostrar proposta "viva" vencida.
  for (const row of rows) {
    if (row.status === 'open' && new Date(row.response_deadline_at).getTime() <= now.getTime()) {
      await expireEventIfNeeded(ctx.db, now, row.id);
    }
  }
  const fresh = await ctx.db
    .selectFrom('events')
    .selectAll()
    .where('id', 'in', rows.map((r) => r.id).concat('__none__'))
    .execute();
  const cards = await toEventCards(ctx.db, fresh);
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const eventById = new Map(fresh.map((e) => [e.id, e]));
  const parts = await ctx.db
    .selectFrom('participations')
    .selectAll()
    .where('user_id', '=', userId)
    .where('event_id', 'in', fresh.map((e) => e.id).concat('__none__'))
    .execute();

  const items: FeedItem[] = [];
  for (const p of parts) {
    const card = cardById.get(p.event_id);
    const event = eventById.get(p.event_id);
    if (!card || !event) continue;
    const treasurerId = await getTreasurerId(ctx.db, event);
    items.push({
      ...card,
      myState: p.response,
      isOrganizer: event.organizer_id === userId,
      myDepositStatus: effectiveDepositStatus(event, p, treasurerId),
    });
  }

  return items.sort((a, b) => {
    const byStatus = statusRank[a.status] - statusRank[b.status];
    if (byStatus !== 0) return byStatus;
    if (a.status === 'open') return a.responseDeadlineAt.localeCompare(b.responseDeadlineAt);
    if (a.status === 'confirmed') return a.startDate.localeCompare(b.startDate);
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export async function getEventDetail(
  ctx: AppContext,
  userId: string,
  eventId: string,
): Promise<EventDetail> {
  const event = await requireEvent(ctx.db, eventId);
  const me = await buildMyContext(ctx.db, event, userId);
  if (!me.can['event.viewInternal']) throw forbidden('Confirme presença para entrar no QG do rolê');

  const [card, roleRows, parts, treasurerId] = await Promise.all([
    toEventCard(ctx.db, event),
    getEventRoles(ctx.db, eventId),
    ctx.db
      .selectFrom('participations')
      .selectAll()
      .where('event_id', '=', eventId)
      .where('response', '=', 'in')
      .orderBy('responded_at')
      .execute(),
    getTreasurerId(ctx.db, event),
  ]);
  const users = await usersById(ctx.db, [
    ...parts.map((p) => p.user_id),
    ...roleRows.map((r) => r.user_id),
  ]);

  const roster: RosterEntry[] = parts.map((p) => ({
    user: users.get(p.user_id) ?? { id: p.user_id, name: '—' },
    drinksAlcohol: p.drinks_alcohol === 1,
    diet: p.diet,
    depositStatus: effectiveDepositStatus(event, p, treasurerId),
    roles: roleRows.filter((r) => r.user_id === p.user_id).map((r) => r.role),
  }));

  const base: BaseInfo = {
    address: event.base_address,
    wifiName: event.base_wifi_name,
    wifiPassword: event.base_wifi_password,
    gateCode: event.base_gate_code,
    checkoutTime: event.base_checkout_time,
    houseRules: event.base_house_rules,
    schedule: event.base_schedule,
  };

  return {
    event: card,
    me,
    base,
    roles: ROLE_KEYS.map((role) => {
      const row = roleRows.find((r) => r.role === role);
      return { role, user: row ? (users.get(row.user_id) ?? null) : null, drawn: row?.drawn === 1 };
    }),
    roster,
    deposit: toDepositConfig(event),
    budget: { fixedCostsCents: event.fixed_costs_cents },
  };
}

/* -------------------------------------------------------------------------------------------- */
/* Edição da Base e cancelamento                                                                */
/* -------------------------------------------------------------------------------------------- */

export async function updateBase(
  ctx: AppContext,
  userId: string,
  eventId: string,
  base: BaseInfo,
): Promise<BaseInfo> {
  const event = await requireEvent(ctx.db, eventId);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'base.edit')) throw forbidden('Só o General da Base edita estas informações');
  if (event.status !== 'open' && event.status !== 'confirmed') {
    throw conflict('EVENT_NOT_ACTIVE', 'Este rolê não aceita mais alterações');
  }
  await ctx.db
    .updateTable('events')
    .set({
      base_address: base.address,
      base_wifi_name: base.wifiName,
      base_wifi_password: base.wifiPassword,
      base_gate_code: base.gateCode,
      base_checkout_time: base.checkoutTime,
      base_house_rules: base.houseRules,
      base_schedule: base.schedule,
    })
    .where('id', '=', eventId)
    .execute();
  await audit(ctx.db, ctx.clock.now(), {
    eventId,
    actorId: userId,
    action: 'base.updated',
    entity: 'event',
    entityId: eventId,
  });
  return base;
}

export async function cancelEvent(ctx: AppContext, userId: string, eventId: string): Promise<void> {
  await ctx.db.transaction().execute(async (trx) => {
    const now = ctx.clock.now();
    const event = await requireEvent(trx, eventId);
    const { actor } = await buildActor(trx, event, userId);
    if (!can(actor, 'event.cancel')) throw forbidden('Só quem criou o rolê pode cancelá-lo');
    if (event.status !== 'open' && event.status !== 'confirmed') {
      throw conflict('EVENT_NOT_ACTIVE', 'Este rolê não pode mais ser cancelado');
    }

    await trx
      .updateTable('events')
      .set({ status: 'cancelled', cancelled_at: now.toISOString() })
      .where('id', '=', eventId)
      .execute();

    const paid = await trx
      .selectFrom('participations')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('event_id', '=', eventId)
      .where('deposit_status', 'in', ['approved', 'submitted'])
      .executeTakeFirstOrThrow();
    const members = (await confirmedUserIds(trx, eventId)).filter((id) => id !== userId);
    await notify(trx, now, {
      userIds: members,
      eventId,
      kind: 'event.cancelled',
      title: 'Rolê cancelado',
      body:
        Number(paid.n) > 0
          ? `${event.title} foi cancelado. Quem já pagou o sinal deve combinar a devolução com o Tesoureiro (o app não movimenta dinheiro).`
          : `${event.title} foi cancelado.`,
      dedupeKey: `event.cancelled:${eventId}`,
    });
    await audit(trx, now, {
      eventId,
      actorId: userId,
      action: 'event.cancelled',
      entity: 'event',
      entityId: eventId,
    });
  });
}

/** Custos fixos estimados (casa, hospedagem) que alimentam o simulador de orçamento. */
export async function updateBudget(
  ctx: AppContext,
  userId: string,
  eventId: string,
  fixedCostsCents: number | null,
): Promise<void> {
  const event = await requireEvent(ctx.db, eventId);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'budget.edit')) throw forbidden('Só o General da Base edita os custos fixos');
  if (event.status !== 'open' && event.status !== 'confirmed') {
    throw conflict('EVENT_NOT_ACTIVE', 'Este rolê não aceita mais alterações');
  }
  await ctx.db
    .updateTable('events')
    .set({ fixed_costs_cents: fixedCostsCents })
    .where('id', '=', eventId)
    .execute();
  await audit(ctx.db, ctx.clock.now(), {
    eventId,
    actorId: userId,
    action: 'budget.updated',
    entity: 'event',
    entityId: eventId,
    data: { fixedCostsCents },
  });
}
