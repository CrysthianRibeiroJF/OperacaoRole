import type { Kysely, Migration } from 'kysely';

const text = 'text' as const;
const int = 'integer' as const;

/** Aceite dos termos (com versão) e distribuição de quartos. */
export const legalRooms004: Migration = {
  async up(db: Kysely<unknown>) {
    await db.schema.alterTable('users').addColumn('terms_accepted_at', text).execute();
    await db.schema.alterTable('users').addColumn('terms_version', text).execute();

    await db.schema
      .createTable('rooms')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('event_id', text, (c) => c.notNull().references('events.id').onDelete('cascade'))
      .addColumn('name', text, (c) => c.notNull())
      .addColumn('beds', int, (c) => c.notNull())
      .addColumn('created_at', text, (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('rooms_event_idx')
      .on('rooms')
      .columns(['event_id', 'created_at'])
      .execute();

    await db.schema
      .createTable('room_occupants')
      .addColumn('room_id', text, (c) => c.notNull().references('rooms.id').onDelete('cascade'))
      .addColumn('event_id', text, (c) => c.notNull().references('events.id').onDelete('cascade'))
      .addColumn('user_id', text, (c) => c.notNull().references('users.id'))
      .addPrimaryKeyConstraint('room_occupants_pk', ['room_id', 'user_id'])
      // Uma cama por pessoa por rolê.
      .addUniqueConstraint('room_occupants_event_user_uq', ['event_id', 'user_id'])
      .execute();
  },

  async down(db: Kysely<unknown>) {
    await db.schema.dropTable('room_occupants').ifExists().execute();
    await db.schema.dropTable('rooms').ifExists().execute();
    await db.schema.alterTable('users').dropColumn('terms_version').execute();
    await db.schema.alterTable('users').dropColumn('terms_accepted_at').execute();
  },
};
