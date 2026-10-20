import type { AuthResult, ProfileDto, SecurityOverview, SessionDto } from '@role/contracts';
import type { AppContext, Db } from '../../context';
import { AppError, conflict, notFound, unauthorized } from '../../errors';
import { newId } from '../../ids';
import { audit } from '../../lib/audit';
import {
  burnPasswordTime,
  generateRecoveryCode,
  hashPassword,
  hashRecoveryCode,
  recoveryCodeMatches,
  verifyPassword,
} from '../../lib/credentials';

/* -------------------------------------------------------------------------------------------- */
/* Tentativas e bloqueio                                                                         */
/* -------------------------------------------------------------------------------------------- */

const MAX_FAILURES = 5;
const LOCK_WINDOW_MS = 15 * 60_000;

type AttemptKind = 'login' | 'recover';

/** Bloqueia por celular depois de 5 erros em 15 minutos (vale também para o código de recuperação). */
async function assertNotLocked(db: Db, phone: string, now: Date) {
  const since = new Date(now.getTime() - LOCK_WINDOW_MS).toISOString();
  const failures = await db
    .selectFrom('login_attempts')
    .select('created_at')
    .where('phone', '=', phone)
    .where('success', '=', 0)
    .where('created_at', '>', since)
    .orderBy('created_at')
    .execute();
  if (failures.length >= MAX_FAILURES) {
    const unlocksAt = new Date(failures[0]!.created_at).getTime() + LOCK_WINDOW_MS;
    const minutes = Math.max(1, Math.ceil((unlocksAt - now.getTime()) / 60_000));
    throw new AppError(
      429,
      'LOGIN_LOCKED',
      `Muitas tentativas erradas. Tente de novo em ${minutes} min.`,
    );
  }
}

async function recordAttempt(
  db: Db,
  phone: string,
  kind: AttemptKind,
  success: boolean,
  now: Date,
) {
  await db
    .insertInto('login_attempts')
    .values({ id: newId(), phone, kind, success: success ? 1 : 0, created_at: now.toISOString() })
    .execute();
  if (success) {
    await db
      .deleteFrom('login_attempts')
      .where('phone', '=', phone)
      .where('success', '=', 0)
      .execute();
  }
}

/* -------------------------------------------------------------------------------------------- */
/* Sessões                                                                                       */
/* -------------------------------------------------------------------------------------------- */

export async function createSession(
  db: Db,
  userId: string,
  device: string,
  now: Date,
): Promise<string> {
  const id = newId();
  await db
    .insertInto('user_sessions')
    .values({
      id,
      user_id: userId,
      device,
      created_at: now.toISOString(),
      last_seen_at: now.toISOString(),
      revoked_at: null,
    })
    .execute();
  return id;
}

export async function listSessions(
  ctx: AppContext,
  userId: string,
  currentSessionId: string,
): Promise<SessionDto[]> {
  const rows = await ctx.db
    .selectFrom('user_sessions')
    .selectAll()
    .where('user_id', '=', userId)
    .where('revoked_at', 'is', null)
    .orderBy('last_seen_at', 'desc')
    .execute();
  return rows.map((r) => ({
    id: r.id,
    device: r.device,
    createdAt: r.created_at,
    lastSeenAt: r.last_seen_at,
    current: r.id === currentSessionId,
  }));
}

export async function revokeSession(
  ctx: AppContext,
  userId: string,
  sessionId: string,
): Promise<void> {
  const res = await ctx.db
    .updateTable('user_sessions')
    .set({ revoked_at: ctx.clock.now().toISOString() })
    .where('id', '=', sessionId)
    .where('user_id', '=', userId)
    .where('revoked_at', 'is', null)
    .executeTakeFirst();
  if (Number(res.numUpdatedRows) === 0) throw notFound('Acesso não encontrado');
}

export async function revokeOtherSessions(
  ctx: AppContext,
  userId: string,
  keepSessionId: string,
): Promise<void> {
  await ctx.db
    .updateTable('user_sessions')
    .set({ revoked_at: ctx.clock.now().toISOString() })
    .where('user_id', '=', userId)
    .where('id', '!=', keepSessionId)
    .where('revoked_at', 'is', null)
    .execute();
}

