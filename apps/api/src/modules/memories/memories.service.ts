import type { PackingDto, PhotosDto, TracksDto } from '@role/contracts';
import { can } from '@role/domain';
import type { AppContext } from '../../context';
import { conflict, forbidden, notFound, unprocessable } from '../../errors';
import { newId } from '../../ids';
import { detectFile } from '../../lib/sniff';
import { buildActor, requireEvent, usersById, type EventRow } from '../events/event.queries';

export const MAX_PHOTOS_PER_EVENT = 40;
const MAX_TRACKS_PER_EVENT = 60;
const MAX_PACKING_PER_USER = 80;

/** Quem está no rolê (ou o comanda) vê o mural; abrir e fechar a conta não o tranca. */
async function memberContext(ctx: AppContext, userId: string, eventId: string) {
  const event = await requireEvent(ctx.db, eventId);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'event.viewInternal')) throw forbidden('Confirme presença para ver o mural');
  return { event, actor };
}

const isLive = (event: EventRow) => event.status === 'open' || event.status === 'confirmed';

/* ----------------------------------------- Fotos ----------------------------------------- */

export async function listPhotos(
  ctx: AppContext,
  userId: string,
  eventId: string,
): Promise<PhotosDto> {
  const { event, actor } = await memberContext(ctx, userId, eventId);
  const rows = await ctx.db
    .selectFrom('event_photos')
    .select(['id', 'user_id', 'created_at'])
    .where('event_id', '=', eventId)
    .orderBy('created_at', 'desc')
    .execute();
  const users = await usersById(
    ctx.db,
    rows.map((r) => r.user_id),
  );
  return {
    max: MAX_PHOTOS_PER_EVENT,
    canAdd: can(actor, 'photos.add') && (event.status === 'confirmed' || event.status === 'closed'),
    photos: rows.map((r) => ({
      id: r.id,
      by: users.get(r.user_id) ?? { id: r.user_id, name: '—' },
      createdAt: r.created_at,
      mine: r.user_id === userId,
      canDelete: r.user_id === userId || actor.isOrganizer,
    })),
  };
}

export async function addPhoto(
  ctx: AppContext,
  userId: string,
  eventId: string,
  data: Buffer,
): Promise<void> {
  const { event, actor } = await memberContext(ctx, userId, eventId);
  if (!can(actor, 'photos.add')) throw forbidden('Só quem confirmou presença posta fotos');
  if (event.status !== 'confirmed' && event.status !== 'closed') {
    throw conflict('EVENT_NOT_ACTIVE', 'O mural abre quando o rolê é confirmado');
  }
  const detected = detectFile(data);
  if (!detected || detected.mime === 'application/pdf') {
    throw unprocessable('INVALID_FILE', 'Envie uma foto em JPG, PNG ou WebP');
  }
  const count = await ctx.db
    .selectFrom('event_photos')
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('event_id', '=', eventId)
    .executeTakeFirstOrThrow();
  if (Number(count.n) >= MAX_PHOTOS_PER_EVENT) {
    throw conflict('PHOTO_LIMIT', `O mural comporta até ${MAX_PHOTOS_PER_EVENT} fotos`);
  }
  const key = await ctx.storage.save(`photos/${eventId}`, data, detected.extension);
  await ctx.db
    .insertInto('event_photos')
    .values({
      id: newId(),
      event_id: eventId,
      user_id: userId,
      file_key: key,
      mime: detected.mime,
      created_at: ctx.clock.now().toISOString(),
    })
    .execute();
}

export async function openPhoto(ctx: AppContext, userId: string, photoId: string) {
  const photo = await ctx.db
    .selectFrom('event_photos')
    .selectAll()
    .where('id', '=', photoId)
    .executeTakeFirst();
  if (!photo) throw notFound('Foto não encontrada');
  await memberContext(ctx, userId, photo.event_id);
  return { stream: ctx.storage.open(photo.file_key), mime: photo.mime };
}

export async function deletePhoto(ctx: AppContext, userId: string, photoId: string): Promise<void> {
  const photo = await ctx.db
    .selectFrom('event_photos')
    .selectAll()
    .where('id', '=', photoId)
    .executeTakeFirst();
  if (!photo) throw notFound('Foto não encontrada');
  const { actor } = await memberContext(ctx, userId, photo.event_id);
  if (photo.user_id !== userId && !actor.isOrganizer) {
    throw forbidden('Só quem postou (ou o Idealizador) apaga a foto');
  }
  await ctx.storage.remove(photo.file_key).catch(() => undefined);
  await ctx.db.deleteFrom('event_photos').where('id', '=', photoId).execute();
}

/* --------------------------------------- Bagagem ---------------------------------------- */

