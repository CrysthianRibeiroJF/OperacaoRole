import type { PartyDto, PartyRulesDto } from '@role/contracts';
import {
  adultsOf,
  checkParty,
  fitsCapacity,
  PARTY_PROBLEM_MESSAGES,
  MAX_ADULT_COMPANIONS,
  MAX_CHILDREN_HARD,
  type PartyRules,
} from '@role/domain';
import type { AppContext, Db } from '../../context';
import { conflict, forbidden, unprocessable } from '../../errors';
import { newId } from '../../ids';
import { audit } from '../../lib/audit';
import {
  buildActor,
  confirmedUserIds,
  getParticipation,
  getTreasurerId,
  loadParties,
  partyOf,
  partyTotals,
  requireEvent,
  toCompanionDto,
  type EventRow,
} from '../events/event.queries';
import { occupiedSeats } from '../fleet/fleet.service';
import { bedsUse } from '../rooms/rooms.service';

export const rulesOf = (event: EventRow): PartyRules => ({
  allowCompanions: event.allow_companions === 1,
  maxChildren: event.max_children,
  capacity: event.capacity,
});

const toRulesDto = (r: PartyRules): PartyRulesDto => ({ ...r });

const isLive = (event: EventRow) => event.status === 'open' || event.status === 'confirmed';

/**
 * Depois que o sinal é pago (ou enviado para conferência), o número de cotas do responsável não muda:
 * o valor já pago cobre uma quantidade definida de pessoas. Crianças são isentas e podem mudar sempre.
 */
async function adultsLocked(db: Db, event: EventRow, userId: string): Promise<boolean> {
  if (event.deposit_required !== 1 || !event.deposit_opened_at) return false;
  if (userId === (await getTreasurerId(db, event))) return false;
  const p = await getParticipation(db, event.id, userId);
  return p?.deposit_status === 'approved' || p?.deposit_status === 'submitted';
}

export async function getParty(
  ctx: AppContext,
  userId: string,
  eventId: string,
): Promise<PartyDto> {
  const event = await requireEvent(ctx.db, eventId);
  const { actor, participation } = await buildActor(ctx.db, event, userId);
  if (actor.participation === 'none' && !actor.isOrganizer) {
    throw forbidden('Confirme presença para ver os acompanhantes');
  }

  const [memberIds, parties] = await Promise.all([
    confirmedUserIds(ctx.db, eventId),
    loadParties(ctx.db, eventId),
  ]);
  const mine = partyOf(parties, userId);
  const rules = rulesOf(event);
  const { heads: totalHeads } = partyTotals(memberIds, parties);

  let lockedReason: string | null = null;
  if (!isLive(event)) lockedReason = 'Este rolê não aceita mais alterações';
  else if (participation?.response !== 'in')
    lockedReason = 'Confirme presença para levar acompanhante';

  return {
    companions: mine.companions.map(toCompanionDto),
    rules: toRulesDto(rules),
    limits: {
      maxAdults: MAX_ADULT_COMPANIONS,
      maxChildren: Math.min(rules.maxChildren, MAX_CHILDREN_HARD),
    },
    payingUnits: mine.units,
    heads: mine.heads,
    totalHeads,
    capacityLeft: rules.capacity === null ? null : Math.max(0, rules.capacity - totalHeads),
    canEdit: lockedReason === null,
    lockedReason,
    adultsLocked: lockedReason === null && (await adultsLocked(ctx.db, event, userId)),
  };
}

interface CompanionInput {
  name: string;
  kind: 'adult' | 'child';
  drinksAlcohol: boolean;
  diet: 'omnivore' | 'vegetarian';
}

/**
 * Define (substitui) os acompanhantes de quem confirmou. Confere, nesta ordem: regras do rolê,
 * capacidade da casa, sinal já pago, lugar no carro e cama no quarto.
 */
