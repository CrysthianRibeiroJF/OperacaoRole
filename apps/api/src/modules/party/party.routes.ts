import { partyRulesSchema, setCompanionsSchema } from '@role/contracts';
import type { FastifyInstance } from 'fastify';
import { parse, requireUser } from '../../http';
import { getParty, setCompanions, setPartyRules } from './party.service';

export async function partyRoutes(app: FastifyInstance) {
  const { ctx } = app;

  app.get<{ Params: { id: string } }>('/events/:id/party', async (req) =>
    getParty(ctx, await requireUser(req), req.params.id),
  );

  app.put<{ Params: { id: string } }>('/events/:id/companions', async (req) => {
    const userId = await requireUser(req);
    return setCompanions(
      ctx,
      userId,
      req.params.id,
      parse(setCompanionsSchema, req.body).companions,
    );
  });

  app.put<{ Params: { id: string } }>('/events/:id/party-rules', async (req) => {
    const userId = await requireUser(req);
    return setPartyRules(ctx, userId, req.params.id, parse(partyRulesSchema, req.body));
  });
}
