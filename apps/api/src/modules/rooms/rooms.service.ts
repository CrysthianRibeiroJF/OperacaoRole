import type { RoomDto, RoomsDto } from '@role/contracts';
import { can } from '@role/domain';
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
import { assertSeatEligible } from '../fleet/fleet.service';
import { notify } from '../notifications/notifications.service';

function assertActive(event: EventRow) {
  if (event.status !== 'confirmed') {
    throw conflict('EVENT_NOT_ACTIVE', 'Os quartos só mudam enquanto o rolê está confirmado');
  }
}

async function loadRoom(ctx: AppContext, roomId: string) {
  const room = await ctx.db
    .selectFrom('rooms')
    .selectAll()
    .where('id', '=', roomId)
    .executeTakeFirst();
  if (!room) throw notFound('Quarto não encontrado');
  return { room, event: await requireEvent(ctx.db, room.event_id) };
}

export async function getRooms(
  ctx: AppContext,
  userId: string,
  eventId: string,
): Promise<RoomsDto> {
  const event = await requireEvent(ctx.db, eventId);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'event.viewInternal')) throw forbidden('Confirme presença para ver os quartos');

  const [rooms, occupants, memberIds] = await Promise.all([
    ctx.db
      .selectFrom('rooms')
      .selectAll()
      .where('event_id', '=', eventId)
      .orderBy('created_at')
      .orderBy('name')
      .execute(),
    ctx.db.selectFrom('room_occupants').selectAll().where('event_id', '=', eventId).execute(),
    confirmedUserIds(ctx.db, eventId),
  ]);
  const users = await usersById(ctx.db, [...occupants.map((o) => o.user_id), ...memberIds]);
  const user = (id: string) => users.get(id) ?? { id, name: '—' };

  const dtos: RoomDto[] = rooms.map((r) => {
    const people = occupants.filter((o) => o.room_id === r.id);
    return {
      id: r.id,
      name: r.name,
      beds: r.beds,
      freeBeds: Math.max(0, r.beds - people.length),
      occupants: people.map((o) => user(o.user_id)),
    };
  });
  const placed = new Set(occupants.map((o) => o.user_id));
  return {
    rooms: dtos,
    unassigned: memberIds.filter((id) => !placed.has(id)).map(user),
    myRoomId: occupants.find((o) => o.user_id === userId)?.room_id ?? null,
  };
}

export async function createRoom(
  ctx: AppContext,
  userId: string,
  eventId: string,
  input: { name: string; beds: number },
): Promise<void> {
  const event = await requireEvent(ctx.db, eventId);
  assertActive(event);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'rooms.edit')) throw forbidden('Só o General da Base monta os quartos');
  await ctx.db
    .insertInto('rooms')
    .values({
      id: newId(),
      event_id: eventId,
      name: input.name,
      beds: input.beds,
      created_at: ctx.clock.now().toISOString(),
    })
    .execute();
  await audit(ctx.db, ctx.clock.now(), {
    eventId,
    actorId: userId,
    action: 'room.created',
    entity: 'room',
  });
}

export async function updateRoom(
  ctx: AppContext,
  userId: string,
  roomId: string,
  patch: { name?: string; beds?: number },
): Promise<void> {
  const { room, event } = await loadRoom(ctx, roomId);
  assertActive(event);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'rooms.edit')) throw forbidden('Só o General da Base edita os quartos');
  if (patch.beds !== undefined) {
    const taken = await ctx.db
      .selectFrom('room_occupants')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('room_id', '=', room.id)
      .executeTakeFirstOrThrow();
    if (patch.beds < Number(taken.n)) {
      throw conflict(
        'BEDS_TOO_FEW',
        `Já há ${taken.n} pessoa(s) neste quarto. Tire alguém antes de reduzir as camas.`,
      );
    }
  }
  const set: Record<string, unknown> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.beds !== undefined) set.beds = patch.beds;
  if (Object.keys(set).length > 0)
    await ctx.db.updateTable('rooms').set(set).where('id', '=', roomId).execute();
}

