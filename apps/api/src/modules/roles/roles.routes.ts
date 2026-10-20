import { roleActionSchema } from '@role/contracts';
import type { FastifyInstance } from 'fastify';
import { parse, requireUser } from '../../http';
import { claimRole, drawVacantRoles, releaseRole } from './roles.service';

export async function rolesRoutes(app: FastifyInstance) {
  const { ctx } = app;

  app.post<{ Params: { id: string } }>('/events/:id/roles/claim', async (req) => {
    const userId = await requireUser(req);
    await claimRole(ctx, userId, req.params.id, parse(roleActionSchema, req.body).role);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/events/:id/roles/release', async (req) => {
    const userId = await requireUser(req);
    await releaseRole(ctx, userId, req.params.id, parse(roleActionSchema, req.body).role);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/events/:id/roles/draw', async (req) => {
    const userId = await requireUser(req);
    return { assigned: await drawVacantRoles(ctx, userId, req.params.id) };
  });
}
