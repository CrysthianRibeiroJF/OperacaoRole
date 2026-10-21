import type { FastifyInstance } from 'fastify';
import { requireUser } from '../../http';
import { getDepositPix, getTransferPix } from './pix.service';

export async function pixRoutes(app: FastifyInstance) {
  const { ctx } = app;

  app.get<{ Params: { id: string } }>('/transfers/:id/pix', async (req) =>
    getTransferPix(ctx, await requireUser(req), req.params.id),
  );

  app.get<{ Params: { id: string } }>('/events/:id/deposit/pix', async (req) =>
    getDepositPix(ctx, await requireUser(req), req.params.id),
  );
}
