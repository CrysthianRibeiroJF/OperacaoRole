import type { CargoDto, FleetDto, VehicleDto } from '@role/contracts';
import { can } from '@role/domain';
import type { AppContext, Db } from '../../context';
import { conflict, forbidden, notFound } from '../../errors';
import { newId } from '../../ids';
import { audit } from '../../lib/audit';
import {
  buildActor,
  confirmedUserIds,
  effectiveDepositStatus,
  getParticipation,
  getTreasurerId,
  loadParties,
  partyOf,
  requireEvent,
  usersById,
  type EventRow,
  type PartyInfo,
} from '../events/event.queries';
import { notify } from '../notifications/notifications.service';

/**
 * Lugares ocupados num carro: cada passageiro com os acompanhantes dele (criança também ocupa lugar)
 * e os acompanhantes do motorista. O próprio motorista não conta: `seats` são os lugares de passageiro.
 */
export function occupiedSeats(
  driverId: string,
  passengerIds: readonly string[],
  parties: ReadonlyMap<string, PartyInfo>,
): number {
  const driverCompanions = partyOf(parties, driverId).companions.length;
  return passengerIds.reduce((sum, id) => sum + partyOf(parties, id).heads, driverCompanions);
}

function assertActive(event: EventRow) {
  if (event.status !== 'confirmed') {
    throw conflict('EVENT_NOT_ACTIVE', 'Carros e caronas só mudam enquanto o rolê está confirmado');
  }
}

/** RN-14: com sinal exigido, só quem está com o sinal aprovado escolhe lugar no carro. */
export async function assertSeatEligible(db: Db, event: EventRow, userId: string) {
  const participation = await getParticipation(db, event.id, userId);
  if (!participation || participation.response !== 'in') {
    throw forbidden('Só quem confirmou presença ocupa um lugar no carro');
  }
  const treasurerId = await getTreasurerId(db, event);
  if (
    effectiveDepositStatus(event, participation, treasurerId) !== 'approved' &&
    event.deposit_opened_at
  ) {
    throw conflict('DEPOSIT_REQUIRED', 'Só quem está com o sinal aprovado escolhe lugar no carro');
  }
}

async function loadVehicle(ctx: AppContext, vehicleId: string) {
  const vehicle = await ctx.db
    .selectFrom('vehicles')
    .selectAll()
    .where('id', '=', vehicleId)
    .executeTakeFirst();
  if (!vehicle) throw notFound('Carro não encontrado');
  return { vehicle, event: await requireEvent(ctx.db, vehicle.event_id) };
}

export async function getFleet(
  ctx: AppContext,
  userId: string,
  eventId: string,
): Promise<FleetDto> {
  const event = await requireEvent(ctx.db, eventId);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'event.viewInternal')) throw forbidden('Confirme presença para ver os carros');

  const [vehicles, passengers, cargo, memberIds] = await Promise.all([
    ctx.db
      .selectFrom('vehicles')
      .selectAll()
      .where('event_id', '=', eventId)
      .orderBy('created_at')
      .execute(),
    ctx.db.selectFrom('vehicle_passengers').selectAll().where('event_id', '=', eventId).execute(),
    ctx.db
      .selectFrom('cargo_items')
      .selectAll()
      .where('event_id', '=', eventId)
      .orderBy('created_at')
      .execute(),
    confirmedUserIds(ctx.db, eventId),
  ]);
  const parties = await loadParties(ctx.db, eventId);
  const users = await usersById(ctx.db, [
    ...vehicles.map((v) => v.driver_id),
    ...passengers.map((p) => p.user_id),
    ...memberIds,
  ]);
  const user = (id: string) => users.get(id) ?? { id, name: '—' };
  const toCargo = (c: (typeof cargo)[number]): CargoDto => ({
    id: c.id,
    name: c.name,
    vehicleId: c.vehicle_id,
  });

  const dtos: VehicleDto[] = vehicles.map((v) => {
    const pax = passengers.filter((p) => p.vehicle_id === v.id);
    const load = cargo.filter((c) => c.vehicle_id === v.id);
    return {
      id: v.id,
      label: v.label,
      driver: user(v.driver_id),
      departurePlace: v.departure_place,
      departureTime: v.departure_time,
      seats: v.seats,
      freeSeats: Math.max(
        0,
        v.seats -
          occupiedSeats(
            v.driver_id,
            pax.map((p) => p.user_id),
            parties,
          ),
      ),
      driverCompanions: partyOf(parties, v.driver_id).companions.length,
      cargoCapacity: v.cargo_capacity,
      cargoNote: v.cargo_note,
      passengers: pax.map((p) => ({
        ...user(p.user_id),
        companions: partyOf(parties, p.user_id).companions.length,
      })),
      cargo: load.map(toCargo),
      overloaded: load.length > v.cargo_capacity,
    };
  });

  const placed = new Set([
    ...vehicles.map((v) => v.driver_id),
    ...passengers.map((p) => p.user_id),
  ]);
  const mine =
    vehicles.find((v) => v.driver_id === userId) ??
    vehicles.find((v) => passengers.some((p) => p.vehicle_id === v.id && p.user_id === userId));

  return {
    vehicles: dtos,
    seatless: memberIds.filter((id) => !placed.has(id)).map(user),
    unassignedCargo: cargo.filter((c) => !c.vehicle_id).map(toCargo),
    myVehicleId: mine?.id ?? null,
    iAmDriver: vehicles.some((v) => v.driver_id === userId),
  };
}

