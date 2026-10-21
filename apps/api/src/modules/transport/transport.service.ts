import type { StopDto, TransportDto } from '@role/contracts';
import { can, rideModeOf, sortStops, STOP_KIND_LABELS, type RideMode } from '@role/domain';
import type { AppContext, Db } from '../../context';
import type { MeetingPointsTable } from '../../db/types';
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
import { notify } from '../notifications/notifications.service';

type StopRow = {
  id: string;
  kind: MeetingPointsTable['kind'];
  name: string;
  address: string | null;
  time: string | null;
  note: string | null;
  position: number;
};

export const toStopDto = (s: StopRow): StopDto => ({
  id: s.id,
  kind: s.kind,
  name: s.name,
  address: s.address,
  time: s.time,
  note: s.note,
});

/** Pontos de um rolê, já em ordem de horário. */
export async function loadStops(db: Db, eventId: string): Promise<StopDto[]> {
  const rows = await db
    .selectFrom('meeting_points')
    .select(['id', 'kind', 'name', 'address', 'time', 'note', 'position'])
    .where('event_id', '=', eventId)
    .execute();
  return sortStops(rows).map(toStopDto);
}

/**
 * Como cada confirmado chega ao rolê. O lugar no carro (ou dirigir) vale mais que o plano declarado.
 * Usado pela tela de transporte e pelo painel do General da Frota.
 */
export async function loadRides(
  db: Db,
  eventId: string,
  memberIds: readonly string[],
): Promise<{
  modes: Map<string, RideMode>;
  plans: Map<string, { mode: 'app' | 'own'; estCents: number | null }>;
}> {
  const [vehicles, passengers, plans] = await Promise.all([
    db.selectFrom('vehicles').select('driver_id').where('event_id', '=', eventId).execute(),
    db.selectFrom('vehicle_passengers').select('user_id').where('event_id', '=', eventId).execute(),
    db
      .selectFrom('ride_plans')
      .select(['user_id', 'mode', 'est_cents'])
      .where('event_id', '=', eventId)
      .execute(),
  ]);
  const drivers = new Set(vehicles.map((v) => v.driver_id));
  const seated = new Set(passengers.map((p) => p.user_id));
  const planByUser = new Map(
    plans.map((p) => [p.user_id, { mode: p.mode, estCents: p.est_cents }]),
  );

  const modes = new Map<string, RideMode>();
  for (const id of memberIds) {
    modes.set(
      id,
      rideModeOf({
        drives: drivers.has(id),
        hasSeat: seated.has(id),
        plan: planByUser.get(id)?.mode ?? null,
      }),
    );
  }
  return { modes, plans: planByUser };
}

const isLive = (event: EventRow) => event.status === 'open' || event.status === 'confirmed';

export async function getTransport(
  ctx: AppContext,
  userId: string,
  eventId: string,
): Promise<TransportDto> {
  const event = await requireEvent(ctx.db, eventId);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'event.viewInternal')) throw forbidden('Confirme presença para ver o transporte');

  const [stops, memberIds] = await Promise.all([
    loadStops(ctx.db, eventId),
    confirmedUserIds(ctx.db, eventId),
  ]);
  const { modes, plans } = await loadRides(ctx.db, eventId, memberIds);
  const users = await usersById(ctx.db, memberIds);
  const named = (mode: RideMode) =>
    memberIds
      .filter((id) => modes.get(id) === mode)
      .map((id) => users.get(id) ?? { id, name: '—' });

  const mine = plans.get(userId);
  return {
    stops,
    canEdit: can(actor, 'fleet.edit') && isLive(event),
    myRide: modes.get(userId) ?? 'none',
    myPlan: mine ?? null,
    appRiders: named('app'),
    ownRiders: named('own'),
  };
}

async function requireFleetEditor(ctx: AppContext, userId: string, eventId: string) {
  const event = await requireEvent(ctx.db, eventId);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'fleet.edit')) {
    throw forbidden('Só o General da Frota edita os pontos de encontro');
  }
  if (!isLive(event)) throw conflict('EVENT_NOT_ACTIVE', 'Este rolê não aceita mais alterações');
  return event;
}

async function tellMembers(
  ctx: AppContext,
  event: EventRow,
  actorId: string,
  kind: MeetingPointsTable['kind'],
  stop: { id: string; name: string; time: string | null; address: string | null },
  verb: 'added' | 'changed',
) {
  const members = (await confirmedUserIds(ctx.db, event.id)).filter((id) => id !== actorId);
  const when = stop.time ? ` às ${stop.time}` : '';
  const where = stop.address ? ` · ${stop.address}` : '';
  await notify(ctx.db, ctx.clock.now(), {
    userIds: members,
    eventId: event.id,
    kind: 'fleet.stop',
    title: verb === 'added' ? `Novo: ${STOP_KIND_LABELS[kind].toLowerCase()}` : 'Ponto atualizado',
    body: `${event.title}: ${stop.name}${when}${where}.`,
    dedupeKey: `fleet.stop:${stop.id}:${verb}:${ctx.clock.now().getTime()}`,
  });
}

