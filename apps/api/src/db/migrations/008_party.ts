import { sql, type Kysely, type Migration } from 'kysely';

const text = 'text' as const;
const int = 'integer' as const;

/**
 * Acompanhantes (casal e crianças) ligados à confirmação, só para o rolê: não têm conta. O
 * Idealizador define as regras (liberar, teto de crianças, capacidade da casa) e os quartos ganham
 * camas de casal.
 */
export const party008: Migration = {
  async up(db: Kysely<unknown>) {
    await db.schema.alterTable('events').addColumn('capacity', int).execute();
    await db.schema
      .alterTable('events')
      .addColumn('max_children', int, (c) => c.notNull().defaultTo(2))
      .execute();
    await db.schema
      .alterTable('events')
      .addColumn('allow_companions', int, (c) => c.notNull().defaultTo(1))
      .execute();
    await db.schema
      .alterTable('rooms')
      .addColumn('double_beds', int, (c) => c.notNull().defaultTo(0))
      .execute();

    await db.schema
      .createTable('companions')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('event_id', text, (c) => c.notNull().references('events.id').onDelete('cascade'))
      // O responsável: quem confirmou presença e paga pelo acompanhante adulto.
      .addColumn('owner_id', text, (c) => c.notNull().references('users.id'))
      .addColumn('name', text, (c) => c.notNull())
      .addColumn('kind', text, (c) => c.notNull().check(sql`kind in ('adult','child')`))
      .addColumn('drinks_alcohol', int, (c) => c.notNull().defaultTo(0))
      .addColumn('diet', text, (c) =>
        c
          .notNull()
          .defaultTo('omnivore')
          .check(sql`diet in ('omnivore','vegetarian')`),
      )
      .addColumn('created_at', text, (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('companions_event_owner_idx')
      .on('companions')
      .columns(['event_id', 'owner_id'])
      .execute();
  },

  async down(db: Kysely<unknown>) {
    await db.schema.dropTable('companions').ifExists().execute();
    await db.schema.alterTable('rooms').dropColumn('double_beds').execute();
    await db.schema.alterTable('events').dropColumn('allow_companions').execute();
    await db.schema.alterTable('events').dropColumn('max_children').execute();
    await db.schema.alterTable('events').dropColumn('capacity').execute();
  },
};
