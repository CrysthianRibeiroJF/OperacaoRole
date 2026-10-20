import { supplyCreateSchema, supplyDoneSchema, supplyUpdateSchema } from '@role/contracts';
import type { FastifyInstance } from 'fastify';
import { parse, requireUser } from '../../http';
import {
  claimSupply,
  createSupply,
  deleteSupply,
  listSupplies,
  markSupplyDone,
  suggestSupplyList,
  unclaimSupply,
  undoSupplyDone,
  updateSupply,
} from './supplies.service';

export async function suppliesRoutes(app: FastifyInstance) {
  const { ctx } = app;

  app.get<{ Params: { id: string } }>('/events/:id/supplies', async (req) =>
    listSupplies(ctx, await requireUser(req), req.params.id),
  );

  app.post<{ Params: { id: string } }>('/events/:id/supplies', async (req, reply) => {
    const userId = await requireUser(req);
    await createSupply(ctx, userId, req.params.id, parse(supplyCreateSchema, req.body));
    return reply.code(201).send({ ok: true });
  });

  app.post<{ Params: { id: string } }>('/events/:id/supplies/suggest', async (req) => {
    const userId = await requireUser(req);
    return { created: await suggestSupplyList(ctx, userId, req.params.id) };
  });

  app.patch<{ Params: { id: string } }>('/supplies/:id', async (req) => {
    const userId = await requireUser(req);
    await updateSupply(ctx, userId, req.params.id, parse(supplyUpdateSchema, req.body) as never);
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>('/supplies/:id', async (req) => {
    const userId = await requireUser(req);
    await deleteSupply(ctx, userId, req.params.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/supplies/:id/claim', async (req) => {
    await claimSupply(ctx, await requireUser(req), req.params.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/supplies/:id/unclaim', async (req) => {
    await unclaimSupply(ctx, await requireUser(req), req.params.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/supplies/:id/done', async (req) => {
    const userId = await requireUser(req);
    await markSupplyDone(ctx, userId, req.params.id, parse(supplyDoneSchema, req.body ?? {}));
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/supplies/:id/undo', async (req) => {
    await undoSupplyDone(ctx, await requireUser(req), req.params.id);
    return { ok: true };
  });
}