export async function setCompanions(
  ctx: AppContext,
  userId: string,
  eventId: string,
  list: CompanionInput[],
): Promise<PartyDto> {
  await ctx.db.transaction().execute(async (trx) => {
    const now = ctx.clock.now();
    const event = await requireEvent(trx, eventId);
    if (!isLive(event)) throw conflict('EVENT_NOT_ACTIVE', 'Este rolê não aceita mais alterações');
    const participation = await getParticipation(trx, eventId, userId);
    if (participation?.response !== 'in') {
      throw forbidden('Só quem confirmou presença leva acompanhante');
    }

    // Criança não bebe e é isenta: a escolha de bebida só vale para adulto.
    const next = list.map((c) => ({
      ...c,
      name: c.name.trim(),
      drinksAlcohol: c.kind === 'adult' && c.drinksAlcohol,
    }));

    const problem = checkParty(next, rulesOf(event));
    if (problem) throw unprocessable(problem, PARTY_PROBLEM_MESSAGES[problem]);

    const [memberIds, parties] = await Promise.all([
      confirmedUserIds(trx, eventId),
      loadParties(trx, eventId),
    ]);
    const mine = partyOf(parties, userId);

    // Capacidade da casa, em cabeças.
    const othersHeads = partyTotals(memberIds, parties).heads - mine.heads;
    const newHeads = 1 + next.length;
    if (!fitsCapacity(event.capacity, othersHeads + newHeads)) {
      throw conflict(
        'HOUSE_FULL',
        `A casa comporta ${event.capacity} pessoas e já há ${othersHeads} fora você. Com ${newHeads} da sua parte passa do limite.`,
      );
    }

    // Sinal pago cobre um número definido de cotas.
    if (adultsOf(next) !== mine.adults && (await adultsLocked(trx, event, userId))) {
      throw conflict(
        'DEPOSIT_LOCKED',
        'O sinal já foi pago por um número de pessoas. Só crianças podem mudar agora; fale com o Tesoureiro para ajustar.',
      );
    }

    // O carro precisa comportar todo mundo da confirmação.
    const vehicle = await trx
      .selectFrom('vehicles')
      .selectAll()
      .where('event_id', '=', eventId)
      .where('driver_id', '=', userId)
      .executeTakeFirst();
    const seat = vehicle
      ? undefined
      : await trx
          .selectFrom('vehicle_passengers')
          .select('vehicle_id')
          .where('event_id', '=', eventId)
          .where('user_id', '=', userId)
          .executeTakeFirst();
    const carId = vehicle?.id ?? seat?.vehicle_id;
    if (carId) {
      const car =
        vehicle ??
        (await trx
          .selectFrom('vehicles')
          .selectAll()
          .where('id', '=', carId)
          .executeTakeFirstOrThrow());
      const riders = await trx
        .selectFrom('vehicle_passengers')
        .select('user_id')
        .where('vehicle_id', '=', carId)
        .execute();
      // Troca a festa do usuário pela nova só na conta (o que está salvo ainda é a antiga).
      const swapped = new Map(parties);
      swapped.set(userId, {
        ...mine,
        companions: next as never,
        heads: newHeads,
        adults: adultsOf(next),
        children: next.length - adultsOf(next),
        units: 1 + adultsOf(next),
      });
      const used = occupiedSeats(
        car.driver_id,
        riders.map((r) => r.user_id),
        swapped,
      );
      if (used > car.seats) {
        throw conflict(
          'CAR_FULL',
          `${car.label} não comporta a sua turma (${used} lugares para ${car.seats}). Saia do carro ou mude o carro antes.`,
        );
      }
    }

    // O quarto precisa ter cama para o casal (ou duas de solteiro).
    const myRoom = await trx
      .selectFrom('room_occupants')
      .select('room_id')
      .where('event_id', '=', eventId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (myRoom) {
      const use = await bedsUse(trx, myRoom.room_id, parties, {
        userId,
        adults: 1 + adultsOf(next),
      });
      if (!use.ok) {
        throw conflict(
          'ROOM_FULL',
          'O seu quarto não tem cama para a sua turma. Troque de quarto antes de mudar os acompanhantes.',
        );
      }
    }

    await trx
      .deleteFrom('companions')
      .where('event_id', '=', eventId)
      .where('owner_id', '=', userId)
      .execute();
    if (next.length > 0) {
      await trx
        .insertInto('companions')
        .values(
          next.map((c, i) => ({
            id: newId(),
            event_id: eventId,
            owner_id: userId,
            name: c.name,
            kind: c.kind,
            drinks_alcohol: c.drinksAlcohol ? 1 : 0,
            diet: c.diet,
            // Mantém a ordem informada (a lista ordena por criação).
            created_at: new Date(now.getTime() + i).toISOString(),
          })),
        )
        .execute();
    }
    await audit(trx, now, {
      eventId,
      actorId: userId,
      action: 'party.set',
      entity: 'participation',
      entityId: userId,
      data: { adults: adultsOf(next), children: next.length - adultsOf(next) },
    });
  });
  return getParty(ctx, userId, eventId);
}

/** Regras de acompanhantes do rolê: só o Idealizador define. */
export async function setPartyRules(
  ctx: AppContext,
  userId: string,
  eventId: string,
  input: PartyRulesDto,
): Promise<PartyRulesDto> {
  const event = await requireEvent(ctx.db, eventId);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!actor.isOrganizer) throw forbidden('Só o Idealizador define as regras de acompanhantes');
  if (!isLive(event)) throw conflict('EVENT_NOT_ACTIVE', 'Este rolê não aceita mais alterações');

  const [memberIds, parties] = await Promise.all([
    confirmedUserIds(ctx.db, eventId),
    loadParties(ctx.db, eventId),
  ]);
  const { heads } = partyTotals(memberIds, parties);
  if (input.capacity !== null && input.capacity < heads) {
    throw conflict(
      'CAPACITY_BELOW',
      `Já há ${heads} pessoas confirmadas. A capacidade não pode ser menor.`,
    );
  }
  const anyCompanions = [...parties.values()].some((p) => p.companions.length > 0);
  if (!input.allowCompanions && anyCompanions) {
    throw conflict(
      'COMPANIONS_IN_USE',
      'Já há acompanhantes confirmados. Peça que removam antes de desligar.',
    );
  }
  const mostChildren = Math.max(0, ...[...parties.values()].map((p) => p.children));
  if (input.maxChildren < mostChildren) {
    throw conflict(
      'CHILDREN_IN_USE',
      `Alguém já leva ${mostChildren} criança(s). O limite não pode ficar abaixo disso.`,
    );
  }

  await ctx.db
    .updateTable('events')
    .set({
      allow_companions: input.allowCompanions ? 1 : 0,
      max_children: input.maxChildren,
      capacity: input.capacity,
    })
    .where('id', '=', eventId)
    .execute();
  await audit(ctx.db, ctx.clock.now(), {
    eventId,
    actorId: userId,
    action: 'party.rules',
    entity: 'event',
    entityId: eventId,
    data: { ...input },
  });
  return input;
}
