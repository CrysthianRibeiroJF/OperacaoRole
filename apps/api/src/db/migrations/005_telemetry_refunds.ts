import type { Kysely, Migration } from 'kysely';

const text = 'text' as const;

/**
 * Monitoramento interno (sem serviço externo): erros do servidor e do app, eventos de uso para o
 * funil, e o controle de devolução de sinal quando um rolê é cancelado (o app só registra).
 */
export const telemetryRefunds005: Migration = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable('error_events')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('source', text, (c) => c.notNull())
      .addColumn('message', text, (c) => c.notNull())
      .addColumn('stack', text)
      .addColumn('route', text)
      .addColumn('user_id', text)
      .addColumn('user_agent', text)
      .addColumn('created_at', text, (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('error_events_at_idx')
      .on('error_events')
      .column('created_at')
      .execute();

    await db.schema
      .createTable('analytics_events')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('name', text, (c) => c.notNull())
      .addColumn('user_id', text)
      .addColumn('path', text)
      .addColumn('created_at', text, (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('analytics_events_name_idx')
      .on('analytics_events')
      .columns(['name', 'created_at'])
      .execute();

    await db.schema
      .createTable('deposit_refunds')
      .addColumn('event_id', text, (c) => c.notNull().references('events.id').onDelete('cascade'))
      .addColumn('user_id', text, (c) => c.notNull().references('users.id'))
      .addColumn('refunded_at', text, (c) => c.notNull())
      .addColumn('marked_by', text, (c) => c.notNull().references('users.id'))
      .addPrimaryKeyConstraint('deposit_refunds_pk', ['event_id', 'user_id'])
      .execute();
  },

  async down(db: Kysely<unknown>) {
    for (const table of ['deposit_refunds', 'analytics_events', 'error_events']) {
      await db.schema.dropTable(table).ifExists().execute();
    }
  },
};
