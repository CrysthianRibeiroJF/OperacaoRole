import { can, canTakeAnotherRole, drawRoles, ROLE_LABELS, type RoleKey } from '@role/domain';
import type { AppContext, Db } from '../../context';
import { conflict, forbidden } from '../../errors';
import { audit } from '../../lib/audit';
import { dayBucket, notify } from '../notifications/notifications.service';
import {
  buildActor,
  confirmedUserIds,
  getEventRoles,
  requireEvent,
  vacantRolesOf,
  type EventRow,
} from '../events/event.queries';

function assertRolesOpen(event: EventRow) {
  if (event.status !== 'confirmed') {
    throw conflict(
      'ROLES_LOCKED',
      'Os cargos ficam disponíveis enquanto o rolê está confirmado e em andamento',
    );
  }
}

/** RN-21: assumir voluntariamente. Um cargo tem um único ocupante e cada pessoa tem um teto de cargos. */
export async function claimRole(
  ctx: AppContext,
  userId: string,
  eventId: string,
  role: RoleKey,
): Promise<void> {
  await ctx.db.transaction().execute(async (trx) => {
    const now = ctx.clock.now();
    const event = await requireEvent(trx, eventId);
    assertRolesOpen(event);
    const { actor, roleRows } = await buildActor(trx, event, userId);
    if (!can(actor, 'roles.claim')) throw forbidden('Só quem confirmou presença assume cargos');
    if (roleRows.some((r) => r.role === role)) {
      throw conflict('ROLE_TAKEN', `${ROLE_LABELS[role]} já tem ocupante`);
    }
    if (!canTakeAnotherRole(actor.roles, event.max_roles_per_user)) {
      throw conflict(
        'ROLE_LIMIT',
        `Cada pessoa pode ter no máximo ${event.max_roles_per_user} cargos`,
      );
    }

    await trx
      .insertInto('event_roles')
      .values({
        event_id: eventId,
        role,
        user_id: userId,
        drawn: 0,
        assigned_at: now.toISOString(),
      })
      .execute();
    await audit(trx, now, {
      eventId,
      actorId: userId,
      action: 'role.claimed',
      entity: 'role',
      entityId: role,
    });
  });
}

/** Quem abre mão de um cargo sorteado não entra no próximo sorteio daquele cargo (RN-21). */
export async function releaseRole(
  ctx: AppContext,
  userId: string,
  eventId: string,
  role: RoleKey,
): Promise<void> {
  await ctx.db.transaction().execute(async (trx) => {
    const now = ctx.clock.now();
    const event = await requireEvent(trx, eventId);
    assertRolesOpen(event);
    const row = (await getEventRoles(trx, eventId)).find((r) => r.role === role);
    if (!row || row.user_id !== userId) throw forbidden('Você não ocupa este cargo');

    await trx
      .deleteFrom('event_roles')
      .where('event_id', '=', eventId)
      .where('role', '=', role)
      .execute();
    if (row.drawn === 1) {
      await trx
        .insertInto('role_declines')
        .values({ event_id: eventId, user_id: userId, role })
        .onConflict((oc) => oc.doNothing())
        .execute();
    }
    await audit(trx, now, {
      eventId,
      actorId: userId,
      action: 'role.released',
      entity: 'role',
      entityId: role,
    });
  });
}

export async function drawVacantRoles(
  ctx: AppContext,
  userId: string,
  eventId: string,
): Promise<RoleKey[]> {
  return ctx.db.transaction().execute(async (trx) => {
    const now = ctx.clock.now();
    const event = await requireEvent(trx, eventId);
    assertRolesOpen(event);
    const { actor, roleRows } = await buildActor(trx, event, userId);
    if (!can(actor, 'roles.draw')) throw forbidden('Só o Idealizador sorteia os cargos');

    const vacant = vacantRolesOf(roleRows);
    if (vacant.length === 0) throw conflict('NO_VACANT_ROLES', 'Todos os cargos já têm ocupante');

    const members = await confirmedUserIds(trx, eventId);
    const declines = await trx
      .selectFrom('role_declines')
      .selectAll()
      .where('event_id', '=', eventId)
      .execute();
    const assignments = drawRoles({
      vacantRoles: vacant,
      maxRolesPerUser: event.max_roles_per_user,
      candidates: members.map((id) => ({
        userId: id,
        roles: roleRows.filter((r) => r.user_id === id).map((r) => r.role),
        declined: declines.filter((d) => d.user_id === id).map((d) => d.role as RoleKey),
      })),
    });

    for (const a of assignments) {
      await trx
        .insertInto('event_roles')
        .values({
          event_id: eventId,
          role: a.role,
          user_id: a.userId,
          drawn: 1,
          assigned_at: now.toISOString(),
        })
        .execute();
      await notify(trx, now, {
        userIds: [a.userId],
        eventId,
        kind: 'role.drawn',
        title: `Você foi sorteado: ${ROLE_LABELS[a.role]}`,
        body: `Em ${event.title}, a missão ficou com você. Se não puder, é só abrir mão do cargo uma vez.`,
        dedupeKey: `role.drawn:${eventId}:${a.role}:${now.getTime()}`,
      });
    }
    await audit(trx, now, {
      eventId,
      actorId: userId,
      action: 'role.drawn',
      entity: 'event',
      entityId: eventId,
      data: { assignments },
    });
    return assignments.map((a) => a.role);
  });
}

/** Job: a poucos dias do rolê, cargo vazio vira alerta de "Missão Pendente" (RN-24). */
export async function alertVacantRoles(db: Db, now: Date, eventId: string): Promise<void> {
  const event = await requireEvent(db, eventId);
  if (event.status !== 'confirmed') return;
  const vacant = vacantRolesOf(await getEventRoles(db, eventId));
  if (vacant.length === 0) return;

  const labels = vacant.map((r) => ROLE_LABELS[r]).join(', ');
  await notify(db, now, {
    userIds: await confirmedUserIds(db, eventId),
    eventId,
    kind: 'role.vacant',
    title: 'Missão pendente',
    body: `${event.title} está chegando e ninguém assumiu: ${labels}. Quem se habilita?`,
    dedupeKey: `role.vacant:${eventId}:${dayBucket(now)}`,
  });
}