export async function listPacking(
  ctx: AppContext,
  userId: string,
  eventId: string,
): Promise<PackingDto> {
  const { actor } = await memberContext(ctx, userId, eventId);
  const items = await ctx.db
    .selectFrom('packing_items')
    .selectAll()
    .where('event_id', '=', eventId)
    .where((eb) => eb.or([eb('owner_id', 'is', null), eb('owner_id', '=', userId)]))
    .orderBy('created_at')
    .execute();
  const checks =
    items.length > 0
      ? await ctx.db
          .selectFrom('packing_checks')
          .select('item_id')
          .where('user_id', '=', userId)
          .where(
            'item_id',
            'in',
            items.map((i) => i.id),
          )
          .execute()
      : [];
  const done = new Set(checks.map((c) => c.item_id));
  const canSuggest = can(actor, 'base.edit');
  return {
    canSuggest,
    doneCount: items.filter((i) => done.has(i.id)).length,
    items: items.map((i) => ({
      id: i.id,
      label: i.label,
      scope: i.owner_id ? ('mine' as const) : ('group' as const),
      checked: done.has(i.id),
      canDelete: i.owner_id ? i.owner_id === userId : canSuggest,
    })),
  };
}

export async function addPackingItem(
  ctx: AppContext,
  userId: string,
  eventId: string,
  input: { label: string; scope: 'group' | 'mine' },
): Promise<void> {
  const { event, actor } = await memberContext(ctx, userId, eventId);
  if (!isLive(event)) throw conflict('EVENT_NOT_ACTIVE', 'Este rolê não aceita mais itens');
  if (input.scope === 'group' && !can(actor, 'base.edit')) {
    throw forbidden('Só o General da Base sugere itens para todos');
  }
  const mine = await ctx.db
    .selectFrom('packing_items')
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('event_id', '=', eventId)
    .where('created_by', '=', userId)
    .executeTakeFirstOrThrow();
  if (Number(mine.n) >= MAX_PACKING_PER_USER) {
    throw conflict('PACKING_LIMIT', 'Lista cheia: apague algum item antes de adicionar');
  }
  await ctx.db
    .insertInto('packing_items')
    .values({
      id: newId(),
      event_id: eventId,
      owner_id: input.scope === 'mine' ? userId : null,
      label: input.label,
      created_by: userId,
      created_at: ctx.clock.now().toISOString(),
    })
    .execute();
}

async function visiblePackingItem(ctx: AppContext, userId: string, itemId: string) {
  const item = await ctx.db
    .selectFrom('packing_items')
    .selectAll()
    .where('id', '=', itemId)
    .executeTakeFirst();
  // Item pessoal de outra pessoa não existe para quem pergunta.
  if (!item || (item.owner_id && item.owner_id !== userId)) throw notFound('Item não encontrado');
  const { actor } = await memberContext(ctx, userId, item.event_id);
  return { item, actor };
}

export async function checkPackingItem(
  ctx: AppContext,
  userId: string,
  itemId: string,
  checked: boolean,
): Promise<void> {
  const { item } = await visiblePackingItem(ctx, userId, itemId);
  if (checked) {
    await ctx.db
      .insertInto('packing_checks')
      .values({ item_id: item.id, user_id: userId })
      .onConflict((oc) => oc.doNothing())
      .execute();
  } else {
    await ctx.db
      .deleteFrom('packing_checks')
      .where('item_id', '=', item.id)
      .where('user_id', '=', userId)
      .execute();
  }
}

export async function deletePackingItem(
  ctx: AppContext,
  userId: string,
  itemId: string,
): Promise<void> {
  const { item, actor } = await visiblePackingItem(ctx, userId, itemId);
  const allowed = item.owner_id ? item.owner_id === userId : can(actor, 'base.edit');
  if (!allowed) throw forbidden('Só o General da Base remove itens do grupo');
  await ctx.db.deleteFrom('packing_items').where('id', '=', itemId).execute();
}

/* ---------------------------------------- Trilha ---------------------------------------- */

