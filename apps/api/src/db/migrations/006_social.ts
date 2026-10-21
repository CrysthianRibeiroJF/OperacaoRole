import type { Kysely, Migration } from 'kysely';

const text = 'text' as const;
const int = 'integer' as const;

/**
 * Enquetes, tropas, mural de fotos, bagagem, trilha e conta por item. Notificações ganham um
 * `link` (para onde o aviso leva) e o rolê ganha o link da playlist.
 */
export const social006: Migration = {
  async up(db: Kysely<unknown>) {
    await db.schema.alterTable('notifications').addColumn('link', text).execute();
    await db.schema.alterTable('events').addColumn('playlist_url', text).execute();

    // Enquete de data e local.
    await db.schema
      .createTable('polls')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('code', text, (c) => c.notNull().unique())
      .addColumn('organizer_id', text, (c) => c.notNull().references('users.id'))
      .addColumn('title', text, (c) => c.notNull())
      .addColumn('status', text, (c) => c.notNull().defaultTo('open'))
      .addColumn('winner_option_id', text)
      .addColumn('event_id', text, (c) => c.references('events.id').onDelete('set null'))
      .addColumn('created_at', text, (c) => c.notNull())
      .addColumn('closed_at', text)
      .execute();
    await db.schema.createIndex('polls_organizer_idx').on('polls').column('organizer_id').execute();

    await db.schema
      .createTable('poll_options')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('poll_id', text, (c) => c.notNull().references('polls.id').onDelete('cascade'))
      .addColumn('label', text, (c) => c.notNull())
      .addColumn('destination', text)
      .addColumn('start_date', text)
      .addColumn('end_date', text)
      .addColumn('position', int, (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('poll_options_poll_idx')
      .on('poll_options')
      .column('poll_id')
      .execute();

    await db.schema
      .createTable('poll_votes')
      .addColumn('poll_id', text, (c) => c.notNull().references('polls.id').onDelete('cascade'))
      .addColumn('option_id', text, (c) =>
        c.notNull().references('poll_options.id').onDelete('cascade'),
      )
      .addColumn('user_id', text, (c) => c.notNull().references('users.id'))
      .addColumn('voted_at', text, (c) => c.notNull())
      .addPrimaryKeyConstraint('poll_votes_pk', ['option_id', 'user_id'])
      .execute();
    await db.schema.createIndex('poll_votes_poll_idx').on('poll_votes').column('poll_id').execute();

    // Tropa: grupo fixo de amigos. Entra quem abre o link e aceita (consentimento).
    await db.schema
      .createTable('crews')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('code', text, (c) => c.notNull().unique())
      .addColumn('owner_id', text, (c) => c.notNull().references('users.id'))
      .addColumn('name', text, (c) => c.notNull())
      .addColumn('created_at', text, (c) => c.notNull())
      .execute();
    await db.schema
      .createTable('crew_members')
      .addColumn('crew_id', text, (c) => c.notNull().references('crews.id').onDelete('cascade'))
      .addColumn('user_id', text, (c) => c.notNull().references('users.id'))
      .addColumn('joined_at', text, (c) => c.notNull())
      .addPrimaryKeyConstraint('crew_members_pk', ['crew_id', 'user_id'])
      .execute();
    await db.schema
      .createIndex('crew_members_user_idx')
      .on('crew_members')
      .column('user_id')
      .execute();

    // Mural de fotos do rolê.
    await db.schema
      .createTable('event_photos')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('event_id', text, (c) => c.notNull().references('events.id').onDelete('cascade'))
      .addColumn('user_id', text, (c) => c.notNull().references('users.id'))
      .addColumn('file_key', text, (c) => c.notNull())
      .addColumn('mime', text, (c) => c.notNull())
      .addColumn('created_at', text, (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('event_photos_event_idx')
      .on('event_photos')
      .columns(['event_id', 'created_at'])
      .execute();

    // Bagagem: itens do grupo (owner_id nulo, sugeridos pela Base) e pessoais (só o dono vê).
    await db.schema
      .createTable('packing_items')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('event_id', text, (c) => c.notNull().references('events.id').onDelete('cascade'))
      .addColumn('owner_id', text, (c) => c.references('users.id'))
      .addColumn('label', text, (c) => c.notNull())
      .addColumn('created_by', text, (c) => c.notNull().references('users.id'))
      .addColumn('created_at', text, (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('packing_items_event_idx')
      .on('packing_items')
      .columns(['event_id', 'created_at'])
      .execute();
    await db.schema
      .createTable('packing_checks')
      .addColumn('item_id', text, (c) =>
        c.notNull().references('packing_items.id').onDelete('cascade'),
      )
      .addColumn('user_id', text, (c) => c.notNull().references('users.id'))
      .addPrimaryKeyConstraint('packing_checks_pk', ['item_id', 'user_id'])
      .execute();

    // Trilha do rolê: sugestões de música com voto.
    await db.schema
      .createTable('tracks')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('event_id', text, (c) => c.notNull().references('events.id').onDelete('cascade'))
      .addColumn('user_id', text, (c) => c.notNull().references('users.id'))
      .addColumn('title', text, (c) => c.notNull())
      .addColumn('url', text)
      .addColumn('created_at', text, (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('tracks_event_idx')
      .on('tracks')
      .columns(['event_id', 'created_at'])
      .execute();
    await db.schema
      .createTable('track_votes')
      .addColumn('track_id', text, (c) => c.notNull().references('tracks.id').onDelete('cascade'))
      .addColumn('user_id', text, (c) => c.notNull().references('users.id'))
      .addPrimaryKeyConstraint('track_votes_pk', ['track_id', 'user_id'])
      .execute();

    // Conta por item: a cota continua "custom" na despesa; as partes vêm dos consumidores de cada item.
    await db.schema
      .createTable('expense_items')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('expense_id', text, (c) =>
        c.notNull().references('expenses.id').onDelete('cascade'),
      )
      .addColumn('label', text, (c) => c.notNull())
      .addColumn('amount_cents', int, (c) => c.notNull())
      .addColumn('position', int, (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('expense_items_expense_idx')
      .on('expense_items')
      .column('expense_id')
      .execute();
    await db.schema
      .createTable('expense_item_consumers')
      .addColumn('item_id', text, (c) =>
        c.notNull().references('expense_items.id').onDelete('cascade'),
      )
      .addColumn('user_id', text, (c) => c.notNull().references('users.id'))
      .addPrimaryKeyConstraint('expense_item_consumers_pk', ['item_id', 'user_id'])
      .execute();
  },

  async down(db: Kysely<unknown>) {
    for (const table of [
      'expense_item_consumers',
      'expense_items',
      'track_votes',
      'tracks',
      'packing_checks',
      'packing_items',
      'event_photos',
      'crew_members',
      'crews',
      'poll_votes',
      'poll_options',
      'polls',
    ]) {
      await db.schema.dropTable(table).ifExists().execute();
    }
    await db.schema.alterTable('events').dropColumn('playlist_url').execute();
    await db.schema.alterTable('notifications').dropColumn('link').execute();
  },
};
