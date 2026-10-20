import {
  changePasswordSchema,
  loginSchema,
  recoverSchema,
  regenerateRecoverySchema,
  registerSchema,
  updateProfileSchema,
} from '@role/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { currentSessionId, optionalUser, parse, requireUser, SESSION_COOKIE } from '../../http';
import { describeDevice } from '../../lib/device';
import {
  changePassword,
  getProfile,
  login,
  recover,
  regenerateRecoveryCode,
  register,
  revokeOtherSessions,
  revokeSession,
  securityOverview,
  updateProfile,
} from './auth.service';

const THIRTY_DAYS_S = 30 * 24 * 3600;

export async function authRoutes(app: FastifyInstance) {
  const { ctx } = app;
  const authLimit = {
    config: { rateLimit: { max: ctx.config.AUTH_RATE_LIMIT_PER_MIN, timeWindow: '1 minute' } },
  };
  const device = (req: FastifyRequest) => describeDevice(req.headers['user-agent']);

  async function startSession(reply: FastifyReply, userId: string, sessionId: string) {
    const token = await reply.jwtSign({ sub: userId, sid: sessionId });
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: ctx.config.NODE_ENV === 'production',
      path: '/',
      maxAge: THIRTY_DAYS_S,
    });
  }

  app.post('/auth/register', authLimit, async (req, reply) => {
    const { sessionId, ...result } = await register(
      ctx,
      parse(registerSchema, req.body),
      device(req),
    );
    await startSession(reply, result.profile.id, sessionId);
    return reply.code(201).send(result);
  });

  app.post('/auth/login', authLimit, async (req, reply) => {
    const { sessionId, ...result } = await login(ctx, parse(loginSchema, req.body), device(req));
    await startSession(reply, result.profile.id, sessionId);
    return result;
  });

  app.post('/auth/recover', authLimit, async (req, reply) => {
    const { sessionId, ...result } = await recover(
      ctx,
      parse(recoverSchema, req.body),
      device(req),
    );
    await startSession(reply, result.profile.id, sessionId);
    return result;
  });

  app.post('/auth/logout', async (req, reply) => {
    try {
      const userId = await requireUser(req);
      await revokeSession(ctx, userId, currentSessionId(req));
    } catch {
      /* sem sessão válida: só limpa o cookie */
    }
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

  /* ----------------------------------- Segurança ----------------------------------- */

  app.get('/me/security', async (req) => {
    const userId = await requireUser(req);
    return securityOverview(ctx, userId, currentSessionId(req));
  });

  app.post('/me/password', authLimit, async (req) => {
    const userId = await requireUser(req);
    await changePassword(ctx, userId, currentSessionId(req), parse(changePasswordSchema, req.body));
    return { ok: true };
  });

  app.post('/me/recovery-code', authLimit, async (req) => {
    const userId = await requireUser(req);
    const { password } = parse(regenerateRecoverySchema, req.body);
    return { recoveryCode: await regenerateRecoveryCode(ctx, userId, password) };
  });

  app.post<{ Params: { id: string } }>('/me/sessions/:id/revoke', async (req) => {
    const userId = await requireUser(req);
    await revokeSession(ctx, userId, req.params.id);
    return { ok: true };
  });

  app.post('/me/sessions/revoke-others', async (req) => {
    const userId = await requireUser(req);
    await revokeOtherSessions(ctx, userId, currentSessionId(req));
    return { ok: true };
  });
}
