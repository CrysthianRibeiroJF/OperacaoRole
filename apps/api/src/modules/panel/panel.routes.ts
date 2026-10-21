import type { FastifyInstance } from 'fastify';
import { requireUser } from '../../http';
import { getPanel } from './panel.service';

export async function panelRoutes(app: FastifyInstance) {
  const { ctx } = app;

  app.get<{ Params: { id: string } }>('/events/:id/panel', async (req) =>
    getPanel(ctx, await requireUser(req), req.params.id),
  );
}
