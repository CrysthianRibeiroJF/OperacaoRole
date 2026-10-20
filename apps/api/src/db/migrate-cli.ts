import { loadConfig } from '../config';
import { createDb } from './client';
import { migrateToLatest } from './migrate';

const config = loadConfig();
const db = createDb(config.DATABASE_PATH);
const applied = await migrateToLatest(db);
console.log(
  applied.length ? `Migrations aplicadas: ${applied.join(', ')}` : 'Banco já está atualizado.',
);
await db.destroy();
