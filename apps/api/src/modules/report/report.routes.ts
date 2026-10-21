import type { FastifyInstance } from 'fastify';
import { requireUser } from '../../http';
import { getCalendarFile, getMissionReport } from './report.service';

export async function reportRoutes(app: FastifyInstance) {
  const { ctx } = app;

  app.get<{ Params: { id: string } }>('/events/:id/report', async (req) =>
    getMissionReport(ctx, await requireUser(req), req.params.id),
  );

  app.get<{ Params: { id: string } }>('/events/:id/calendar.ics', async (req, reply) => {
    const file = await getCalendarFile(ctx, await requireUser(req), req.params.id);
    return reply
      .header('content-type', 'text/calendar; charset=utf-8')
      .header('content-disposition', `attachment; filename="${file.filename}"`)
      .header('cache-control', 'private, max-age=0')
      .send(file.body);
  });
}
