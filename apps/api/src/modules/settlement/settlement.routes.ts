import type { FastifyInstance } from 'fastify';
import { requireUser } from '../../http';
import {
  closeSettlement,
  confirmTransfer,
  getBlockers,
  getSettlement,
  getVault,
} from './settlement.service';

export async function settlementRoutes(app: FastifyInstance) {
  const { ctx } = app;

  app.get<{ Params: { id: string } }>('/events/:id/settlement', async (req) =>
    getSettlement(ctx, await requireUser(req), req.params.id),
  );

  app.get<{ Params: { id: string } }>('/events/:id/settlement/blockers', async (req) =>
    getBlockers(ctx, await requireUser(req), req.params.id),
  );

  app.post<{ Params: { id: string } }>('/events/:id/settlement/close', async (req) => {
    const userId = await requireUser(req);
    await closeSettlement(ctx, userId, req.params.id);
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>('/events/:id/vault', async (req) =>
    getVault(ctx, await requireUser(req), req.params.id),
  );

  app.post<{ Params: { id: string } }>('/transfers/:id/confirm', async (req) => {
    const userId = await requireUser(req);
    await confirmTransfer(ctx, userId, req.params.id);
    return { ok: true };
  });
}
