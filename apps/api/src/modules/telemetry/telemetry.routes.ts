import { clientErrorSchema, trackEventSchema } from '@role/contracts';
import type { FastifyInstance } from 'fastify';
import { optionalUser, parse } from '../../http';
import { recordError, recordEvent } from './telemetry.service';

const limit = { config: { rateLimit: { max: 40, timeWindow: '1 minute' } } };

/** Públicas de propósito: o app precisa reportar erro até quando a sessão caiu. Entrada pequena e limitada. */
export async function telemetryRoutes(app: FastifyInstance) {
  const { ctx } = app;

  app.post('/telemetry/error', limit, async (req, reply) => {
    const body = parse(clientErrorSchema, req.body);
    await recordError(ctx.db, ctx.clock.now(), {
      source: 'client',
      message: body.message,
      stack: body.stack,
      route: body.path,
      userId: await optionalUser(req),
      userAgent: req.headers['user-agent'],
    });
    return reply.code(204).send();
  });

  app.post('/telemetry/track', limit, async (req, reply) => {
    const body = parse(trackEventSchema, req.body);
    await recordEvent(ctx.db, ctx.clock.now(), {
      name: body.name,
      path: body.path,
      userId: await optionalUser(req),
    });
    return reply.code(204).send();
  });
}