export async function createVehicle(
  ctx: AppContext,
  userId: string,
  eventId: string,
  input: {
    label: string;
    seats: number;
    cargoCapacity: number;
    departurePlace?: string | null | undefined;
    departureTime?: string | null | undefined;
    cargoNote?: string | null | undefined;
  },
): Promise<void> {
  await ctx.db.transaction().execute(async (trx) => {
    const event = await requireEvent(trx, eventId);
    assertActive(event);
    const { actor } = await buildActor(trx, event, userId);
    if (!can(actor, 'fleet.join')) throw forbidden('Só quem confirmou presença cadastra carro');

    const existing = await trx
      .selectFrom('vehicles')
      .select('id')
      .where('event_id', '=', eventId)
      .where('driver_id', '=', userId)
      .executeTakeFirst();
    if (existing) throw conflict('ALREADY_DRIVER', 'Você já cadastrou um carro neste rolê');

    const mine = partyOf(await loadParties(trx, eventId), userId).companions.length;
    if (input.seats < mine) {
      throw conflict(
        'SEATS_TOO_FEW',
        `Seus ${mine} acompanhante(s) ocupam lugares do carro: informe ao menos ${mine} lugar(es).`,
      );
    }

    // Quem passa a dirigir deixa o assento de passageiro.
    await trx
      .deleteFrom('vehicle_passengers')
      .where('event_id', '=', eventId)
      .where('user_id', '=', userId)
      .execute();
    await trx
      .insertInto('vehicles')
      .values({
        id: newId(),
        event_id: eventId,
        driver_id: userId,
        label: input.label,
        departure_place: input.departurePlace ?? null,
        departure_time: input.departureTime ?? null,
        seats: input.seats,
        cargo_capacity: input.cargoCapacity,
        cargo_note: input.cargoNote ?? null,
        created_at: ctx.clock.now().toISOString(),
      })
      .execute();
    await audit(trx, ctx.clock.now(), {
      eventId,
      actorId: userId,
      action: 'vehicle.created',
      entity: 'vehicle',
    });
  });
}

export async function updateVehicle(
  ctx: AppContext,
  userId: string,
  vehicleId: string,
  patch: {
    label?: string;
    seats?: number;
    cargoCapacity?: number;
    departurePlace?: string | null;
    departureTime?: string | null;
    cargoNote?: string | null;
  },
): Promise<void> {
  const { vehicle, event } = await loadVehicle(ctx, vehicleId);
  assertActive(event);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (vehicle.driver_id !== userId && !can(actor, 'fleet.edit')) {
    throw forbidden('Só o motorista (ou o General da Frota) edita o carro');
  }
  if (patch.seats !== undefined) {
    const riders = await ctx.db
      .selectFrom('vehicle_passengers')
      .select('user_id')
      .where('vehicle_id', '=', vehicleId)
      .execute();
    const used = occupiedSeats(
      vehicle.driver_id,
      riders.map((r) => r.user_id),
      await loadParties(ctx.db, event.id),
    );
    if (patch.seats < used) {
      throw conflict(
        'SEATS_TOO_FEW',
        `Já há ${used} lugar(es) ocupado(s). Remova alguém antes de reduzir os lugares.`,
      );
    }
  }
  const set: Record<string, unknown> = {};
  if (patch.label !== undefined) set.label = patch.label;
  if (patch.seats !== undefined) set.seats = patch.seats;
  if (patch.cargoCapacity !== undefined) set.cargo_capacity = patch.cargoCapacity;
  if (patch.departurePlace !== undefined) set.departure_place = patch.departurePlace;
  if (patch.departureTime !== undefined) set.departure_time = patch.departureTime;
  if (patch.cargoNote !== undefined) set.cargo_note = patch.cargoNote;
  if (Object.keys(set).length > 0)
    await ctx.db.updateTable('vehicles').set(set).where('id', '=', vehicleId).execute();
}

