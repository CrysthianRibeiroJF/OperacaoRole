import { loadConfig } from '../config';
import { createDb } from '../db/client';
import { migrateToLatest } from '../db/migrate';
import { recentErrors } from '../modules/telemetry/telemetry.service';

const config = loadConfig();
const db = createDb(config.DATABASE_PATH);
await migrateToLatest(db);
const limit = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 20);
const rows = await recentErrors(db, limit);
if (rows.length === 0) console.log('Nenhum erro registrado.');
for (const r of rows) {
  console.log(
    `${r.created_at} [${r.source}] ${r.route ?? '-'}\n  ${r.message}${r.stack ? '\n  ' + r.stack.split('\n').slice(1, 3).join('\n  ') : ''}`,
  );
}
await db.destroy();
