import { loadConfig } from '../config';
import { createDb } from '../db/client';
import { migrateToLatest } from '../db/migrate';
import { computeMetrics, formatMetrics } from './metrics';

const config = loadConfig();
const db = createDb(config.DATABASE_PATH);
await migrateToLatest(db);
const metrics = await computeMetrics(db, new Date());
console.log(
  process.argv.includes('--json') ? JSON.stringify(metrics, null, 2) : formatMetrics(metrics),
);
await db.destroy();