export async function deleteVehicle(
  ctx: AppContext,
  userId: string,
  vehicleId: string,
): Promise<void> {
  const { vehicle, event } = await loadVehicle(ctx, vehicleId);
  assertActive(event);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (vehicle.driver_id !== userId && !can(actor, 'fleet.edit')) {
    throw forbidden('Só o motorista (ou o General da Frota) remove o carro');
  }
  const riders = await ctx.db
    .selectFrom('vehicle_passengers')
    .select('user_id')
    .where('vehicle_id', '=', vehicleId)
    .execute();
  await ctx.db.deleteFrom('vehicles').where('id', '=', vehicleId).execute();
  await notify(ctx.db, ctx.clock.now(), {
    userIds: riders.map((r) => r.user_id),
    eventId: event.id,
    kind: 'fleet.vehicle_removed',
    title: 'Seu carro saiu da lista',
    body: `${vehicle.label} foi removido de ${event.title}. Escolha outro lugar na aba Frotas.`,
    dedupeKey: `fleet.vehicle_removed:${vehicleId}`,
  });
}

async function seatUser(
  ctx: AppContext,
  actorId: string,
  vehicleId: string,
  targetId: string,
  asManager: boolean,
) {
  await ctx.db.transaction().execute(async (trx) => {
    const vehicle = await trx
      .selectFrom('vehicles')
      .selectAll()
      .where('id', '=', vehicleId)
      .executeTakeFirst();
    if (!vehicle) throw notFound('Carro não encontrado');
    const event = await requireEvent(trx, vehicle.event_id);
    assertActive(event);
    await assertSeatEligible(trx, event, targetId);

    if (vehicle.driver_id === targetId) throw conflict('IS_DRIVER', 'Motorista já está no carro');
    const drives = await trx
      .selectFrom('vehicles')
      .select('id')
      .where('event_id', '=', event.id)
      .where('driver_id', '=', targetId)
      .executeTakeFirst();
    if (drives) throw conflict('IS_DRIVER', 'Quem dirige um carro não ocupa lugar em outro');

    const already = await trx
      .selectFrom('vehicle_passengers')
      .select('vehicle_id')
      .where('event_id', '=', event.id)
      .where('user_id', '=', targetId)
      .executeTakeFirst();
    if (already?.vehicle_id === vehicleId) return; // idempotente

    const riders = await trx
      .selectFrom('vehicle_passengers')
      .select('user_id')
      .where('vehicle_id', '=', vehicleId)
      .execute();
    const parties = await loadParties(trx, event.id);
    const used = occupiedSeats(
      vehicle.driver_id,
      riders.map((r) => r.user_id),
      parties,
    );
    // Quem tem acompanhante ocupa um lugar por pessoa (criança inclusa).
    if (used + partyOf(parties, targetId).heads > vehicle.seats) {
      throw conflict('NO_SEATS', 'Esse carro está lotado para a sua turma');
    }

    // Troca de carro: libera o assento anterior.
    await trx
      .deleteFrom('vehicle_passengers')
      .where('event_id', '=', event.id)
      .where('user_id', '=', targetId)
      .execute();
    await trx
      .insertInto('vehicle_passengers')
      .values({ vehicle_id: vehicleId, event_id: event.id, user_id: targetId })
      .execute();

    const names = await usersById(trx, [targetId]);
    await notify(trx, ctx.clock.now(), {
      userIds: asManager ? [targetId, vehicle.driver_id] : [vehicle.driver_id],
      eventId: event.id,
      kind: 'fleet.passenger_joined',
      title: 'Novo passageiro',
      body: `${names.get(targetId)?.name ?? 'Alguém'} ficou no ${vehicle.label} (${event.title}).`,
      dedupeKey: `fleet.passenger_joined:${vehicleId}:${targetId}:${ctx.clock.now().getTime()}`,
    });
    await audit(trx, ctx.clock.now(), {
      eventId: event.id,
      actorId,
      action: 'vehicle.seat_taken',
      entity: 'vehicle',
      entityId: vehicleId,
      data: { userId: targetId },
    });
  });
}

