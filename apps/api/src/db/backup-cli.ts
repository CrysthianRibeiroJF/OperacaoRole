import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { loadConfig } from '../config';

/**
 * Cópia consistente do banco com o app no ar (API de backup do SQLite, sem precisar do binário
 * `sqlite3`). Uso: `npm run backup` ou `npm run backup -- /var/data/backups/antes-da-mudanca.db`.
 * Comprovantes ficam em UPLOAD_DIR e entram no snapshot do disco, não aqui.
 */
const config = loadConfig();
const stamp = new Date().toISOString().slice(0, 10);
const target = resolve(process.argv[2] ?? `${dirname(config.DATABASE_PATH)}/backup-${stamp}.db`);
mkdirSync(dirname(target), { recursive: true });

const db = new Database(config.DATABASE_PATH, { readonly: true, fileMustExist: true });
await db.backup(target);
db.close();
console.log(`Cópia do banco salva em ${target}`);
