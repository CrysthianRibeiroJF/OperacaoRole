import { sql, type Kysely, type Migration } from 'kysely';

const text = 'text' as const;
const int = 'integer' as const;

export const init001: Migration = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable('users')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('phone', text, (c) => c.notNull().unique())
      .addColumn('name', text, (c) => c.notNull())
      .addColumn('pix_key', text)
      .addColumn('created_at', text, (c) => c.notNull())
      .execute();

    await db.schema
      .createTable('otp_codes')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('phone', text, (c) => c.notNull())
      .addColumn('code_hash', text, (c) => c.notNull())
      .addColumn('expires_at', text, (c) => c.notNull())
      .addColumn('attempts', int, (c) => c.notNull().defaultTo(0))
      .addColumn('consumed_at', text)
      .addColumn('created_at', text, (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('otp_codes_phone_idx')
      .on('otp_codes')
      .columns(['phone', 'created_at'])
      .execute();

    await db.schema
      .createTable('events')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('code', text, (c) => c.notNull().unique())
      .addColumn('organizer_id', text, (c) => c.notNull().references('users.id'))
      .addColumn('title', text, (c) => c.notNull())
      .addColumn('destination', text, (c) => c.notNull())
      .addColumn('start_date', text, (c) => c.notNull())
      .addColumn('end_date', text)
      .addColumn('cost_cap_cents', int, (c) => c.notNull())
      .addColumn('quorum', int, (c) => c.notNull().defaultTo(3))
      .addColumn('status', text, (c) =>
        c.notNull().check(sql`status in ('open','confirmed','archived','cancelled','closed')`),
      )
      .addColumn('response_deadline_at', text, (c) => c.notNull())
      .addColumn('created_at', text, (c) => c.notNull())
      .addColumn('confirmed_at', text)
      .addColumn('closed_at', text)
      .addColumn('cancelled_at', text)
      .addColumn('max_roles_per_user', int, (c) => c.notNull().defaultTo(2))
      .addColumn('expense_approval_threshold_cents', int, (c) => c.notNull().defaultTo(30000))
      .addColumn('deposit_required', int, (c) => c.notNull().defaultTo(0))
      .addColumn('deposit_cents', int)
      .addColumn('deposit_pix_key', text)
      .addColumn('deposit_deadline_at', text)
      .addColumn('deposit_opened_at', text)
      .addColumn('base_address', text)
      .addColumn('base_wifi_name', text)
      .addColumn('base_wifi_password', text)
      .addColumn('base_gate_code', text)
      .addColumn('base_checkout_time', text)
      .addColumn('base_house_rules', text)
      .addColumn('base_schedule', text)
      .execute();
    await db.schema
      .createIndex('events_organizer_idx')
      .on('events')
      .column('organizer_id')
      .execute();
    await db.schema
      .createIndex('events_status_idx')
      .on('events')
      .columns(['status', 'response_deadline_at'])
      .execute();

    await db.schema
      .createTable('participations')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('event_id', text, (c) => c.notNull().references('events.id').onDelete('cascade'))
      .addColumn('user_id', text, (c) => c.notNull().references('users.id'))
      .addColumn('response', text, (c) => c.notNull().check(sql`response in ('in','out')`))
      .addColumn('drinks_alcohol', int, (c) => c.notNull().defaultTo(0))
      .addColumn('diet', text, (c) =>
        c
          .notNull()
          .defaultTo('omnivore')
          .check(sql`diet in ('omnivore','vegetarian')`),
      )
      .addColumn('deposit_status', text, (c) =>
        c
          .notNull()
          .defaultTo('none')
          .check(
            sql`deposit_status in ('none','pending','submitted','approved','rejected','waitlisted')`,
          ),
      )
      .addColumn('responded_at', text, (c) => c.notNull())
      .addUniqueConstraint('participations_event_user_uq', ['event_id', 'user_id'])
      .execute();
    await db.schema
      .createIndex('participations_user_idx')
      .on('participations')
      .column('user_id')
      .execute();

    await db.schema
      .createTable('event_roles')
      .addColumn('event_id', text, (c) => c.notNull().references('events.id').onDelete('cascade'))
      .addColumn('role', text, (c) =>
        c.notNull().check(sql`role in ('base','fleet','supplies','treasury')`),
      )
      .addColumn('user_id', text, (c) => c.notNull().references('users.id'))
      .addColumn('drawn', int, (c) => c.notNull().defaultTo(0))
      .addColumn('assigned_at', text, (c) => c.notNull())
      .addPrimaryKeyConstraint('event_roles_pk', ['event_id', 'role'])
      .execute();

    await db.schema
      .createTable('role_declines')
      .addColumn('event_id', text, (c) => c.notNull().references('events.id').onDelete('cascade'))
      .addColumn('user_id', text, (c) => c.notNull().references('users.id'))
      .addColumn('role', text, (c) => c.notNull())
      .addPrimaryKeyConstraint('role_declines_pk', ['event_id', 'user_id', 'role'])
      .execute();

    await db.schema
      .createTable('deposit_proofs')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('event_id', text, (c) => c.notNull().references('events.id').onDelete('cascade'))
      .addColumn('user_id', text, (c) => c.notNull().references('users.id'))
      .addColumn('file_key', text, (c) => c.notNull())
      .addColumn('mime', text, (c) => c.notNull())
      .addColumn('size_bytes', int, (c) => c.notNull())
      .addColumn('status', text, (c) =>
        c.notNull().check(sql`status in ('submitted','approved','rejected')`),
      )
      .addColumn('reject_reason', text)
      .addColumn('reviewed_by', text, (c) => c.references('users.id'))
      .addColumn('submitted_at', text, (c) => c.notNull())
      .addColumn('reviewed_at', text)
      .execute();
    await db.schema
      .createIndex('deposit_proofs_event_user_idx')
      .on('deposit_proofs')
      .columns(['event_id', 'user_id'])
      .execute();

    await db.schema
      .createTable('expenses')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('event_id', text, (c) => c.notNull().references('events.id').onDelete('cascade'))
      .addColumn('paid_by', text, (c) => c.notNull().references('users.id'))
      .addColumn('description', text, (c) => c.notNull())
      .addColumn('category', text, (c) => c.notNull())
      .addColumn('amount_cents', int, (c) => c.notNull().check(sql`amount_cents > 0`))
      .addColumn('quota', text, (c) =>
        c.notNull().check(sql`quota in ('global','alcohol','meat','vegetarian','custom')`),
      )
      .addColumn('status', text, (c) =>
        c.notNull().check(sql`status in ('pending','approved','rejected')`),
      )
      .addColumn('reject_reason', text)
      .addColumn('reviewed_by', text, (c) => c.references('users.id'))
      .addColumn('receipt_key', text)
      .addColumn('receipt_mime', text)
      .addColumn('created_at', text, (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('expenses_event_idx')
      .on('expenses')
      .columns(['event_id', 'created_at'])
      .execute();

    await db.schema
      .createTable('expense_participants')
      .addColumn('expense_id', text, (c) =>
        c.notNull().references('expenses.id').onDelete('cascade'),
      )
      .addColumn('user_id', text, (c) => c.notNull().references('users.id'))
      .addPrimaryKeyConstraint('expense_participants_pk', ['expense_id', 'user_id'])
      .execute();

    await db.schema
      .createTable('expense_contests')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('expense_id', text, (c) =>
        c.notNull().unique().references('expenses.id').onDelete('cascade'),
      )
      .addColumn('by_user', text, (c) => c.notNull().references('users.id'))
      .addColumn('reason', text, (c) => c.notNull())
      .addColumn('created_at', text, (c) => c.notNull())
      .addColumn('resolved_at', text)
      .addColumn('resolved_by', text, (c) => c.references('users.id'))
      .addColumn('resolution', text)
      .execute();

    await db.schema
      .createTable('settlements')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('event_id', text, (c) =>
        c.notNull().unique().references('events.id').onDelete('cascade'),
      )
      .addColumn('closed_by', text, (c) => c.notNull().references('users.id'))
      .addColumn('closed_at', text, (c) => c.notNull())
      .addColumn('total_expenses_cents', int, (c) => c.notNull())
      .execute();

    await db.schema
      .createTable('settlement_balances')
      .addColumn('settlement_id', text, (c) =>
        c.notNull().references('settlements.id').onDelete('cascade'),
      )
      .addColumn('user_id', text, (c) => c.notNull().references('users.id'))
      .addColumn('paid_cents', int, (c) => c.notNull())
      .addColumn('deposit_cents', int, (c) => c.notNull())
      .addColumn('cost_cents', int, (c) => c.notNull())
      .addColumn('held_deposits_cents', int, (c) => c.notNull())
      .addColumn('net_cents', int, (c) => c.notNull())
      .addPrimaryKeyConstraint('settlement_balances_pk', ['settlement_id', 'user_id'])
      .execute();

    await db.schema
      .createTable('settlement_transfers')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('settlement_id', text, (c) =>
        c.notNull().references('settlements.id').onDelete('cascade'),
      )
      .addColumn('from_user', text, (c) => c.notNull().references('users.id'))
      .addColumn('to_user', text, (c) => c.notNull().references('users.id'))
      .addColumn('amount_cents', int, (c) => c.notNull().check(sql`amount_cents > 0`))
      .addColumn('paid_at', text)
      .addColumn('confirmed_by', text, (c) => c.references('users.id'))
      .execute();

    await db.schema
      .createTable('notifications')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('user_id', text, (c) => c.notNull().references('users.id'))
      .addColumn('event_id', text, (c) => c.references('events.id').onDelete('cascade'))
      .addColumn('kind', text, (c) => c.notNull())
      .addColumn('title', text, (c) => c.notNull())
      .addColumn('body', text, (c) => c.notNull())
      .addColumn('dedupe_key', text, (c) => c.notNull())
      .addColumn('created_at', text, (c) => c.notNull())
      .addColumn('read_at', text)
      .addUniqueConstraint('notifications_dedupe_uq', ['user_id', 'dedupe_key'])
      .execute();
    await db.schema
      .createIndex('notifications_user_idx')
      .on('notifications')
      .columns(['user_id', 'created_at'])
      .execute();

    await db.schema
      .createTable('event_mutes')
      .addColumn('user_id', text, (c) => c.notNull().references('users.id'))
      .addColumn('event_id', text, (c) => c.notNull().references('events.id').onDelete('cascade'))
      .addPrimaryKeyConstraint('event_mutes_pk', ['user_id', 'event_id'])
      .execute();

    await db.schema
      .createTable('jobs')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('kind', text, (c) => c.notNull())
      .addColumn('run_at', text, (c) => c.notNull())
      .addColumn('payload', text, (c) => c.notNull())
      .addColumn('status', text, (c) =>
        c.notNull().check(sql`status in ('pending','running','done','failed')`),
      )
      .addColumn('attempts', int, (c) => c.notNull().defaultTo(0))
      .addColumn('last_error', text)
      .addColumn('dedupe_key', text, (c) => c.notNull().unique())
      .addColumn('created_at', text, (c) => c.notNull())
      .addColumn('finished_at', text)
      .execute();
    await db.schema.createIndex('jobs_due_idx').on('jobs').columns(['status', 'run_at']).execute();

    await db.schema
      .createTable('audit_log')
      .addColumn('id', text, (c) => c.primaryKey())
      .addColumn('event_id', text)
      .addColumn('actor_id', text)
      .addColumn('action', text, (c) => c.notNull())
      .addColumn('entity', text, (c) => c.notNull())
      .addColumn('entity_id', text)
      .addColumn('data', text)
      .addColumn('created_at', text, (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('audit_log_event_idx')
      .on('audit_log')
      .columns(['event_id', 'created_at'])
      .execute();
  },

  async down(db: Kysely<unknown>) {
    for (const table of [
      'audit_log',
      'jobs',
      'event_mutes',
      'notifications',
      'settlement_transfers',
      'settlement_balances',
      'settlements',
      'expense_contests',
      'expense_participants',
      'expenses',
      'deposit_proofs',
      'role_declines',
      'event_roles',
      'participations',
      'events',
      'otp_codes',
      'users',
    ]) {
      await db.schema.dropTable(table).ifExists().execute();
    }
  },
};
