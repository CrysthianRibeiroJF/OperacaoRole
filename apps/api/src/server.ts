import { buildApp } from './app';
import { loadConfig } from './config';
import { systemClock, type AppContext } from './context';
import { createDb } from './db/client';
import { migrateToLatest } from './db/migrate';
import { LocalDiskStorage } from './lib/storage';
import { startJobRunner } from './modules/jobs/runner';

const config = loadConfig();
const db = createDb(config.DATABASE_PATH);
await migrateToLatest(db);

const ctx: AppContext = {
  db,
  config,
  clock: systemClock,
  storage: new LocalDiskStorage(config.UPLOAD_DIR),
};

const app = await buildApp(ctx, { logger: true });
if (config.NODE_ENV === 'production') {
  app.log.warn(
    'Produção: configure um OtpSender real (SMS/WhatsApp), senão ninguém consegue entrar.',
  );
}
const stopJobs = startJobRunner(ctx, 30_000, (err) =>
  app.log.error({ err }, 'falha no runner de jobs'),
);

const shutdown = async (signal: string) => {
  app.log.info(`${signal} recebido, encerrando`);
  stopJobs();
  await app.close();
  await db.destroy();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ port: config.PORT, host: config.HOST });
