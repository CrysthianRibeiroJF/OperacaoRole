import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyJwt from '@fastify/jwt';
import fastifyMultipart from '@fastify/multipart';
import fastifyRateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import type { AppContext } from './context';
import { AppError } from './errors';
import { SESSION_COOKIE } from './http';
import { MAX_UPLOAD_BYTES } from './lib/sniff';
import { accountRoutes } from './modules/auth/account.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { depositsRoutes } from './modules/deposits/deposits.routes';
import { eventRoutes } from './modules/events/event.routes';
import { fleetRoutes } from './modules/fleet/fleet.routes';
import { shareRoutes } from './modules/events/share.routes';
import { suppliesRoutes } from './modules/supplies/supplies.routes';
import { expensesRoutes } from './modules/expenses/expenses.routes';
import { notificationsRoutes } from './modules/notifications/notifications.routes';
import { rolesRoutes } from './modules/roles/roles.routes';
import { settlementRoutes } from './modules/settlement/settlement.routes';

declare module 'fastify' {
  interface FastifyInstance {
    ctx: AppContext;
  }
}

export async function buildApp(
  ctx: AppContext,
  opts: { logger?: boolean } = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger
      ? { redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'] }
      : false,
    trustProxy: ctx.config.NODE_ENV === 'production',
  });
  app.decorate('ctx', ctx);

  await app.register(fastifyHelmet);
  await app.register(fastifyCookie);
  await app.register(fastifyJwt, {
    secret: ctx.config.SESSION_SECRET,
    cookie: { cookieName: SESSION_COOKIE, signed: false },
    sign: { expiresIn: '30d' },
  });
  // Nos testes o IP é sempre o mesmo; o bloqueio por tentativas erradas é regra de negócio e tem teste próprio.
  if (ctx.config.NODE_ENV !== 'test') {
    await app.register(fastifyRateLimit, { global: true, max: 300, timeWindow: '1 minute' });
  }
  await app.register(fastifyMultipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply
        .code(err.status)
        .send({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION',
          message: err.issues[0]?.message ?? 'Dados inválidos',
          details: err.issues,
        },
      });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 429) {
      return reply.code(429).send({
        error: { code: 'RATE_LIMIT', message: 'Muitas requisições. Aguarde um instante.' },
      });
    }
    if ((err as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
      return reply
        .code(413)
        .send({ error: { code: 'FILE_TOO_LARGE', message: 'O arquivo passa de 5 MB' } });
    }
    if (status && status >= 400 && status < 500) {
      return reply
        .code(status)
        .send({ error: { code: 'BAD_REQUEST', message: 'Requisição inválida' } });
    }
    req.log.error({ err }, 'erro não tratado');
    return reply
      .code(500)
      .send({ error: { code: 'INTERNAL', message: 'Algo deu errado. Tente novamente.' } });
  });

  app.setNotFoundHandler((_req, reply) =>
    reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada' } }),
  );

  await app.register(
    async (api) => {
      api.get('/health', async () => ({ ok: true }));
      await api.register(authRoutes);
      await api.register(eventRoutes);
      await api.register(rolesRoutes);
      await api.register(depositsRoutes);
      await api.register(expensesRoutes);
      await api.register(settlementRoutes);
      await api.register(notificationsRoutes);
      await api.register(suppliesRoutes);
      await api.register(fleetRoutes);
      await api.register(accountRoutes);
    },
    { prefix: '/api' },
  );

  // Fora de /api: o link compartilhado no WhatsApp precisa de metadados Open Graph.
  await app.register(shareRoutes);

  return app;
}
