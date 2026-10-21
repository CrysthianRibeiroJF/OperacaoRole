import type { MutedEventDto, NotificationDto, NotificationPrefsDto } from '@role/contracts';
import { categoryOfKind, NOTIFICATION_CATEGORIES, type NotificationCategory } from '@role/domain';
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
  /** Rota do app para onde o aviso leva (ex.: /enquete/ABC). Sem ela, abre o QG do rolê. */
  link?: string;
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
  // Preferência por categoria (central da conta): quem desligou a categoria não recebe.
  const category = categoryOfKind(input.kind);
  if (category && recipients.length > 0) {
    const off = await db
      .selectFrom('notification_prefs')
      .select('user_id')
      .where('category', '=', category)
      .where('enabled', '=', 0)
      .where('user_id', 'in', recipients)
      .execute();
    const offIds = new Set(off.map((o) => o.user_id));
    recipients = recipients.filter((id) => !offIds.has(id));
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
        link: input.link ?? null,
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
      link: r.link,
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

/** Todas as categorias ligadas por padrão; só o que a pessoa desligou fica registrado. */
export async function getNotificationPrefs(db: Db, userId: string): Promise<NotificationPrefsDto> {
  const rows = await db
    .selectFrom('notification_prefs')
    .selectAll()
    .where('user_id', '=', userId)
    .execute();
  const categories = Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c, true])) as Record<
    NotificationCategory,
    boolean
  >;
  for (const r of rows) {
    if ((NOTIFICATION_CATEGORIES as readonly string[]).includes(r.category)) {
      categories[r.category as NotificationCategory] = r.enabled === 1;
    }
  }
  return { categories };
}

export async function setNotificationPrefs(
  db: Db,
  userId: string,
  categories: Partial<Record<NotificationCategory, boolean>>,
): Promise<NotificationPrefsDto> {
  for (const [category, enabled] of Object.entries(categories)) {
    await db
      .insertInto('notification_prefs')
      .values({ user_id: userId, category, enabled: enabled ? 1 : 0 })
      .onConflict((oc) =>
        oc.columns(['user_id', 'category']).doUpdateSet({ enabled: enabled ? 1 : 0 }),
      )
      .execute();
  }
  return getNotificationPrefs(db, userId);
}

export async function listMutedEvents(db: Db, userId: string): Promise<MutedEventDto[]> {
  const rows = await db
    .selectFrom('event_mutes')
    .innerJoin('events', 'events.id', 'event_mutes.event_id')
    .select(['events.id as id', 'events.code as code', 'events.title as title'])
    .where('event_mutes.user_id', '=', userId)
    .orderBy('events.created_at', 'desc')
    .execute();
  return rows;
}
