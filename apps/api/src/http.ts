import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Readable } from 'node:stream';
import type { ZodTypeAny, z } from 'zod';
import { AppError, unauthorized } from './errors';
import { MAX_UPLOAD_BYTES } from './lib/sniff';

export const SESSION_COOKIE = 'role_session';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; sid: string };
    user: { sub: string; sid: string };
  }
}

const TOUCH_EVERY_MS = 60_000;

/** Valida a entrada com o esquema compartilhado (@role/contracts). Erros viram 400 padronizados. */
export function parse<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    throw new AppError(400, 'VALIDATION', issues[0]?.message ?? 'Dados inválidos', issues);
  }
  return result.data;
}

export async function requireUser(req: FastifyRequest): Promise<string> {
  try {
    await req.jwtVerify({ onlyCookie: true });
  } catch {
    throw unauthorized();
  }
  const { db, clock } = req.server.ctx;
  if (!req.user.sid) throw unauthorized();

  // A sessão precisa existir, ser da pessoa e não ter sido encerrada (sair, trocar senha, excluir conta).
  const session = await db
    .selectFrom('user_sessions')
    .innerJoin('users', 'users.id', 'user_sessions.user_id')
    .select(['user_sessions.last_seen_at as last_seen_at', 'users.deleted_at as deleted_at'])
    .where('user_sessions.id', '=', req.user.sid)
    .where('user_sessions.user_id', '=', req.user.sub)
    .where('user_sessions.revoked_at', 'is', null)
    .executeTakeFirst();
  if (!session || session.deleted_at) throw unauthorized();

  const now = clock.now();
  if (now.getTime() - new Date(session.last_seen_at).getTime() > TOUCH_EVERY_MS) {
    await db
      .updateTable('user_sessions')
      .set({ last_seen_at: now.toISOString() })
      .where('id', '=', req.user.sid)
      .execute();
  }
  return req.user.sub;
}

/** Id da sessão atual (use depois de `requireUser`). */
export function currentSessionId(req: FastifyRequest): string {
  return req.user.sid;
}

export async function optionalUser(req: FastifyRequest): Promise<string | null> {
  try {
    return await requireUser(req);
  } catch {
    return null;
  }
}

/** Lê o único arquivo de um multipart e garante o limite de tamanho. */
export async function readUpload(req: FastifyRequest): Promise<Buffer> {
  const file = await req.file({ limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
  if (!file) throw new AppError(400, 'FILE_REQUIRED', 'Envie um arquivo');
  const buffer = await file.toBuffer();
  if (file.file.truncated) throw new AppError(413, 'FILE_TOO_LARGE', 'O arquivo passa de 5 MB');
  return buffer;
}

export function sendFile(reply: FastifyReply, file: { stream: Readable; mime: string }) {
  return reply
    .header('content-type', file.mime)
    .header('x-content-type-options', 'nosniff')
    .header('cache-control', 'private, max-age=0')
    .header('content-disposition', 'inline')
    .send(file.stream);
}
