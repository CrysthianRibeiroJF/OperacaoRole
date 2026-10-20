import type { Kysely, Migration } from 'kysely';

const text = 'text' as const;
const int = 'integer' as const;

/**
 * Acesso interno ao app (sem SMS, WhatsApp ou e-mail): senha, código de recuperação, sessões por
 * dispositivo, tentativas de login e preferências de aviso. O código por SMS (otp_codes) sai de cena.
 */
export const internalAuth003: Migration = {
  async up(db: Kysely<unknown>) {
    await db.schema.alterTable('users').addColumn('password_hash', text).execute();
    await db.schema.alterTable('users').addColumn('password_changed_at', text).execute();
    await db.schema.alterTable('users').addColumn('recovery_hash', text).execute();
    await db.schema.alterTable('users').addColumn('recovery_created_at', text).execute();

    await db.schema
      .createTable('user_sessions')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('user_id', text, (c) => c.notNull().references('users.id'))
      .addColumn('device', text, (c) => c.notNull())
      .addColumn('created_at', text, (c) => c.notNull())
      .addColumn('last_seen_at', text, (c) => c.notNull())
      .addColumn('revoked_at', text)
      .execute();
    await db.schema
      .createIndex('user_sessions_user_idx')
      .on('user_sessions')
      .column('user_id')
      .execute();

    await db.schema
      .createTable('login_attempts')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('phone', text, (c) => c.notNull())
      .addColumn('kind', text, (c) => c.notNull())
      .addColumn('success', int, (c) => c.notNull())
      .addColumn('created_at', text, (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('login_attempts_phone_idx')
      .on('login_attempts')
      .columns(['phone', 'created_at'])
      .execute();

    await db.schema
      .createTable('notification_prefs')
      .addColumn('user_id', text, (c) => c.notNull().references('users.id'))
      .addColumn('category', text, (c) => c.notNull())
      .addColumn('enabled', int, (c) => c.notNull())
      .addPrimaryKeyConstraint('notification_prefs_pk', ['user_id', 'category'])
      .execute();

    await db.schema.dropTable('otp_codes').ifExists().execute();
  },

  async down(db: Kysely<unknown>) {
    for (const table of ['notification_prefs', 'login_attempts', 'user_sessions']) {
      await db.schema.dropTable(table).ifExists().execute();
    }
    for (const col of [
      'recovery_created_at',
      'recovery_hash',
      'password_changed_at',
      'password_hash',
    ]) {
      await db.schema.alterTable('users').dropColumn(col).execute();
    }
  },
};