/* -------------------------------------------------------------------------------------------- */
/* Cadastro, entrada e recuperação                                                               */
/* -------------------------------------------------------------------------------------------- */

export function toProfile(user: {
  id: string;
  name: string;
  phone: string;
  pix_key: string | null;
}): ProfileDto {
  return { id: user.id, name: user.name, phone: user.phone, pixKey: user.pix_key };
}

export async function register(
  ctx: AppContext,
  input: { phone: string; name: string; password: string },
  device: string,
): Promise<AuthResult & { sessionId: string }> {
  const now = ctx.clock.now();
  const exists = await ctx.db
    .selectFrom('users')
    .select('id')
    .where('phone', '=', input.phone)
    .executeTakeFirst();
  if (exists) {
    throw conflict(
      'PHONE_TAKEN',
      'Esse celular já tem conta. Entre com a senha ou recupere o acesso.',
    );
  }

  const id = newId();
  const recoveryCode = generateRecoveryCode();
  const [passwordHash] = await Promise.all([hashPassword(input.password)]);
  await ctx.db
    .insertInto('users')
    .values({
      id,
      phone: input.phone,
      name: input.name,
      pix_key: null,
      created_at: now.toISOString(),
      deleted_at: null,
      password_hash: passwordHash,
      password_changed_at: now.toISOString(),
      recovery_hash: hashRecoveryCode(ctx.config.SESSION_SECRET, recoveryCode),
      recovery_created_at: now.toISOString(),
    })
    .execute();
  const sessionId = await createSession(ctx.db, id, device, now);
  await audit(ctx.db, now, {
    eventId: null,
    actorId: id,
    action: 'account.registered',
    entity: 'user',
    entityId: id,
  });
  return {
    profile: toProfile({ id, name: input.name, phone: input.phone, pix_key: null }),
    recoveryCode,
    sessionId,
  };
}

export async function login(
  ctx: AppContext,
  input: { phone: string; password: string },
  device: string,
): Promise<AuthResult & { sessionId: string }> {
  const now = ctx.clock.now();
  await assertNotLocked(ctx.db, input.phone, now);

  const user = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('phone', '=', input.phone)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  let ok = false;
  if (user?.password_hash) ok = await verifyPassword(input.password, user.password_hash);
  else await burnPasswordTime(input.password);

  await recordAttempt(ctx.db, input.phone, 'login', ok, now);
  if (!ok || !user) throw new AppError(401, 'INVALID_CREDENTIALS', 'Celular ou senha incorretos.');

  const sessionId = await createSession(ctx.db, user.id, device, now);
  return { profile: toProfile(user), sessionId };
}

/** Recuperação sem canal externo: o código guardado no cadastro prova que é a mesma pessoa. */
export async function recover(
  ctx: AppContext,
  input: { phone: string; recoveryCode: string; newPassword: string },
  device: string,
): Promise<AuthResult & { sessionId: string }> {
  const now = ctx.clock.now();
  await assertNotLocked(ctx.db, input.phone, now);

  const user = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('phone', '=', input.phone)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();
  const ok =
    !!user?.recovery_hash &&
    recoveryCodeMatches(ctx.config.SESSION_SECRET, input.recoveryCode, user.recovery_hash);

  await recordAttempt(ctx.db, input.phone, 'recover', ok, now);
  if (!ok || !user)
    throw new AppError(401, 'INVALID_RECOVERY', 'Celular ou código de recuperação incorretos.');

  const recoveryCode = generateRecoveryCode();
  const passwordHash = await hashPassword(input.newPassword);
  await ctx.db.transaction().execute(async (trx) => {
    await trx
      .updateTable('users')
      .set({
        password_hash: passwordHash,
        password_changed_at: now.toISOString(),
        // O código usado queima: nasce um novo, mostrado agora.
        recovery_hash: hashRecoveryCode(ctx.config.SESSION_SECRET, recoveryCode),
        recovery_created_at: now.toISOString(),
      })
      .where('id', '=', user.id)
      .execute();
    await trx
      .updateTable('user_sessions')
      .set({ revoked_at: now.toISOString() })
      .where('user_id', '=', user.id)
      .where('revoked_at', 'is', null)
      .execute();
    await audit(trx, now, {
      eventId: null,
      actorId: user.id,
      action: 'account.recovered',
      entity: 'user',
      entityId: user.id,
    });
  });
  const sessionId = await createSession(ctx.db, user.id, device, now);
  return { profile: toProfile(user), recoveryCode, sessionId };
}