export async function createStop(
  ctx: AppContext,
  userId: string,
  eventId: string,
  input: {
    kind: MeetingPointsTable['kind'];
    name: string;
    address?: string | null | undefined;
    time?: string | null | undefined;
    note?: string | null | undefined;
  },
): Promise<StopDto> {
  const event = await requireFleetEditor(ctx, userId, eventId);
  const last = await ctx.db
    .selectFrom('meeting_points')
    .select((eb) => eb.fn.max<number>('position').as('p'))
    .where('event_id', '=', eventId)
    .executeTakeFirst();
  const id = newId();
  const row = {
    id,
    event_id: eventId,
    kind: input.kind,
    name: input.name,
    address: input.address || null,
    time: input.time || null,
    note: input.note || null,
    position: (last?.p ?? -1) + 1,
    created_at: ctx.clock.now().toISOString(),
  };
  await ctx.db.insertInto('meeting_points').values(row).execute();
  await audit(ctx.db, ctx.clock.now(), {
    eventId,
    actorId: userId,
    action: 'stop.created',
    entity: 'meeting_point',
    entityId: id,
  });
  await tellMembers(ctx, event, userId, row.kind, row, 'added');
  return toStopDto(row);
}

async function loadStop(ctx: AppContext, stopId: string) {
  const stop = await ctx.db
    .selectFrom('meeting_points')
    .selectAll()
    .where('id', '=', stopId)
    .executeTakeFirst();
  if (!stop) throw notFound('Ponto não encontrado');
  return stop;
}

export async function updateStop(
  ctx: AppContext,
  userId: string,
  stopId: string,
  patch: {
    kind?: MeetingPointsTable['kind'] | undefined;
    name?: string | undefined;
    address?: string | null | undefined;
    time?: string | null | undefined;
    note?: string | null | undefined;
  },
): Promise<StopDto> {
  const stop = await loadStop(ctx, stopId);
  const event = await requireFleetEditor(ctx, userId, stop.event_id);

  const set: Partial<MeetingPointsTable> = {};
  if (patch.kind !== undefined) set.kind = patch.kind;
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.address !== undefined) set.address = patch.address || null;
  if (patch.time !== undefined) set.time = patch.time || null;
  if (patch.note !== undefined) set.note = patch.note || null;
  if (Object.keys(set).length > 0) {
    await ctx.db.updateTable('meeting_points').set(set).where('id', '=', stopId).execute();
  }
  const fresh = await loadStop(ctx, stopId);
  // Só avisa quando algo que muda o plano de alguém mudou (hora, local ou nome).
  if (patch.time !== undefined || patch.address !== undefined || patch.name !== undefined) {
    await tellMembers(ctx, event, userId, fresh.kind, fresh, 'changed');
  }
  return toStopDto(fresh);
}

export async function deleteStop(ctx: AppContext, userId: string, stopId: string): Promise<void> {
  const stop = await loadStop(ctx, stopId);
  await requireFleetEditor(ctx, userId, stop.event_id);
  await ctx.db.deleteFrom('meeting_points').where('id', '=', stopId).execute();
}

/**
 * "Como eu vou": quem não tem lugar no carro avisa se vai de app (Uber, 99, táxi) ou por conta
 * própria, com uma estimativa opcional da corrida. É informativo: não entra no rateio.
 */
export async function setRidePlan(
  ctx: AppContext,
  userId: string,
  eventId: string,
  input: { mode: 'app' | 'own' | null; estCents?: number | null | undefined },
): Promise<void> {
  const event = await requireEvent(ctx.db, eventId);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'fleet.join')) throw forbidden('Só quem confirmou presença escolhe como vai');
  if (event.status !== 'confirmed') {
    throw conflict('EVENT_NOT_ACTIVE', 'O transporte só muda enquanto o rolê está confirmado');
  }

  const { modes } = await loadRides(ctx.db, eventId, [userId]);
  const current = modes.get(userId);
  if (current === 'driver' || current === 'passenger') {
    throw conflict(
      'ALREADY_SEATED',
      'Você já tem lugar no carro. Saia dele para escolher outro jeito.',
    );
  }

  if (input.mode === null) {
    await ctx.db
      .deleteFrom('ride_plans')
      .where('event_id', '=', eventId)
      .where('user_id', '=', userId)
      .execute();
    return;
  }
  const est = input.mode === 'app' ? (input.estCents ?? null) : null;
  await ctx.db
    .insertInto('ride_plans')
    .values({
      event_id: eventId,
      user_id: userId,
      mode: input.mode,
      est_cents: est,
      updated_at: ctx.clock.now().toISOString(),
    })
    .onConflict((oc) =>
      oc.columns(['event_id', 'user_id']).doUpdateSet({
        mode: input.mode!,
        est_cents: est,
        updated_at: ctx.clock.now().toISOString(),
      }),
    )
    .execute();
}
