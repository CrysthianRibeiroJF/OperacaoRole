import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { ProfileDto } from '@role/contracts';
import type { AppContext } from '../../context';
import { AppError, notFound, unauthorized, unprocessable } from '../../errors';
import { newId } from '../../ids';

const OTP_TTL_MS = 10 * 60_000;
const OTP_MAX_REQUESTS_PER_WINDOW = 3;
const OTP_MAX_ATTEMPTS = 5;

const hashCode = (secret: string, phone: string, code: string) =>
  createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');

export async function requestOtp(ctx: AppContext, phone: string): Promise<{ devCode?: string }> {
  const now = ctx.clock.now();
  const windowStart = new Date(now.getTime() - OTP_TTL_MS).toISOString();

  const recent = await ctx.db
    .selectFrom('otp_codes')
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('phone', '=', phone)
    .where('created_at', '>', windowStart)
    .executeTakeFirstOrThrow();
  if (Number(recent.n) >= OTP_MAX_REQUESTS_PER_WINDOW) {
    throw new AppError(429, 'OTP_RATE_LIMIT', 'Muitos pedidos de código. Tente em alguns minutos.');
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  await ctx.otpSender.send(phone, code);
  await ctx.db
    .insertInto('otp_codes')
    .values({
      id: newId(),
      phone,
      code_hash: hashCode(ctx.config.SESSION_SECRET, phone, code),
      expires_at: new Date(now.getTime() + OTP_TTL_MS).toISOString(),
      attempts: 0,
      consumed_at: null,
      created_at: now.toISOString(),
    })
    .execute();

  return ctx.config.OTP_DEV_ECHO ? { devCode: code } : {};
}

export async function verifyOtp(
  ctx: AppContext,
  input: { phone: string; code: string; name?: string | undefined },
): Promise<ProfileDto> {
  const now = ctx.clock.now();

  const otp = await ctx.db
    .selectFrom('otp_codes')
    .selectAll()
    .where('phone', '=', input.phone)
    .where('consumed_at', 'is', null)
    .where('expires_at', '>', now.toISOString())
    .orderBy('created_at', 'desc')
    .executeTakeFirst();
  if (!otp) throw new AppError(401, 'INVALID_CODE', 'Código inválido ou expirado');
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    throw new AppError(429, 'OTP_LOCKED', 'Muitas tentativas. Peça um novo código.');
  }

  const expected = Buffer.from(otp.code_hash, 'hex');
  const actual = Buffer.from(hashCode(ctx.config.SESSION_SECRET, input.phone, input.code), 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    await ctx.db
      .updateTable('otp_codes')
      .set({ attempts: otp.attempts + 1 })
      .where('id', '=', otp.id)
      .execute();
    throw new AppError(401, 'INVALID_CODE', 'Código inválido ou expirado');
  }

  let user = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('phone', '=', input.phone)
    .executeTakeFirst();
  if (!user && !input.name) {
    // Não consome o código: o front pede o nome e reenvia o mesmo código.
    throw unprocessable('NAME_REQUIRED', 'Como podemos te chamar?');
  }

  await ctx.db
    .updateTable('otp_codes')
    .set({ consumed_at: now.toISOString() })
    .where('id', '=', otp.id)
    .execute();

  if (!user) {
    user = {
      id: newId(),
      phone: input.phone,
      name: input.name!,
      pix_key: null,
      created_at: now.toISOString(),
    };
    await ctx.db.insertInto('users').values(user).execute();
  }
  return toProfile(user);
}

export function toProfile(user: {
  id: string;
  name: string;
  phone: string;
  pix_key: string | null;
}): ProfileDto {
  return { id: user.id, name: user.name, phone: user.phone, pixKey: user.pix_key };
}

export async function getProfile(ctx: AppContext, userId: string): Promise<ProfileDto> {
  const user = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', userId)
    .executeTakeFirst();
  if (!user) throw unauthorized('Sessão inválida');
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
