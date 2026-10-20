import { deleteAccountSchema } from '@role/contracts';
import type { FastifyInstance } from 'fastify';
import { parse, requireUser, SESSION_COOKIE } from '../../http';
import { deleteAccount, exportAccount } from './account.service';

export async function accountRoutes(app: FastifyInstance) {
  const { ctx } = app;

  app.get('/me/export', async (req, reply) => {
    const data = await exportAccount(ctx, await requireUser(req));
    return reply
      .header('content-disposition', 'attachment; filename="meus-dados-operacao-role.json"')
      .send(data);
  });

  app.post('/me/delete', async (req, reply) => {
    const userId = await requireUser(req);
    parse(deleteAccountSchema, req.body);
    await deleteAccount(ctx, userId);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });
}
