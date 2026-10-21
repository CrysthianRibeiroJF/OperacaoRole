import { createPollSchema, pollCloseSchema, pollVoteSchema } from '@role/contracts';
import type { FastifyInstance } from 'fastify';
import { optionalUser, parse, requireUser } from '../../http';
import { closePoll, createPoll, getPollByCode, listPolls, votePoll } from './polls.service';

export async function pollsRoutes(app: FastifyInstance) {
  const { ctx } = app;

  app.get('/polls', async (req) => listPolls(ctx, await requireUser(req)));

  app.post('/polls', async (req, reply) => {
    const userId = await requireUser(req);
    return reply.code(201).send(await createPoll(ctx, userId, parse(createPollSchema, req.body)));
  });

  // Público: o link da enquete abre sem login (modo leitura), como o convite.
  app.get<{ Params: { code: string } }>('/polls/:code', async (req) =>
    getPollByCode(ctx, req.params.code, await optionalUser(req)),
  );

  app.put<{ Params: { id: string } }>('/polls/:id/votes', async (req) => {
    const userId = await requireUser(req);
    return votePoll(ctx, userId, req.params.id, parse(pollVoteSchema, req.body).optionIds);
  });

  app.post<{ Params: { id: string } }>('/polls/:id/close', async (req) => {
    const userId = await requireUser(req);
    return closePoll(ctx, userId, req.params.id, parse(pollCloseSchema, req.body).optionId);
  });
}
