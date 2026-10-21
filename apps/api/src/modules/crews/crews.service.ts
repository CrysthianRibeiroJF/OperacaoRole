import type { CrewDto, CrewPreview } from '@role/contracts';
import type { AppContext, Db } from '../../context';
import { conflict, forbidden, notFound } from '../../errors';
import { newId, newInviteCode } from '../../ids';
import { audit } from '../../lib/audit';
import { requireEvent, usersById } from '../events/event.queries';
import { notify } from '../notifications/notifications.service';

async function requireCrew(db: Db, id: string) {
  const crew = await db.selectFrom('crews').selectAll().where('id', '=', id).executeTakeFirst();
  if (!crew) throw notFound('Tropa não encontrada');
  return crew;
}

async function memberIds(db: Db, crewId: string): Promise<string[]> {
  const rows = await db
    .selectFrom('crew_members')
    .select('user_id')
    .where('crew_id', '=', crewId)
    .orderBy('joined_at')
    .execute();
  return rows.map((r) => r.user_id);
}

async function toDtos(
  db: Db,
  crews: { id: string; code: string; name: string; owner_id: string }[],
  userId: string,
): Promise<CrewDto[]> {
  if (crews.length === 0) return [];
  const members = await db
    .selectFrom('crew_members')
    .select(['crew_id', 'user_id'])
    .where(
      'crew_id',
      'in',
      crews.map((c) => c.id),
    )
    .orderBy('joined_at')
    .execute();
  const users = await usersById(db, [
    ...crews.map((c) => c.owner_id),
    ...members.map((m) => m.user_id),
  ]);
  const user = (id: string) => users.get(id) ?? { id, name: '—' };
  return crews.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    owner: user(c.owner_id),
    members: members.filter((m) => m.crew_id === c.id).map((m) => user(m.user_id)),
    isOwner: c.owner_id === userId,
  }));
}

export async function listCrews(ctx: AppContext, userId: string): Promise<CrewDto[]> {
  const rows = await ctx.db
    .selectFrom('crews')
    .selectAll()
    .where(
      'id',
      'in',
      ctx.db.selectFrom('crew_members').select('crew_id').where('user_id', '=', userId),
    )
    .orderBy('created_at')
    .execute();
  return toDtos(ctx.db, rows, userId);
}

export async function createCrew(ctx: AppContext, userId: string, name: string): Promise<CrewDto> {
  const now = ctx.clock.now().toISOString();
  const id = newId();
  await ctx.db.transaction().execute(async (trx) => {
    let inserted = false;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      try {
        await trx
          .insertInto('crews')
          .values({ id, code: newInviteCode(), owner_id: userId, name, created_at: now })
          .execute();
        inserted = true;
      } catch (err) {
        if (!(err instanceof Error) || !/UNIQUE.*crews\.code/i.test(err.message)) throw err;
      }
    }
    if (!inserted)
      throw conflict('CODE_COLLISION', 'Não foi possível gerar o link. Tente de novo.');
    await trx
      .insertInto('crew_members')
      .values({ crew_id: id, user_id: userId, joined_at: now })
      .execute();
  });
  return (await toDtos(ctx.db, [await requireCrew(ctx.db, id)], userId))[0]!;
}

/** Prévia pública do link da tropa (nome, dono e quantos já entraram): nada além disso. */
export async function previewCrew(
  ctx: AppContext,
  code: string,
  userId: string | null,
): Promise<CrewPreview> {
  const crew = await ctx.db
    .selectFrom('crews')
    .selectAll()
    .where('code', '=', code.toUpperCase())
    .executeTakeFirst();
  if (!crew) throw notFound('Tropa não encontrada');
  const members = await memberIds(ctx.db, crew.id);
  const owner = (await usersById(ctx.db, [crew.owner_id])).get(crew.owner_id) ?? {
    id: crew.owner_id,
    name: '—',
  };
  return {
    code: crew.code,
    name: crew.name,
    owner,
    memberCount: members.length,
    joined: userId ? members.includes(userId) : null,
  };
}

