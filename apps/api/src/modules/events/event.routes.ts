import {
  baseInfoSchema,
  createEventSchema,
  preferencesSchema,
  respondSchema,
} from '@role/contracts';
import type { FastifyInstance } from 'fastify';
import { optionalUser, parse, requireUser } from '../../http';
import {
  cancelEvent,
  createEvent,
  getEventDetail,
  getInvite,
  listFeed,
  respond,
  setPreferences,
  updateBase,
} from './event.service';

export async function eventRoutes(app: FastifyInstance) {
  const { ctx } = app;

  app.post('/events', async (req, reply) => {
    const userId = await requireUser(req);
    const card = await createEvent(ctx, userId, parse(createEventSchema, req.body));
    return reply.code(201).send(card);
  });

  app.get('/events', async (req) => listFeed(ctx, await requireUser(req)));

  // Público: o convite abre sem login (modo Observador).
  app.get<{ Params: { code: string } }>('/invites/:code', async (req) =>
    getInvite(ctx, req.params.code, await optionalUser(req)),
  );

  app.get<{ Params: { id: string } }>('/events/:id', async (req) =>
    getEventDetail(ctx, await requireUser(req), req.params.id),
  );

  app.post<{ Params: { id: string } }>('/events/:id/respond', async (req) => {
    const userId = await requireUser(req);
    return respond(ctx, userId, req.params.id, parse(respondSchema, req.body));
  });

  app.put<{ Params: { id: string } }>('/events/:id/preferences', async (req) => {
    const userId = await requireUser(req);
    await setPreferences(ctx, userId, req.params.id, parse(preferencesSchema, req.body));
    return { ok: true };
  });

  app.put<{ Params: { id: string } }>('/events/:id/base', async (req) => {
    const userId = await requireUser(req);
    return updateBase(ctx, userId, req.params.id, parse(baseInfoSchema, req.body));
  });

  app.post<{ Params: { id: string } }>('/events/:id/cancel', async (req) => {
    const userId = await requireUser(req);
    await cancelEvent(ctx, userId, req.params.id);
    return { ok: true };
  });
}
