import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyJwt from '@fastify/jwt';
import fastifyMultipart from '@fastify/multipart';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
import { roomsRoutes } from './modules/rooms/rooms.routes';
import { settlementRoutes } from './modules/settlement/settlement.routes';
import { recordError } from './modules/telemetry/telemetry.service';
import { telemetryRoutes } from './modules/telemetry/telemetry.routes';

declare module 'fastify' {
  interface FastifyInstance {
    ctx: AppContext;
    /** Todas as rotas registradas (usado pelo teste que garante que nada privado ficou aberto). */
    routeTable: { method: string; url: string }[];
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
  app.decorate('routeTable', []);
  app.addHook('onRoute', (route) => {
    for (const method of [route.method].flat())
      app.routeTable.push({ method: String(method), url: route.url });
  });

  const production = ctx.config.NODE_ENV === 'production';
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // A previsão do tempo é chamada do navegador (D-021): só esses dois domínios saem do app.
        'connect-src': [
          "'self'",
          'https://geocoding-api.open-meteo.com',
          'https://api.open-meteo.com',
        ],
        'img-src': ["'self'", 'data:', 'blob:'],
        'worker-src': ["'self'"],
        'manifest-src': ["'self'"],
        'upgrade-insecure-requests': production ? [] : null,
      },
    },
  });
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
    void recordError(ctx.db, ctx.clock.now(), {
      source: 'server',
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      route: req.method + ' ' + (req.routeOptions?.url ?? req.url.split('?')[0]),
      userAgent: req.headers['user-agent'],
    });
    return reply
      .code(500)
      .send({ error: { code: 'INTERNAL', message: 'Algo deu errado. Tente novamente.' } });
  });

  // O app compilado é servido pela própria API (mesma origem para /api, /share e o PWA).
  const dist = ctx.config.WEB_DIST_DIR ?? (production ? '../web/dist' : undefined);
  const webRoot = dist ? resolve(dist) : null;
  const serveWeb = !!webRoot && existsSync(join(webRoot, 'index.html'));
  if (serveWeb && webRoot) {
    await app.register(fastifyStatic, {
      root: webRoot,
      wildcard: false,
      // O cabeçalho de cache é nosso (abaixo); o padrão do plugin sobrescreveria.
      cacheControl: false,
      setHeaders(res, filePath) {
        // Arquivos com hash no nome nunca mudam; o resto (index, service worker) precisa revalidar.
        res.setHeader(
          'cache-control',
          /[\\/]assets[\\/]/.test(filePath) ? 'public, max-age=31536000, immutable' : 'no-cache',
        );
      },
    });
  }

  app.setNotFoundHandler((req, reply) => {
    const wantsPage =
      serveWeb &&
      req.method === 'GET' &&
      !req.url.startsWith('/api') &&
      !req.url.startsWith('/share') &&
      (req.headers.accept ?? '').includes('text/html');
    // Rotas do app (/c/CODIGO, /role/ID...) são do React Router: devolve o index.html.
    if (wantsPage) return reply.header('cache-control', 'no-cache').sendFile('index.html');
    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada' } });
  });

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
      await api.register(roomsRoutes);
      await api.register(accountRoutes);
      await api.register(telemetryRoutes);
    },
    { prefix: '/api' },
  );

  // Fora de /api: o link compartilhado no WhatsApp precisa de metadados Open Graph.
  await app.register(shareRoutes);

  return app;
}