async function requirePassword(ctx: AppContext, userId: string, password: string) {
  const user = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', userId)
    .executeTakeFirst();
  if (!user) throw unauthorized();
  await assertNotLocked(ctx.db, user.phone, ctx.clock.now());
  const ok = !!user.password_hash && (await verifyPassword(password, user.password_hash));
  await recordAttempt(ctx.db, user.phone, 'login', ok, ctx.clock.now());
  if (!ok) throw new AppError(403, 'WRONG_PASSWORD', 'A senha informada está incorreta.');
  return user;
}

export async function changePassword(
  ctx: AppContext,
  userId: string,
  currentSessionId: string,
  input: { currentPassword: string; newPassword: string },
): Promise<void> {
  const now = ctx.clock.now();
  await requirePassword(ctx, userId, input.currentPassword);
  const hash = await hashPassword(input.newPassword);
  await ctx.db
    .updateTable('users')
    .set({ password_hash: hash, password_changed_at: now.toISOString() })
    .where('id', '=', userId)
    .execute();
  // Trocou a senha: todo outro aparelho precisa entrar de novo.
  await revokeOtherSessions(ctx, userId, currentSessionId);
  await audit(ctx.db, now, {
    eventId: null,
    actorId: userId,
    action: 'account.password_changed',
    entity: 'user',
    entityId: userId,
  });
}

export async function regenerateRecoveryCode(
  ctx: AppContext,
  userId: string,
  password: string,
): Promise<string> {
  const now = ctx.clock.now();
  await requirePassword(ctx, userId, password);
  const code = generateRecoveryCode();
  await ctx.db
    .updateTable('users')
    .set({
      recovery_hash: hashRecoveryCode(ctx.config.SESSION_SECRET, code),
      recovery_created_at: now.toISOString(),
    })
    .where('id', '=', userId)
    .execute();
  await audit(ctx.db, now, {
    eventId: null,
    actorId: userId,
    action: 'account.recovery_regenerated',
    entity: 'user',
    entityId: userId,
  });
  return code;
}

export async function securityOverview(
  ctx: AppContext,
  userId: string,
  currentSessionId: string,
): Promise<SecurityOverview> {
  const user = await ctx.db
    .selectFrom('users')
    .select(['password_changed_at', 'recovery_created_at'])
    .where('id', '=', userId)
    .executeTakeFirst();
  if (!user) throw unauthorized();
  return {
    sessions: await listSessions(ctx, userId, currentSessionId),
    passwordChangedAt: user.password_changed_at,
    recoveryCodeCreatedAt: user.recovery_created_at,
  };
}

/* -------------------------------------------------------------------------------------------- */
/* Perfil                                                                                        */
/* -------------------------------------------------------------------------------------------- */

export async function getProfile(ctx: AppContext, userId: string): Promise<ProfileDto> {
  const user = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', userId)
    .executeTakeFirst();
  if (!user || user.deleted_at) throw unauthorized('Sessão inválida');
  return toProfile(user);
}

export async function updateProfile(
  ctx: AppContext,
  userId: string,
  patch: { name?: string | undefined; pixKey?: string | null | undefined },
): Promise<ProfileDto> {
  const set: { name?: string; pix_key?: string | null } = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.pixKey !== undefined) set.pix_key = patch.pixKey || null;
  if (Object.keys(set).length > 0) {
    const res = await ctx.db
      .updateTable('users')
      .set(set)
      .where('id', '=', userId)
      .executeTakeFirst();
    if (Number(res.numUpdatedRows) === 0) throw notFound('Usuário não encontrado');
  }
  return getProfile(ctx, userId);
}
