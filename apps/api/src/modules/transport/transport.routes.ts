import { ridePlanSchema, stopSchema, stopUpdateSchema } from '@role/contracts';
import type { FastifyInstance } from 'fastify';
import { parse, requireUser } from '../../http';
import { createStop, deleteStop, getTransport, setRidePlan, updateStop } from './transport.service';

export async function transportRoutes(app: FastifyInstance) {
  const { ctx } = app;

  app.get<{ Params: { id: string } }>('/events/:id/transport', async (req) =>
    getTransport(ctx, await requireUser(req), req.params.id),
  );

  app.post<{ Params: { id: string } }>('/events/:id/stops', async (req, reply) => {
    const userId = await requireUser(req);
    const stop = await createStop(ctx, userId, req.params.id, parse(stopSchema, req.body));
    return reply.code(201).send(stop);
  });

  app.patch<{ Params: { id: string } }>('/stops/:id', async (req) => {
    const userId = await requireUser(req);
    return updateStop(ctx, userId, req.params.id, parse(stopUpdateSchema, req.body));
  });

  app.delete<{ Params: { id: string } }>('/stops/:id', async (req) => {
    await deleteStop(ctx, await requireUser(req), req.params.id);
    return { ok: true };
  });

  app.put<{ Params: { id: string } }>('/events/:id/ride-plan', async (req) => {
    const userId = await requireUser(req);
    await setRidePlan(ctx, userId, req.params.id, parse(ridePlanSchema, req.body));
    return { ok: true };
  });
}
