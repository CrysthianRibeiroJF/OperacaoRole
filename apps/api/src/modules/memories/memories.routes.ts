import {
  packingCheckSchema,
  packingItemSchema,
  playlistSchema,
  trackSchema,
} from '@role/contracts';
import type { FastifyInstance } from 'fastify';
import { parse, readUpload, requireUser, sendFile } from '../../http';
import {
  addPackingItem,
  addPhoto,
  addTrack,
  checkPackingItem,
  deletePackingItem,
  deletePhoto,
  deleteTrack,
  listPacking,
  listPhotos,
  listTracks,
  openPhoto,
  setPlaylist,
  toggleTrackVote,
} from './memories.service';

export async function memoriesRoutes(app: FastifyInstance) {
  const { ctx } = app;

  // Fotos
  app.get<{ Params: { id: string } }>('/events/:id/photos', async (req) =>
    listPhotos(ctx, await requireUser(req), req.params.id),
  );
  app.post<{ Params: { id: string } }>('/events/:id/photos', async (req, reply) => {
    const userId = await requireUser(req);
    await addPhoto(ctx, userId, req.params.id, await readUpload(req));
    return reply.code(201).send({ ok: true });
  });
  app.get<{ Params: { id: string } }>('/photos/:id', async (req, reply) =>
    sendFile(reply, await openPhoto(ctx, await requireUser(req), req.params.id)),
  );
  app.delete<{ Params: { id: string } }>('/photos/:id', async (req) => {
    await deletePhoto(ctx, await requireUser(req), req.params.id);
    return { ok: true };
  });

  // Bagagem
  app.get<{ Params: { id: string } }>('/events/:id/packing', async (req) =>
    listPacking(ctx, await requireUser(req), req.params.id),
  );
  app.post<{ Params: { id: string } }>('/events/:id/packing', async (req, reply) => {
    const userId = await requireUser(req);
    await addPackingItem(ctx, userId, req.params.id, parse(packingItemSchema, req.body));
    return reply.code(201).send({ ok: true });
  });
  app.post<{ Params: { id: string } }>('/packing/:id/check', async (req) => {
    const userId = await requireUser(req);
    await checkPackingItem(ctx, userId, req.params.id, parse(packingCheckSchema, req.body).checked);
    return { ok: true };
  });
  app.delete<{ Params: { id: string } }>('/packing/:id', async (req) => {
    await deletePackingItem(ctx, await requireUser(req), req.params.id);
    return { ok: true };
  });

  // Trilha
  app.get<{ Params: { id: string } }>('/events/:id/tracks', async (req) =>
    listTracks(ctx, await requireUser(req), req.params.id),
  );
  app.post<{ Params: { id: string } }>('/events/:id/tracks', async (req, reply) => {
    const userId = await requireUser(req);
    await addTrack(ctx, userId, req.params.id, parse(trackSchema, req.body));
    return reply.code(201).send({ ok: true });
  });
  app.post<{ Params: { id: string } }>('/tracks/:id/vote', async (req) => {
    await toggleTrackVote(ctx, await requireUser(req), req.params.id);
    return { ok: true };
  });
  app.delete<{ Params: { id: string } }>('/tracks/:id', async (req) => {
    await deleteTrack(ctx, await requireUser(req), req.params.id);
    return { ok: true };
  });
  app.put<{ Params: { id: string } }>('/events/:id/playlist', async (req) => {
    const userId = await requireUser(req);
    await setPlaylist(ctx, userId, req.params.id, parse(playlistSchema, req.body).url);
    return { ok: true };
  });
}
