import { assignPassengerSchema, crewSchema, inviteCrewSchema } from '@role/contracts';
import type { FastifyInstance } from 'fastify';
import { optionalUser, parse, requireUser } from '../../http';
import {
  createCrew,
  deleteCrew,
  inviteCrewToEvent,
  joinCrew,
  leaveCrew,
  listCrews,
  previewCrew,
  removeCrewMember,
} from './crews.service';

export async function crewsRoutes(app: FastifyInstance) {
  const { ctx } = app;

  app.get('/crews', async (req) => listCrews(ctx, await requireUser(req)));

  app.post('/crews', async (req, reply) => {
    const userId = await requireUser(req);
    return reply.code(201).send(await createCrew(ctx, userId, parse(crewSchema, req.body).name));
  });

  // Público: a prévia do link mostra só o nome, o dono e quantas pessoas já entraram.
  app.get<{ Params: { code: string } }>('/crews/code/:code', async (req) =>
    previewCrew(ctx, req.params.code, await optionalUser(req)),
  );

  app.post<{ Params: { code: string } }>('/crews/code/:code/join', async (req) =>
    joinCrew(ctx, await requireUser(req), req.params.code),
  );

  app.post<{ Params: { id: string } }>('/crews/:id/leave', async (req) => {
    await leaveCrew(ctx, await requireUser(req), req.params.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/crews/:id/remove', async (req) => {
    const userId = await requireUser(req);
    await removeCrewMember(
      ctx,
      userId,
      req.params.id,
      parse(assignPassengerSchema, req.body).userId,
    );
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>('/crews/:id', async (req) => {
    await deleteCrew(ctx, await requireUser(req), req.params.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/events/:id/invite-crew', async (req) => {
    const userId = await requireUser(req);
    return inviteCrewToEvent(ctx, userId, req.params.id, parse(inviteCrewSchema, req.body).crewId);
  });
}
