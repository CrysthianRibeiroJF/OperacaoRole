import {
  otpRequestSchema,
  otpVerifySchema,
  updateProfileSchema,
  type OtpRequestResponse,
} from '@role/contracts';
import type { FastifyInstance } from 'fastify';
import { optionalUser, parse, requireUser, SESSION_COOKIE } from '../../http';
import { getProfile, requestOtp, updateProfile, verifyOtp } from './auth.service';

const THIRTY_DAYS_S = 30 * 24 * 3600;

export async function authRoutes(app: FastifyInstance) {
  const { ctx } = app;

  app.post(
    '/auth/otp/request',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (req): Promise<OtpRequestResponse> => {
      const { phone } = parse(otpRequestSchema, req.body);
      const { devCode } = await requestOtp(ctx, phone);
      return devCode ? { ok: true, devCode } : { ok: true };
    },
  );

  app.post(
    '/auth/otp/verify',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const input = parse(otpVerifySchema, req.body);
      const profile = await verifyOtp(ctx, input);
      const token = await reply.jwtSign({ sub: profile.id });
      reply.setCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: ctx.config.NODE_ENV === 'production',
        path: '/',
        maxAge: THIRTY_DAYS_S,
      });
      return profile;
    },
  );

  app.post('/auth/logout', async (_req, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/me', async (req) => getProfile(ctx, await requireUser(req)));

  app.patch('/me', async (req) => {
    const userId = await requireUser(req);
    return updateProfile(ctx, userId, parse(updateProfileSchema, req.body));
  });

  // Usado pelo front para saber, sem erro, se há sessão.
  app.get('/session', async (req) => {
    const userId = await optionalUser(req);
    return { profile: userId ? await getProfile(ctx, userId) : null };
  });
}
