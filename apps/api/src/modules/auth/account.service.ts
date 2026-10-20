import type { AccountExport } from '@role/contracts';
import type { AppContext } from '../../context';
import { conflict } from '../../errors';
import { audit } from '../../lib/audit';
import { getProfile } from './auth.service';

/** LGPD: tudo o que o app guarda sobre a pessoa, em formato legível por máquina. */
export async function exportAccount(ctx: AppContext, userId: string): Promise<AccountExport> {
  const profile = await getProfile(ctx, userId);

  const [parts, roles, expenses, notifications] = await Promise.all([
    ctx.db
      .selectFrom('participations')
      .innerJoin('events', 'events.id', 'participations.event_id')
      .select([
        'events.id as id',
        'events.title as title',
        'events.organizer_id as organizer_id',
        'participations.response as response',
      ])
      .where('participations.user_id', '=', userId)
      .execute(),
    ctx.db
      .selectFrom('event_roles')
      .select(['event_id', 'role'])
      .where('user_id', '=', userId)
      .execute(),
    ctx.db
      .selectFrom('expenses')
      .select(['event_id', 'description', 'amount_cents', 'status'])
      .where('paid_by', '=', userId)
      .execute(),
    ctx.db
      .selectFrom('notifications')
      .select(['title', 'body', 'created_at'])
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .limit(200)
      .execute(),
  ]);

  return {
    exportedAt: ctx.clock.now().toISOString(),
    profile,
    events: parts.map((p) => ({
      id: p.id,
      title: p.title,
      role:
        [
          p.organizer_id === userId ? 'Idealizador' : null,
          ...roles.filter((r) => r.event_id === p.id).map((r) => `General (${r.role})`),
        ]
          .filter(Boolean)
          .join(', ') || 'Participante',
      response: p.response,
    })),
    expensesPaid: expenses.map((e) => ({
      eventId: e.event_id,
      description: e.description,
      amountCents: e.amount_cents,
      status: e.status,
    })),
    notifications: notifications.map((n) => ({
      title: n.title,
      body: n.body,
      createdAt: n.created_at,
    })),
  };
}

/**
 * Exclui a conta por anonimização: nome, telefone e Pix somem, comprovantes são apagados, mas os
 * lançamentos financeiros dos grupos ficam (os outros participantes dependem deles para fechar a conta).
 * Só é permitido quando a pessoa não deixa obrigações em aberto.
 */
export async function deleteAccount(ctx: AppContext, userId: string): Promise<void> {
  const user = await getProfile(ctx, userId);

  const activeAsOrganizer = await ctx.db
    .selectFrom('events')
    .select('id')
    .where('organizer_id', '=', userId)
    .where('status', 'in', ['open', 'confirmed'])
    .executeTakeFirst();
  if (activeAsOrganizer) {
    throw conflict(
      'ACCOUNT_HAS_ACTIVE_EVENTS',
      'Você ainda organiza rolês em andamento. Cancele ou conclua antes de excluir a conta.',
    );
  }

  const confirmedIn = await ctx.db
    .selectFrom('participations')
    .innerJoin('events', 'events.id', 'participations.event_id')
    .select('events.id')
    .where('participations.user_id', '=', userId)
    .where('participations.response', '=', 'in')
    .where('events.status', '=', 'confirmed')
    .executeTakeFirst();
  if (confirmedIn) {
    throw conflict(
      'ACCOUNT_HAS_OBLIGATIONS',
      'Você está confirmado em um rolê em andamento. Saia dele (ou espere a conta fechar) antes de excluir a conta.',
    );
  }

  const openTransfer = await ctx.db
    .selectFrom('settlement_transfers')
    .select('id')
    .where('paid_at', 'is', null)
    .where((eb) => eb.or([eb('from_user', '=', userId), eb('to_user', '=', userId)]))
    .executeTakeFirst();
  if (openTransfer) {
    throw conflict(
      'ACCOUNT_HAS_OBLIGATIONS',
      'Há acertos de conta pendentes com você. Quite ou dê baixa antes de excluir a conta.',
    );
  }

  const now = ctx.clock.now();
  const proofs = await ctx.db
    .selectFrom('deposit_proofs')
    .select(['id', 'file_key'])
    .where('user_id', '=', userId)
    .execute();
  for (const p of proofs) await ctx.storage.remove(p.file_key).catch(() => undefined);

  await ctx.db.transaction().execute(async (trx) => {
    await trx.deleteFrom('deposit_proofs').where('user_id', '=', userId).execute();
    await trx.deleteFrom('notifications').where('user_id', '=', userId).execute();
    await trx.deleteFrom('event_mutes').where('user_id', '=', userId).execute();
    await trx.deleteFrom('login_attempts').where('phone', '=', user.phone).execute();
    await trx.deleteFrom('notification_prefs').where('user_id', '=', userId).execute();
    await trx
      .updateTable('user_sessions')
      .set({ revoked_at: now.toISOString() })
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .execute();
    await trx
      .updateTable('users')
      .set({
        name: 'Participante removido',
        phone: `deleted:${userId}`,
        pix_key: null,
        deleted_at: now.toISOString(),
      })
      .where('id', '=', userId)
      .execute();
    await audit(trx, now, {
      eventId: null,
      actorId: userId,
      action: 'account.deleted',
      entity: 'user',
      entityId: userId,
    });
  });
}
