import {
  assignPassengerSchema,
  cargoCreateSchema,
  cargoMoveSchema,
  vehicleSchema,
  vehicleUpdateSchema,
} from '@role/contracts';
import type { FastifyInstance } from 'fastify';
import { parse, requireUser } from '../../http';
import {
  assignPassenger,
  createCargo,
  createVehicle,
  deleteCargo,
  deleteVehicle,
  getFleet,
  joinVehicle,
  leaveVehicle,
  moveCargo,
  removePassenger,
  updateVehicle,
} from './fleet.service';

export async function fleetRoutes(app: FastifyInstance) {
  const { ctx } = app;

  app.get<{ Params: { id: string } }>('/events/:id/fleet', async (req) =>
    getFleet(ctx, await requireUser(req), req.params.id),
  );

  app.post<{ Params: { id: string } }>('/events/:id/vehicles', async (req, reply) => {
    const userId = await requireUser(req);
    await createVehicle(ctx, userId, req.params.id, parse(vehicleSchema, req.body));
    return reply.code(201).send({ ok: true });
  });

  app.patch<{ Params: { id: string } }>('/vehicles/:id', async (req) => {
    const userId = await requireUser(req);
    await updateVehicle(ctx, userId, req.params.id, parse(vehicleUpdateSchema, req.body) as never);
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>('/vehicles/:id', async (req) => {
    await deleteVehicle(ctx, await requireUser(req), req.params.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/vehicles/:id/join', async (req) => {
    await joinVehicle(ctx, await requireUser(req), req.params.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/vehicles/:id/leave', async (req) => {
    await leaveVehicle(ctx, await requireUser(req), req.params.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/vehicles/:id/assign', async (req) => {
    const userId = await requireUser(req);
    await assignPassenger(
      ctx,
      userId,
      req.params.id,
      parse(assignPassengerSchema, req.body).userId,
    );
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/vehicles/:id/remove', async (req) => {
    const userId = await requireUser(req);
    await removePassenger(
      ctx,
      userId,
      req.params.id,
      parse(assignPassengerSchema, req.body).userId,
    );
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/events/:id/cargo', async (req, reply) => {
    const userId = await requireUser(req);
    await createCargo(ctx, userId, req.params.id, parse(cargoCreateSchema, req.body));
    return reply.code(201).send({ ok: true });
  });

  app.patch<{ Params: { id: string } }>('/cargo/:id', async (req) => {
    const userId = await requireUser(req);
    await moveCargo(ctx, userId, req.params.id, parse(cargoMoveSchema, req.body).vehicleId);
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>('/cargo/:id', async (req) => {
    await deleteCargo(ctx, await requireUser(req), req.params.id);
    return { ok: true };
  });
}
