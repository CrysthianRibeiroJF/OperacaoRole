import type { Db } from '../../context';
import { newId } from '../../ids';

/**
 * Monitoramento interno: sem serviço externo. Erros do servidor e do app caem na mesma tabela e
 * aparecem em `npm run errors` e em `npm run metrics`. Eventos de uso alimentam o funil.
 * Nada aqui guarda dado pessoal além do id do usuário logado (quando houver).
 */
const cut = (value: string | undefined | null, max: number) => (value ? value.slice(0, max) : null);

export async function recordError(
  db: Db,
  now: Date,
  input: {
    source: 'server' | 'client';
    message: string;
    stack?: string | undefined;
    route?: string | undefined;
    userId?: string | null | undefined;
    userAgent?: string | undefined;
  },
): Promise<void> {
  try {
    await db
      .insertInto('error_events')
      .values({
        id: newId(),
        source: input.source,
        message: input.message.slice(0, 300),
        stack: cut(input.stack, 2000),
        route: cut(input.route, 200),
        user_id: input.userId ?? null,
        user_agent: cut(input.userAgent, 200),
        created_at: now.toISOString(),
      })
      .execute();
  } catch {
    // Registrar erro nunca pode derrubar a requisição que já está falhando.
  }
}

export async function recordEvent(
  db: Db,
  now: Date,
  input: { name: string; userId?: string | null | undefined; path?: string | undefined },
): Promise<void> {
  await db
    .insertInto('analytics_events')
    .values({
      id: newId(),
      name: input.name,
      user_id: input.userId ?? null,
      path: cut(input.path, 200),
      created_at: now.toISOString(),
    })
    .execute();
}

export async function recentErrors(db: Db, limit = 20) {
  return db
    .selectFrom('error_events')
    .selectAll()
    .orderBy('created_at', 'desc')
    .limit(limit)
    .execute();
}
