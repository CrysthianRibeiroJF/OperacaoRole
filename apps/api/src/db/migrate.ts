import { Migrator, type Kysely, type MigrationProvider } from 'kysely';
import { init001 } from './migrations/001_init';
import { phase2002 } from './migrations/002_phase2';
import { internalAuth003 } from './migrations/003_internal_auth';
import { legalRooms004 } from './migrations/004_legal_rooms';
import { telemetryRefunds005 } from './migrations/005_telemetry_refunds';
import { social006 } from './migrations/006_social';
import type { Database } from './types';

/** Lista estática: funciona igual em dev (tsx) e no bundle de produção (tsup). */
const provider: MigrationProvider = {
  async getMigrations() {
    return {
      '001_init': init001,
      '002_phase2': phase2002,
      '003_internal_auth': internalAuth003,
      '004_legal_rooms': legalRooms004,
      '005_telemetry_refunds': telemetryRefunds005,
      '006_social': social006,
    };
  },
};

export async function migrateToLatest(db: Kysely<Database>): Promise<string[]> {
  const migrator = new Migrator({ db, provider });
  const { error, results } = await migrator.migrateToLatest();
  if (error) throw error instanceof Error ? error : new Error(String(error));
  return (results ?? []).filter((r) => r.status === 'Success').map((r) => r.migrationName);
}