/** Entrar é um gesto da própria pessoa: ninguém é colocado numa tropa sem abrir o link. */
export async function joinCrew(ctx: AppContext, userId: string, code: string): Promise<CrewDto> {
  const crew = await ctx.db
    .selectFrom('crews')
    .selectAll()
    .where('code', '=', code.toUpperCase())
    .executeTakeFirst();
  if (!crew) throw notFound('Tropa não encontrada');
  await ctx.db
    .insertInto('crew_members')
    .values({ crew_id: crew.id, user_id: userId, joined_at: ctx.clock.now().toISOString() })
    .onConflict((oc) => oc.doNothing())
    .execute();
  return (await toDtos(ctx.db, [crew], userId))[0]!;
}

export async function leaveCrew(ctx: AppContext, userId: string, crewId: string): Promise<void> {
  const crew = await requireCrew(ctx.db, crewId);
  if (crew.owner_id === userId) {
    throw conflict('OWNER_CANNOT_LEAVE', 'Quem criou a tropa não sai: exclua a tropa, se quiser.');
  }
  await ctx.db
    .deleteFrom('crew_members')
    .where('crew_id', '=', crewId)
    .where('user_id', '=', userId)
    .execute();
}

export async function removeCrewMember(
  ctx: AppContext,
  userId: string,
  crewId: string,
  targetId: string,
): Promise<void> {
  const crew = await requireCrew(ctx.db, crewId);
  if (crew.owner_id !== userId) throw forbidden('Só quem criou a tropa tira gente dela');
  if (targetId === userId) throw conflict('OWNER_CANNOT_LEAVE', 'Você é o dono da tropa');
  await ctx.db
    .deleteFrom('crew_members')
    .where('crew_id', '=', crewId)
    .where('user_id', '=', targetId)
    .execute();
}

export async function deleteCrew(ctx: AppContext, userId: string, crewId: string): Promise<void> {
  const crew = await requireCrew(ctx.db, crewId);
  if (crew.owner_id !== userId) throw forbidden('Só quem criou a tropa a exclui');
  await ctx.db.deleteFrom('crews').where('id', '=', crewId).execute();
}

/**
 * "Chamar a tropa": o Idealizador avisa os membros de que há proposta nova. É só um aviso dentro do
 * app, com o link do convite; ninguém é confirmado por isso e quem já respondeu não é incomodado.
 */
export async function inviteCrewToEvent(
  ctx: AppContext,
  userId: string,
  eventId: string,
  crewId: string,
): Promise<{ invited: number }> {
  const event = await requireEvent(ctx.db, eventId);
  if (event.organizer_id !== userId) throw forbidden('Só o Idealizador chama a tropa');
  if (event.status !== 'open' && event.status !== 'confirmed') {
    throw conflict('EVENT_NOT_ACTIVE', 'Só dá para chamar a tropa de um rolê em andamento');
  }
  const crew = await requireCrew(ctx.db, crewId);
  const members = await memberIds(ctx.db, crewId);
  if (!members.includes(userId)) throw forbidden('Você não faz parte dessa tropa');

  const answered = await ctx.db
    .selectFrom('participations')
    .select('user_id')
    .where('event_id', '=', eventId)
    .execute();
  const skip = new Set([userId, ...answered.map((a) => a.user_id)]);
  const targets = members.filter((id) => !skip.has(id));

  const now = ctx.clock.now();
  await notify(ctx.db, now, {
    userIds: targets,
    eventId: null,
    kind: 'crew.invited',
    title: `A tropa ${crew.name} foi chamada`,
    body: `${event.title} em ${event.destination}. Abra o convite e responda.`,
    dedupeKey: `crew.invited:${eventId}:${crewId}`,
    link: `/c/${event.code}`,
  });
  await audit(ctx.db, now, {
    eventId,
    actorId: userId,
    action: 'crew.invited',
    entity: 'crew',
    entityId: crewId,
    data: { count: targets.length },
  });
  return { invited: targets.length };
}