export async function deleteRoom(ctx: AppContext, userId: string, roomId: string): Promise<void> {
  const { room, event } = await loadRoom(ctx, roomId);
  assertActive(event);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'rooms.edit')) throw forbidden('Só o General da Base remove quartos');
  const people = await ctx.db
    .selectFrom('room_occupants')
    .select('user_id')
    .where('room_id', '=', room.id)
    .execute();
  await ctx.db.deleteFrom('rooms').where('id', '=', roomId).execute();
  await notify(ctx.db, ctx.clock.now(), {
    userIds: people.map((p) => p.user_id),
    eventId: event.id,
    kind: 'rooms.room_removed',
    title: 'Seu quarto saiu da lista',
    body: `${room.name} foi removido de ${event.title}. Escolha outra cama na aba Base.`,
    dedupeKey: `rooms.room_removed:${roomId}`,
  });
}

async function placeUser(
  ctx: AppContext,
  actorId: string,
  roomId: string,
  targetId: string,
  byManager: boolean,
) {
  await ctx.db.transaction().execute(async (trx) => {
    const room = await trx
      .selectFrom('rooms')
      .selectAll()
      .where('id', '=', roomId)
      .executeTakeFirst();
    if (!room) throw notFound('Quarto não encontrado');
    const event = await requireEvent(trx, room.event_id);
    assertActive(event);
    // RN-14: com sinal exigido, só quem está com o sinal aprovado escolhe cama.
    await assertSeatEligible(trx, event, targetId);

    const already = await trx
      .selectFrom('room_occupants')
      .select('room_id')
      .where('event_id', '=', event.id)
      .where('user_id', '=', targetId)
      .executeTakeFirst();
    if (already?.room_id === roomId) return; // idempotente

    const taken = await trx
      .selectFrom('room_occupants')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('room_id', '=', roomId)
      .executeTakeFirstOrThrow();
    if (Number(taken.n) >= room.beds) throw conflict('NO_BEDS', 'Esse quarto está lotado');

    await trx
      .deleteFrom('room_occupants')
      .where('event_id', '=', event.id)
      .where('user_id', '=', targetId)
      .execute();
    await trx
      .insertInto('room_occupants')
      .values({ room_id: roomId, event_id: event.id, user_id: targetId })
      .execute();

    if (byManager) {
      await notify(trx, ctx.clock.now(), {
        userIds: [targetId],
        eventId: event.id,
        kind: 'rooms.assigned',
        title: 'Você ganhou uma cama',
        body: `Em ${event.title}, você ficou no quarto ${room.name}.`,
        dedupeKey: `rooms.assigned:${roomId}:${targetId}:${ctx.clock.now().getTime()}`,
      });
    }
    await audit(trx, ctx.clock.now(), {
      eventId: event.id,
      actorId,
      action: 'room.bed_taken',
      entity: 'room',
      entityId: roomId,
      data: { userId: targetId },
    });
  });
}

export const joinRoom = (ctx: AppContext, userId: string, roomId: string) =>
  placeUser(ctx, userId, roomId, userId, false);

export async function assignToRoom(
  ctx: AppContext,
  managerId: string,
  roomId: string,
  targetId: string,
) {
  const { event } = await loadRoom(ctx, roomId);
  const { actor } = await buildActor(ctx.db, event, managerId);
  if (!can(actor, 'rooms.edit')) throw forbidden('Só o General da Base aloca pessoas nos quartos');
  return placeUser(ctx, managerId, roomId, targetId, true);
}

export async function leaveRoom(ctx: AppContext, userId: string, roomId: string): Promise<void> {
  const { event } = await loadRoom(ctx, roomId);
  assertActive(event);
  await ctx.db
    .deleteFrom('room_occupants')
    .where('room_id', '=', roomId)
    .where('user_id', '=', userId)
    .execute();
}

export async function removeFromRoom(
  ctx: AppContext,
  managerId: string,
  roomId: string,
  targetId: string,
) {
  const { room, event } = await loadRoom(ctx, roomId);
  assertActive(event);
  const { actor } = await buildActor(ctx.db, event, managerId);
  if (!can(actor, 'rooms.edit')) throw forbidden('Só o General da Base tira pessoas dos quartos');
  await ctx.db
    .deleteFrom('room_occupants')
    .where('room_id', '=', roomId)
    .where('user_id', '=', targetId)
    .execute();
  await notify(ctx.db, ctx.clock.now(), {
    userIds: [targetId],
    eventId: event.id,
    kind: 'rooms.removed',
    title: 'Você saiu de um quarto',
    body: `Você foi retirado do quarto ${room.name} em ${event.title}. Escolha outra cama na aba Base.`,
    dedupeKey: `rooms.removed:${roomId}:${targetId}:${ctx.clock.now().getTime()}`,
  });
}
