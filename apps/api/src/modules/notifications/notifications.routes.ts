import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse, requireUser } from '../../http';
import { requireEvent } from '../events/event.queries';
import { notificationPrefsSchema } from '@role/contracts';
import {
  getNotificationPrefs,
  isEventMuted,
  listMutedEvents,
  setNotificationPrefs,
  listNotifications,
  markNotificationsRead,
  setEventMuted,
} from './notifications.service';

const readSchema = z.object({ ids: z.array(z.string()).max(200).optional() });
const muteSchema = z.object({ muted: z.boolean() });

export async function notificationsRoutes(app: FastifyInstance) {
  const { ctx } = app;

  app.get('/notifications', async (req) => listNotifications(ctx.db, await requireUser(req)));

  app.post('/notifications/read', async (req) => {
    const userId = await requireUser(req);
    const { ids } = parse(readSchema, req.body ?? {});
    await markNotificationsRead(ctx.db, ctx.clock.now(), userId, ids);
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>('/events/:id/mute', async (req) => {
    const userId = await requireUser(req);
    await requireEvent(ctx.db, req.params.id);
    return { muted: await isEventMuted(ctx.db, userId, req.params.id) };
  });

  app.put<{ Params: { id: string } }>('/events/:id/mute', async (req) => {
    const userId = await requireUser(req);
    await requireEvent(ctx.db, req.params.id);
    const { muted } = parse(muteSchema, req.body);
    await setEventMuted(ctx.db, userId, req.params.id, muted);
    return { muted };
  });

  app.get('/me/notification-prefs', async (req) =>
    getNotificationPrefs(ctx.db, await requireUser(req)),
  );

  app.put('/me/notification-prefs', async (req) => {
    const userId = await requireUser(req);
    const { categories } = parse(notificationPrefsSchema, req.body);
    return setNotificationPrefs(ctx.db, userId, categories);
  });

  app.get('/me/muted-events', async (req) => listMutedEvents(ctx.db, await requireUser(req)));
}
