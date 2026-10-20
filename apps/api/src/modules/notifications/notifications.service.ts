import type { NotificationDto } from '@role/contracts';
import type { Db } from '../../context';
import { newId } from '../../ids';

export interface NotifyInput {
  userIds: readonly string[];
  eventId: string | null;
  kind: string;
  title: string;
  body: string;
  /**
   * Chave de deduplicação por usuário (RN-50): o mesmo gatilho não notifica duas vezes.
   * Lembretes recorrentes incluem o "balde" de tempo na chave (ex.: o dia).
   */
  dedupeKey: string;
}

/**
 * Cria notificações in-app, respeitando o silenciamento por rolê (RN-51).
 * Esta tabela também é a fila de saída: adaptadores de push/WhatsApp/e-mail (P1) leem daqui.
 */
export async function notify(db: Db, now: Date, input: NotifyInput): Promise<void> {
  const ids = [...new Set(input.userIds)];
  if (ids.length === 0) return;

  let recipients = ids;
  if (input.eventId) {
    const muted = await db
      .selectFrom('event_mutes')
      .select('user_id')
      .where('event_id', '=', input.eventId)
      .where('user_id', 'in', ids)
      .execute();
    const mutedIds = new Set(muted.map((m) => m.user_id));
    recipients = ids.filter((id) => !mutedIds.has(id));
  }
  if (recipients.length === 0) return;

  await db
    .insertInto('notifications')
    .values(
      recipients.map((userId) => ({
        id: newId(),
        user_id: userId,
        event_id: input.eventId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        dedupe_key: input.dedupeKey,
        created_at: now.toISOString(),
        read_at: null,
      })),
    )
    .onConflict((oc) => oc.columns(['user_id', 'dedupe_key']).doNothing())
    .execute();
}

/** Balde diário para lembretes: no máximo 1 por gatilho a cada 24h. */
export const dayBucket = (now: Date): string => now.toISOString().slice(0, 10);

export async function listNotifications(
  db: Db,
  userId: string,
  limit = 50,
): Promise<{ items: NotificationDto[]; unread: number }> {
  const rows = await db
    .selectFrom('notifications')
    .selectAll()
    .where('user_id', '=', userId)
    .orderBy('created_at', 'desc')
    .limit(limit)
    .execute();

  const unreadRow = await db
    .selectFrom('notifications')
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('user_id', '=', userId)
    .where('read_at', 'is', null)
    .executeTakeFirstOrThrow();

  return {
    unread: Number(unreadRow.n),
    items: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      eventId: r.event_id,
      createdAt: r.created_at,
      readAt: r.read_at,
    })),
  };
}

export async function markNotificationsRead(
  db: Db,
  now: Date,
  userId: string,
  ids?: readonly string[],
): Promise<void> {
  let q = db
    .updateTable('notifications')
    .set({ read_at: now.toISOString() })
    .where('user_id', '=', userId)
    .where('read_at', 'is', null);
  if (ids) {
    if (ids.length === 0) return;
    q = q.where('id', 'in', ids);
  }
  await q.execute();
}

export async function setEventMuted(db: Db, userId: string, eventId: string, muted: boolean) {
  if (muted) {
    await db
      .insertInto('event_mutes')
      .values({ user_id: userId, event_id: eventId })
      .onConflict((oc) => oc.doNothing())
      .execute();
  } else {
    await db
      .deleteFrom('event_mutes')
      .where('user_id', '=', userId)
      .where('event_id', '=', eventId)
      .execute();
  }
}

export async function isEventMuted(db: Db, userId: string, eventId: string): Promise<boolean> {
  const row = await db
    .selectFrom('event_mutes')
    .select('user_id')
    .where('user_id', '=', userId)
    .where('event_id', '=', eventId)
    .executeTakeFirst();
  return !!row;
}