export async function listTracks(
  ctx: AppContext,
  userId: string,
  eventId: string,
): Promise<TracksDto> {
  const { event, actor } = await memberContext(ctx, userId, eventId);
  const [tracks, votes] = await Promise.all([
    ctx.db.selectFrom('tracks').selectAll().where('event_id', '=', eventId).execute(),
    ctx.db
      .selectFrom('track_votes')
      .innerJoin('tracks', 'tracks.id', 'track_votes.track_id')
      .select(['track_votes.track_id as track_id', 'track_votes.user_id as user_id'])
      .where('tracks.event_id', '=', eventId)
      .execute(),
  ]);
  const users = await usersById(
    ctx.db,
    tracks.map((t) => t.user_id),
  );
  const dtos = tracks.map((t) => {
    const mine = votes.filter((v) => v.track_id === t.id);
    return {
      id: t.id,
      title: t.title,
      url: t.url,
      by: users.get(t.user_id) ?? { id: t.user_id, name: '—' },
      votes: mine.length,
      votedByMe: mine.some((v) => v.user_id === userId),
      canDelete: t.user_id === userId || actor.isOrganizer,
      createdAt: t.created_at,
    };
  });
  // Mais votadas primeiro; no empate, a que chegou antes.
  dtos.sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt));
  return {
    playlistUrl: event.playlist_url,
    canEditPlaylist: can(actor, 'base.edit') && isLive(event),
    tracks: dtos.map(({ createdAt: _createdAt, ...rest }) => rest),
  };
}

export async function addTrack(
  ctx: AppContext,
  userId: string,
  eventId: string,
  input: { title: string; url?: string | undefined },
): Promise<void> {
  const { event, actor } = await memberContext(ctx, userId, eventId);
  if (!can(actor, 'tracks.add')) throw forbidden('Só quem confirmou presença sugere música');
  if (!isLive(event)) throw conflict('EVENT_NOT_ACTIVE', 'Este rolê não aceita mais sugestões');
  const count = await ctx.db
    .selectFrom('tracks')
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('event_id', '=', eventId)
    .executeTakeFirstOrThrow();
  if (Number(count.n) >= MAX_TRACKS_PER_EVENT) {
    throw conflict('TRACK_LIMIT', 'A trilha está cheia: vote nas que já estão lá');
  }
  const id = newId();
  await ctx.db
    .insertInto('tracks')
    .values({
      id,
      event_id: eventId,
      user_id: userId,
      title: input.title,
      url: input.url ?? null,
      created_at: ctx.clock.now().toISOString(),
    })
    // Quem sugere já vota na própria música.
    .execute();
  await ctx.db.insertInto('track_votes').values({ track_id: id, user_id: userId }).execute();
}

export async function toggleTrackVote(
  ctx: AppContext,
  userId: string,
  trackId: string,
): Promise<void> {
  const track = await ctx.db
    .selectFrom('tracks')
    .selectAll()
    .where('id', '=', trackId)
    .executeTakeFirst();
  if (!track) throw notFound('Música não encontrada');
  const { event, actor } = await memberContext(ctx, userId, track.event_id);
  if (!can(actor, 'tracks.add')) throw forbidden('Só quem confirmou presença vota');
  if (!isLive(event)) throw conflict('EVENT_NOT_ACTIVE', 'Este rolê não aceita mais votos');
  const existing = await ctx.db
    .selectFrom('track_votes')
    .select('user_id')
    .where('track_id', '=', trackId)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  if (existing) {
    await ctx.db
      .deleteFrom('track_votes')
      .where('track_id', '=', trackId)
      .where('user_id', '=', userId)
      .execute();
  } else {
    await ctx.db.insertInto('track_votes').values({ track_id: trackId, user_id: userId }).execute();
  }
}

export async function deleteTrack(ctx: AppContext, userId: string, trackId: string): Promise<void> {
  const track = await ctx.db
    .selectFrom('tracks')
    .selectAll()
    .where('id', '=', trackId)
    .executeTakeFirst();
  if (!track) throw notFound('Música não encontrada');
  const { actor } = await memberContext(ctx, userId, track.event_id);
  if (track.user_id !== userId && !actor.isOrganizer) {
    throw forbidden('Só quem sugeriu (ou o Idealizador) remove a música');
  }
  await ctx.db.deleteFrom('tracks').where('id', '=', trackId).execute();
}

export async function setPlaylist(
  ctx: AppContext,
  userId: string,
  eventId: string,
  url: string | null,
): Promise<void> {
  const { event, actor } = await memberContext(ctx, userId, eventId);
  if (!can(actor, 'base.edit')) throw forbidden('Só o General da Base define a playlist');
  if (!isLive(event)) throw conflict('EVENT_NOT_ACTIVE', 'Este rolê não aceita mais alterações');
  await ctx.db.updateTable('events').set({ playlist_url: url }).where('id', '=', eventId).execute();
}

/** Exclusão de conta: as fotos que a pessoa postou saem do mural e do disco. */
export async function removeUserPhotos(ctx: AppContext, userId: string): Promise<void> {
  const photos = await ctx.db
    .selectFrom('event_photos')
    .select(['id', 'file_key'])
    .where('user_id', '=', userId)
    .execute();
  for (const p of photos) await ctx.storage.remove(p.file_key).catch(() => undefined);
  await ctx.db.deleteFrom('event_photos').where('user_id', '=', userId).execute();
}
