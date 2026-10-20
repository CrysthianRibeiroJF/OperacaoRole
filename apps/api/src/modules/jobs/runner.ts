import type { AppContext } from '../../context';
import { expireDepositWindow, remindDeposit } from '../deposits/deposits.service';
import { expireEventIfNeeded } from '../events/event.service';
import { alertVacantRoles } from '../roles/roles.service';
import { remindDebtors } from '../settlement/settlement.service';
import type { JobKind } from './schedule';

const MAX_ATTEMPTS = 3;

async function handle(ctx: AppContext, kind: JobKind, payload: Record<string, unknown>, now: Date) {
  switch (kind) {
    case 'event.expire':
      return expireEventIfNeeded(ctx.db, now, String(payload.eventId));
    case 'deposit.expire':
      return expireDepositWindow(ctx.db, now, String(payload.eventId));
    case 'deposit.remind':
      return remindDeposit(ctx.db, now, String(payload.eventId), Number(payload.hours));
    case 'roles.vacant':
      return alertVacantRoles(ctx.db, now, String(payload.eventId));
    case 'settlement.remind':
      return remindDebtors(ctx.db, now, String(payload.settlementId));
  }
}

/**
 * Executa os jobs vencidos. Cada job é "reivindicado" com um UPDATE condicional, então duas
 * instâncias do servidor nunca rodam o mesmo job. Falhas voltam à fila com espera exponencial.
 */
export async function runDueJobs(ctx: AppContext, limit = 25): Promise<number> {
  const now = ctx.clock.now();
  const due = await ctx.db
    .selectFrom('jobs')
    .selectAll()
    .where('status', '=', 'pending')
    .where('run_at', '<=', now.toISOString())
    .orderBy('run_at')
    .limit(limit)
    .execute();

  let ran = 0;
  for (const job of due) {
    const claim = await ctx.db
      .updateTable('jobs')
      .set({ status: 'running', attempts: job.attempts + 1 })
      .where('id', '=', job.id)
      .where('status', '=', 'pending')
      .executeTakeFirst();
    if (Number(claim.numUpdatedRows) === 0) continue;

    try {
      await handle(
        ctx,
        job.kind as JobKind,
        JSON.parse(job.payload) as Record<string, unknown>,
        now,
      );
      await ctx.db
        .updateTable('jobs')
        .set({ status: 'done', finished_at: ctx.clock.now().toISOString(), last_error: null })
        .where('id', '=', job.id)
        .execute();
      ran++;
    } catch (err) {
      const attempts = job.attempts + 1;
      const message = err instanceof Error ? err.message : String(err);
      const retry = attempts < MAX_ATTEMPTS;
      await ctx.db
        .updateTable('jobs')
        .set({
          status: retry ? 'pending' : 'failed',
          last_error: message.slice(0, 500),
          run_at: retry
            ? new Date(now.getTime() + 2 ** attempts * 60_000).toISOString()
            : job.run_at,
          finished_at: retry ? null : ctx.clock.now().toISOString(),
        })
        .where('id', '=', job.id)
        .execute();
    }
  }
  return ran;
}

/**
 * Na partida, qualquer job "running" é órfão de uma queda anterior e volta para a fila.
 * Premissa do MVP: uma única instância do servidor. Com várias, adicione `started_at` e um
 * limite de tempo antes de reivindicar de volta.
 */
export async function recoverStuckJobs(ctx: AppContext): Promise<void> {
  await ctx.db
    .updateTable('jobs')
    .set({ status: 'pending' })
    .where('status', '=', 'running')
    .execute();
}

export function startJobRunner(
  ctx: AppContext,
  intervalMs = 30_000,
  onError: (err: unknown) => void = console.error,
): () => void {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await runDueJobs(ctx);
    } catch (err) {
      onError(err);
    } finally {
      busy = false;
    }
  };
  void recoverStuckJobs(ctx).catch(onError);
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
