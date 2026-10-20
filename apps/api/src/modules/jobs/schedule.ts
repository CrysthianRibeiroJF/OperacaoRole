import type { Db } from '../../context';
import { newId } from '../../ids';

export type JobKind =
  | 'event.expire'
  | 'deposit.expire'
  | 'deposit.remind'
  | 'roles.vacant'
  | 'settlement.remind'
  | 'files.purge';

/**
 * Agenda um job no banco (sobrevive a reinícios). A `dedupeKey` torna o agendamento idempotente:
 * reagendar o mesmo gatilho não cria duplicatas. Os handlers revalidam o estado ao executar,
 * então jobs "velhos" (prazo alterado, rolê cancelado) viram no-ops.
 */
export async function scheduleJob(
  db: Db,
  now: Date,
  job: { kind: JobKind; runAt: Date; payload: Record<string, unknown>; dedupeKey: string },
): Promise<void> {
  await db
    .insertInto('jobs')
    .values({
      id: newId(),
      kind: job.kind,
      run_at: job.runAt.toISOString(),
      payload: JSON.stringify(job.payload),
      status: 'pending',
      attempts: 0,
      last_error: null,
      dedupe_key: job.dedupeKey,
      created_at: now.toISOString(),
      finished_at: null,
    })
    .onConflict((oc) => oc.column('dedupe_key').doNothing())
    .execute();
}
