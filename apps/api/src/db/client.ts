import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import type { Database } from './types';

/**
 * SQLite no MVP (zero infraestrutura). Toda consulta passa pelo Kysely e o schema usa só tipos
 * portáveis (TEXT/INTEGER), então migrar para PostgreSQL troca o dialeto e as migrations.
 */
export function createDb(path: string): Kysely<Database> {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });

  const sqlite = new BetterSqlite3(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('synchronous = NORMAL');

  return new Kysely<Database>({ dialect: new SqliteDialect({ database: sqlite }) });
}
