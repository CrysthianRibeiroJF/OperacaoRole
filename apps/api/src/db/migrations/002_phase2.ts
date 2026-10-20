import { sql, type Kysely, type Migration } from 'kysely';

const text = 'text' as const;
const int = 'integer' as const;

/** Fase 2: Mercado & Itens, Frotas & Caronas, orçamento e exclusão de conta (LGPD). */
export const phase2002: Migration = {
  async up(db: Kysely<unknown>) {
    await db.schema.alterTable('events').addColumn('fixed_costs_cents', int).execute();
    await db.schema.alterTable('users').addColumn('deleted_at', text).execute();

    await db.schema
      .createTable('supply_items')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('event_id', text, (c) => c.notNull().references('events.id').onDelete('cascade'))
      .addColumn('name', text, (c) => c.notNull())
      .addColumn('category', text, (c) =>
        c
          .notNull()
          .check(
            sql`category in ('meat','veg','drinks_alc','drinks','breakfast','cleaning','other')`,
          ),
      )
      .addColumn('quantity_label', text, (c) => c.notNull())
      .addColumn('est_price_cents', int)
      .addColumn('real_price_cents', int)
      .addColumn('assignee_id', text, (c) => c.references('users.id'))
      .addColumn('done', int, (c) => c.notNull().defaultTo(0))
      .addColumn('expense_id', text, (c) => c.references('expenses.id').onDelete('set null'))
      .addColumn('created_by', text, (c) => c.notNull().references('users.id'))
      .addColumn('created_at', text, (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('supply_items_event_idx')
      .on('supply_items')
      .columns(['event_id', 'created_at'])
      .execute();

    await db.schema
      .createTable('vehicles')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('event_id', text, (c) => c.notNull().references('events.id').onDelete('cascade'))
      .addColumn('driver_id', text, (c) => c.notNull().references('users.id'))
      .addColumn('label', text, (c) => c.notNull())
      .addColumn('departure_place', text)
      .addColumn('departure_time', text)
      .addColumn('seats', int, (c) => c.notNull().check(sql`seats between 0 and 12`))
      .addColumn('cargo_capacity', int, (c) => c.notNull().defaultTo(0))
      .addColumn('cargo_note', text)
      .addColumn('created_at', text, (c) => c.notNull())
      .addUniqueConstraint('vehicles_event_driver_uq', ['event_id', 'driver_id'])
      .execute();

    await db.schema
      .createTable('vehicle_passengers')
      .addColumn('vehicle_id', text, (c) =>
        c.notNull().references('vehicles.id').onDelete('cascade'),
      )
      .addColumn('event_id', text, (c) => c.notNull().references('events.id').onDelete('cascade'))
      .addColumn('user_id', text, (c) => c.notNull().references('users.id'))
      .addPrimaryKeyConstraint('vehicle_passengers_pk', ['vehicle_id', 'user_id'])
      // Uma pessoa ocupa um único assento por rolê.
      .addUniqueConstraint('vehicle_passengers_event_user_uq', ['event_id', 'user_id'])
      .execute();

    await db.schema
      .createTable('cargo_items')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('event_id', text, (c) => c.notNull().references('events.id').onDelete('cascade'))
      .addColumn('name', text, (c) => c.notNull())
      .addColumn('vehicle_id', text, (c) => c.references('vehicles.id').onDelete('set null'))
      .addColumn('created_by', text, (c) => c.notNull().references('users.id'))
      .addColumn('created_at', text, (c) => c.notNull())
      .execute();
  },

  async down(db: Kysely<unknown>) {
    for (const table of ['cargo_items', 'vehicle_passengers', 'vehicles', 'supply_items']) {
      await db.schema.dropTable(table).ifExists().execute();
    }
    await db.schema.alterTable('users').dropColumn('deleted_at').execute();
    await db.schema.alterTable('events').dropColumn('fixed_costs_cents').execute();
  },
};
