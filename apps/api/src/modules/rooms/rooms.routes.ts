import { assignPassengerSchema, roomSchema, roomUpdateSchema } from '@role/contracts';
import type { FastifyInstance } from 'fastify';
import { parse, requireUser } from '../../http';
import {
  assignToRoom,
  createRoom,
  deleteRoom,
  getRooms,
  joinRoom,
  leaveRoom,
  removeFromRoom,
  updateRoom,
} from './rooms.service';

export async function roomsRoutes(app: FastifyInstance) {
  const { ctx } = app;

  app.get<{ Params: { id: string } }>('/events/:id/rooms', async (req) =>
    getRooms(ctx, await requireUser(req), req.params.id),
  );

  app.post<{ Params: { id: string } }>('/events/:id/rooms', async (req, reply) => {
    const userId = await requireUser(req);
    await createRoom(ctx, userId, req.params.id, parse(roomSchema, req.body));
    return reply.code(201).send({ ok: true });
  });

  app.patch<{ Params: { id: string } }>('/rooms/:id', async (req) => {
    const userId = await requireUser(req);
    await updateRoom(ctx, userId, req.params.id, parse(roomUpdateSchema, req.body) as never);
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>('/rooms/:id', async (req) => {
    await deleteRoom(ctx, await requireUser(req), req.params.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/rooms/:id/join', async (req) => {
    await joinRoom(ctx, await requireUser(req), req.params.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/rooms/:id/leave', async (req) => {
    await leaveRoom(ctx, await requireUser(req), req.params.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/rooms/:id/assign', async (req) => {
    const userId = await requireUser(req);
    await assignToRoom(ctx, userId, req.params.id, parse(assignPassengerSchema, req.body).userId);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/rooms/:id/remove', async (req) => {
    const userId = await requireUser(req);
    await removeFromRoom(ctx, userId, req.params.id, parse(assignPassengerSchema, req.body).userId);
    return { ok: true };
  });
}