export const joinVehicle = (ctx: AppContext, userId: string, vehicleId: string) =>
  seatUser(ctx, userId, vehicleId, userId, false);

export async function assignPassenger(
  ctx: AppContext,
  managerId: string,
  vehicleId: string,
  targetId: string,
) {
  const { event } = await loadVehicle(ctx, vehicleId);
  const { actor } = await buildActor(ctx.db, event, managerId);
  if (!can(actor, 'fleet.edit')) throw forbidden('Só o General da Frota aloca passageiros');
  return seatUser(ctx, managerId, vehicleId, targetId, true);
}

export async function leaveVehicle(
  ctx: AppContext,
  userId: string,
  vehicleId: string,
): Promise<void> {
  const { vehicle, event } = await loadVehicle(ctx, vehicleId);
  assertActive(event);
  void vehicle;
  await ctx.db
    .deleteFrom('vehicle_passengers')
    .where('vehicle_id', '=', vehicleId)
    .where('user_id', '=', userId)
    .execute();
}

export async function removePassenger(
  ctx: AppContext,
  actorId: string,
  vehicleId: string,
  targetId: string,
) {
  const { vehicle, event } = await loadVehicle(ctx, vehicleId);
  assertActive(event);
  const { actor } = await buildActor(ctx.db, event, actorId);
  if (vehicle.driver_id !== actorId && !can(actor, 'fleet.edit')) {
    throw forbidden('Só o motorista (ou o General da Frota) tira passageiros');
  }
  await ctx.db
    .deleteFrom('vehicle_passengers')
    .where('vehicle_id', '=', vehicleId)
    .where('user_id', '=', targetId)
    .execute();
  await notify(ctx.db, ctx.clock.now(), {
    userIds: [targetId],
    eventId: event.id,
    kind: 'fleet.removed',
    title: 'Você saiu de um carro',
    body: `Você foi removido do ${vehicle.label} em ${event.title}. Escolha outro lugar na aba Frotas.`,
    dedupeKey: `fleet.removed:${vehicleId}:${targetId}:${ctx.clock.now().getTime()}`,
  });
}

/* ------------------------------------ Bagagem ------------------------------------ */

export async function createCargo(
  ctx: AppContext,
  userId: string,
  eventId: string,
  input: { name: string; vehicleId?: string | null | undefined },
): Promise<void> {
  const event = await requireEvent(ctx.db, eventId);
  assertActive(event);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'fleet.edit')) throw forbidden('Só o General da Frota cadastra itens de bagagem');
  if (input.vehicleId) await assertVehicleInEvent(ctx.db, input.vehicleId, eventId);
  await ctx.db
    .insertInto('cargo_items')
    .values({
      id: newId(),
      event_id: eventId,
      name: input.name,
      vehicle_id: input.vehicleId ?? null,
      created_by: userId,
      created_at: ctx.clock.now().toISOString(),
    })
    .execute();
}

async function assertVehicleInEvent(db: Db, vehicleId: string, eventId: string) {
  const v = await db
    .selectFrom('vehicles')
    .select('id')
    .where('id', '=', vehicleId)
    .where('event_id', '=', eventId)
    .executeTakeFirst();
  if (!v) throw notFound('Carro não encontrado neste rolê');
}

async function loadCargo(ctx: AppContext, cargoId: string) {
  const cargo = await ctx.db
    .selectFrom('cargo_items')
    .selectAll()
    .where('id', '=', cargoId)
    .executeTakeFirst();
  if (!cargo) throw notFound('Item não encontrado');
  return { cargo, event: await requireEvent(ctx.db, cargo.event_id) };
}

export async function moveCargo(
  ctx: AppContext,
  userId: string,
  cargoId: string,
  vehicleId: string | null,
) {
  const { cargo, event } = await loadCargo(ctx, cargoId);
  assertActive(event);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'fleet.edit')) throw forbidden('Só o General da Frota aloca a bagagem');
  if (vehicleId) await assertVehicleInEvent(ctx.db, vehicleId, cargo.event_id);
  await ctx.db
    .updateTable('cargo_items')
    .set({ vehicle_id: vehicleId })
    .where('id', '=', cargoId)
    .execute();
}

export async function deleteCargo(ctx: AppContext, userId: string, cargoId: string) {
  const { event } = await loadCargo(ctx, cargoId);
  assertActive(event);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'fleet.edit')) throw forbidden('Só o General da Frota remove itens de bagagem');
  await ctx.db.deleteFrom('cargo_items').where('id', '=', cargoId).execute();
}
