import { FILE_RETENTION_DAYS } from '@role/domain';
import type { AppContext, Db } from '../../context';
import { audit } from '../../lib/audit';
import { scheduleJob } from '../jobs/schedule';
import { requireEvent } from './event.queries';

const DAY_MS = 86_400_000;

/** Agenda a limpeza de comprovantes e notas para daqui a 90 dias do fim do rolê (LGPD: minimização). */
export async function scheduleFilePurge(db: Db, now: Date, eventId: string): Promise<void> {
  await scheduleJob(db, now, {
    kind: 'files.purge',
    runAt: new Date(now.getTime() + FILE_RETENTION_DAYS * DAY_MS),
    payload: { eventId },
    dedupeKey: `files.purge:${eventId}`,
  });
}

/**
 * Apaga os arquivos do rolê (comprovantes de sinal e fotos de nota) depois do prazo de retenção.
 * Os valores e a trilha de auditoria ficam: só a imagem some. Revalida o estado ao rodar.
 */
export async function purgeEventFiles(ctx: AppContext, now: Date, eventId: string): Promise<void> {
  const event = await requireEvent(ctx.db, eventId);
  const endedAt = event.closed_at ?? event.cancelled_at;
  if ((event.status !== 'closed' && event.status !== 'cancelled') || !endedAt) return;
  if (now.getTime() < new Date(endedAt).getTime() + FILE_RETENTION_DAYS * DAY_MS) return;

  const proofs = await ctx.db
    .selectFrom('deposit_proofs')
    .select(['id', 'file_key'])
    .where('event_id', '=', eventId)
    .execute();
  const receipts = await ctx.db
    .selectFrom('expenses')
    .select(['id', 'receipt_key'])
    .where('event_id', '=', eventId)
    .where('receipt_key', 'is not', null)
    .execute();
  if (proofs.length === 0 && receipts.length === 0) return;

  for (const p of proofs) await ctx.storage.remove(p.file_key).catch(() => undefined);
  for (const r of receipts)
    if (r.receipt_key) await ctx.storage.remove(r.receipt_key).catch(() => undefined);

  await ctx.db.transaction().execute(async (trx) => {
    await trx.deleteFrom('deposit_proofs').where('event_id', '=', eventId).execute();
    await trx
      .updateTable('expenses')
      .set({ receipt_key: null, receipt_mime: null })
      .where('event_id', '=', eventId)
      .execute();
    await audit(trx, now, {
      eventId,
      actorId: null,
      action: 'files.purged',
      entity: 'event',
      entityId: eventId,
      data: { proofs: proofs.length, receipts: receipts.length },
    });
  });
}
