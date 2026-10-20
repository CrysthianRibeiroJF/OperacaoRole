import { depositConfigSchema, depositReviewSchema } from '@role/contracts';
import type { FastifyInstance } from 'fastify';
import { parse, readUpload, requireUser, sendFile } from '../../http';
import {
  configureDeposit,
  listDepositQueue,
  openProofFile,
  reviewDeposit,
  submitProof,
} from './deposits.service';
import { listRefunds, markRefunded } from './refunds.service';

export async function depositsRoutes(app: FastifyInstance) {
  const { ctx } = app;

  app.put<{ Params: { id: string } }>('/events/:id/deposit', async (req) => {
    const userId = await requireUser(req);
    return configureDeposit(ctx, userId, req.params.id, parse(depositConfigSchema, req.body));
  });

  app.post<{ Params: { id: string } }>('/events/:id/deposit/proof', async (req, reply) => {
    const userId = await requireUser(req);
    await submitProof(ctx, userId, req.params.id, await readUpload(req));
    return reply.code(201).send({ ok: true });
  });

  app.get<{ Params: { id: string } }>('/events/:id/deposits', async (req) =>
    listDepositQueue(ctx, await requireUser(req), req.params.id),
  );

  app.post<{ Params: { id: string; userId: string } }>(
    '/events/:id/deposits/:userId/review',
    async (req) => {
      const reviewerId = await requireUser(req);
      await reviewDeposit(
        ctx,
        reviewerId,
        req.params.id,
        req.params.userId,
        parse(depositReviewSchema, req.body),
      );
      return { ok: true };
    },
  );

  app.get<{ Params: { id: string; userId: string } }>(
    '/events/:id/deposits/:userId/proof',
    async (req, reply) => {
      const requesterId = await requireUser(req);
      return sendFile(
        reply,
        await openProofFile(ctx, requesterId, req.params.id, req.params.userId),
      );
    },
  );

  app.get<{ Params: { id: string } }>('/events/:id/refunds', async (req) =>
    listRefunds(ctx, await requireUser(req), req.params.id),
  );

  app.post<{ Params: { id: string; userId: string } }>(
    '/events/:id/refunds/:userId',
    async (req) => {
      await markRefunded(ctx, await requireUser(req), req.params.id, req.params.userId);
      return { ok: true };
    },
  );
}
