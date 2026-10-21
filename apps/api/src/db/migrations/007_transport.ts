import { sql, type Kysely, type Migration } from 'kysely';

const text = 'text' as const;
const int = 'integer' as const;

/**
 * Pontos de encontro e paradas do rolê (geridos pelo General da Frota) e o plano de quem não tem lugar
 * no carro: app de carona (Uber, 99, táxi) ou por conta própria.
 */
export const transport007: Migration = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable('meeting_points')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('event_id', text, (c) => c.notNull().references('events.id').onDelete('cascade'))
      .addColumn('kind', text, (c) =>
        c.notNull().check(sql`kind in ('meeting','stop','rideshare','return')`),
      )
      .addColumn('name', text, (c) => c.notNull())
      .addColumn('address', text)
      // Horário do dia, "HH:MM". Vazio: ponto sem hora marcada.
      .addColumn('time', text)
      .addColumn('note', text)
      .addColumn('position', int, (c) => c.notNull())
      .addColumn('created_at', text, (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('meeting_points_event_idx')
      .on('meeting_points')
      .columns(['event_id', 'position'])
      .execute();

    await db.schema
      .createTable('ride_plans')
      .addColumn('event_id', text, (c) => c.notNull().references('events.id').onDelete('cascade'))
      .addColumn('user_id', text, (c) => c.notNull().references('users.id'))
      .addColumn('mode', text, (c) => c.notNull().check(sql`mode in ('app','own')`))
      // Estimativa do custo da corrida (informativa: não entra no rateio).
      .addColumn('est_cents', int)
      .addColumn('updated_at', text, (c) => c.notNull())
      .addPrimaryKeyConstraint('ride_plans_pk', ['event_id', 'user_id'])
      .execute();
  },

  async down(db: Kysely<unknown>) {
    await db.schema.dropTable('ride_plans').ifExists().execute();
    await db.schema.dropTable('meeting_points').ifExists().execute();
  },
};
