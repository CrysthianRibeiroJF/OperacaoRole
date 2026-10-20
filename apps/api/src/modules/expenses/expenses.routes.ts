import {
  contestSchema,
  createExpenseSchema,
  expenseReviewSchema,
  resolveContestSchema,
} from '@role/contracts';
import type { FastifyInstance } from 'fastify';
import { parse, readUpload, requireUser, sendFile } from '../../http';
import {
  attachReceipt,
  contestExpense,
  createExpense,
  listExpenses,
  openReceipt,
  resolveContest,
  reviewExpense,
} from './expenses.service';

export async function expensesRoutes(app: FastifyInstance) {
  const { ctx } = app;

  app.get<{ Params: { id: string } }>('/events/:id/expenses', async (req) =>
    listExpenses(ctx, await requireUser(req), req.params.id),
  );

  app.post<{ Params: { id: string } }>('/events/:id/expenses', async (req, reply) => {
    const userId = await requireUser(req);
    const expense = await createExpense(
      ctx,
      userId,
      req.params.id,
      parse(createExpenseSchema, req.body),
    );
    return reply.code(201).send(expense);
  });

  app.post<{ Params: { id: string } }>('/expenses/:id/receipt', async (req, reply) => {
    const userId = await requireUser(req);
    await attachReceipt(ctx, userId, req.params.id, await readUpload(req));
    return reply.code(201).send({ ok: true });
  });

  app.get<{ Params: { id: string } }>('/expenses/:id/receipt', async (req, reply) => {
    const userId = await requireUser(req);
    return sendFile(reply, await openReceipt(ctx, userId, req.params.id));
  });

  app.post<{ Params: { id: string } }>('/expenses/:id/review', async (req) => {
    const userId = await requireUser(req);
    await reviewExpense(ctx, userId, req.params.id, parse(expenseReviewSchema, req.body));
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/expenses/:id/contest', async (req) => {
    const userId = await requireUser(req);
    await contestExpense(ctx, userId, req.params.id, parse(contestSchema, req.body).reason);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/expenses/:id/resolve-contest', async (req) => {
    const userId = await requireUser(req);
    await resolveContest(ctx, userId, req.params.id, parse(resolveContestSchema, req.body));
    return { ok: true };
  });
}
