import type { Db } from '../context';
import { newId } from '../ids';

/** Trilha de auditoria (RN-41): quem fez o quê e quando, com dados mínimos para reconstituir. */
export async function audit(
  db: Db,
  now: Date,
  entry: {
    eventId: string | null;
    actorId: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    data?: Record<string, unknown>;
  },
): Promise<void> {
  await db
    .insertInto('audit_log')
    .values({
      id: newId(),
      event_id: entry.eventId,
      actor_id: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      data: entry.data ? JSON.stringify(entry.data) : null,
      created_at: now.toISOString(),
    })
    .execute();
}
