/**
 * Tipos das tabelas (espelham as migrations).
 * Convenções: ids TEXT (UUID), datas TEXT ISO-8601 em UTC, booleanos INTEGER 0/1, dinheiro em centavos.
 */
export interface UsersTable {
  id: string;
  phone: string;
  name: string;
  pix_key: string | null;
  created_at: string;
  deleted_at: string | null;
  password_hash: string | null;
  password_changed_at: string | null;
  recovery_hash: string | null;
  recovery_created_at: string | null;
  terms_accepted_at: string | null;
  terms_version: string | null;
}

export interface EventsTable {
  id: string;
  code: string;
  organizer_id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string | null;
  cost_cap_cents: number;
  quorum: number;
  status: 'open' | 'confirmed' | 'archived' | 'cancelled' | 'closed';
  response_deadline_at: string;
  created_at: string;
  confirmed_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  max_roles_per_user: number;
  expense_approval_threshold_cents: number;
  deposit_required: number;
  deposit_cents: number | null;
  deposit_pix_key: string | null;
  deposit_deadline_at: string | null;
  deposit_opened_at: string | null;
  base_address: string | null;
  base_wifi_name: string | null;
  base_wifi_password: string | null;
  base_gate_code: string | null;
  base_checkout_time: string | null;
  base_house_rules: string | null;
  base_schedule: string | null;
  fixed_costs_cents: number | null;
}

export interface ParticipationsTable {
  id: string;
  event_id: string;
  user_id: string;
  response: 'in' | 'out';
  drinks_alcohol: number;
  diet: 'omnivore' | 'vegetarian';
  deposit_status: 'none' | 'pending' | 'submitted' | 'approved' | 'rejected' | 'waitlisted';
  responded_at: string;
}

export interface EventRolesTable {
  event_id: string;
  role: 'base' | 'fleet' | 'supplies' | 'treasury';
  user_id: string;
  drawn: number;
  assigned_at: string;
}

export interface RoleDeclinesTable {
  event_id: string;
  user_id: string;
  role: 'base' | 'fleet' | 'supplies' | 'treasury';
}

export interface DepositProofsTable {
  id: string;
  event_id: string;
  user_id: string;
  file_key: string;
  mime: string;
  size_bytes: number;
  status: 'submitted' | 'approved' | 'rejected';
  reject_reason: string | null;
  reviewed_by: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

export interface ExpensesTable {
  id: string;
  event_id: string;
  paid_by: string;
  description: string;
  category: string;
  amount_cents: number;
  quota: 'global' | 'alcohol' | 'meat' | 'vegetarian' | 'custom';
  status: 'pending' | 'approved' | 'rejected';
  reject_reason: string | null;
  reviewed_by: string | null;
  receipt_key: string | null;
  receipt_mime: string | null;
  created_at: string;
}

export interface ExpenseParticipantsTable {
  expense_id: string;
  user_id: string;
}

export interface ExpenseContestsTable {
  id: string;
  expense_id: string;
  by_user: string;
  reason: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution: string | null;
}

export interface SettlementsTable {
  id: string;
  event_id: string;
  closed_by: string;
  closed_at: string;
  total_expenses_cents: number;
}

export interface SettlementBalancesTable {
  settlement_id: string;
  user_id: string;
  paid_cents: number;
  deposit_cents: number;
  cost_cents: number;
  held_deposits_cents: number;
  net_cents: number;
}

export interface SettlementTransfersTable {
  id: string;
  settlement_id: string;
  from_user: string;
  to_user: string;
  amount_cents: number;
  paid_at: string | null;
  confirmed_by: string | null;
}

export interface NotificationsTable {
  id: string;
  user_id: string;
  event_id: string | null;
  kind: string;
  title: string;
  body: string;
  dedupe_key: string;
  created_at: string;
  read_at: string | null;
}

export interface EventMutesTable {
  user_id: string;
  event_id: string;
}

export interface JobsTable {
  id: string;
  kind: string;
  run_at: string;
  payload: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  attempts: number;
  last_error: string | null;
  dedupe_key: string;
  created_at: string;
  finished_at: string | null;
}

export interface AuditLogTable {
  id: string;
  event_id: string | null;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  data: string | null;
  created_at: string;
}

export type SupplyCategoryDb =
  'meat' | 'veg' | 'drinks_alc' | 'drinks' | 'breakfast' | 'cleaning' | 'other';

export interface SupplyItemsTable {
  id: string;
  event_id: string;
  name: string;
  category: SupplyCategoryDb;
  quantity_label: string;
  est_price_cents: number | null;
  real_price_cents: number | null;
  assignee_id: string | null;
  done: number;
  expense_id: string | null;
  created_by: string;
  created_at: string;
}

export interface VehiclesTable {
  id: string;
  event_id: string;
  driver_id: string;
  label: string;
  departure_place: string | null;
  departure_time: string | null;
  seats: number;
  cargo_capacity: number;
  cargo_note: string | null;
  created_at: string;
}

export interface VehiclePassengersTable {
  vehicle_id: string;
  event_id: string;
  user_id: string;
}

export interface CargoItemsTable {
  id: string;
  event_id: string;
  name: string;
  vehicle_id: string | null;
  created_by: string;
  created_at: string;
}

export interface UserSessionsTable {
  id: string;
  user_id: string;
  device: string;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
}

export interface LoginAttemptsTable {
  id: string;
  phone: string;
  kind: string;
  success: number;
  created_at: string;
}

export interface NotificationPrefsTable {
  user_id: string;
  category: string;
  enabled: number;
}

export interface RoomsTable {
  id: string;
  event_id: string;
  name: string;
  beds: number;
  created_at: string;
}

export interface RoomOccupantsTable {
  room_id: string;
  event_id: string;
  user_id: string;
}

export interface ErrorEventsTable {
  id: string;
  source: 'server' | 'client';
  message: string;
  stack: string | null;
  route: string | null;
  user_id: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AnalyticsEventsTable {
  id: string;
  name: string;
  user_id: string | null;
  path: string | null;
  created_at: string;
}

export interface DepositRefundsTable {
  event_id: string;
  user_id: string;
  refunded_at: string;
  marked_by: string;
}

export interface Database {
  users: UsersTable;
  events: EventsTable;
  participations: ParticipationsTable;
  event_roles: EventRolesTable;
  role_declines: RoleDeclinesTable;
  deposit_proofs: DepositProofsTable;
  expenses: ExpensesTable;
  expense_participants: ExpenseParticipantsTable;
  expense_contests: ExpenseContestsTable;
  settlements: SettlementsTable;
  settlement_balances: SettlementBalancesTable;
  settlement_transfers: SettlementTransfersTable;
  notifications: NotificationsTable;
  event_mutes: EventMutesTable;
  jobs: JobsTable;
  audit_log: AuditLogTable;
  supply_items: SupplyItemsTable;
  vehicles: VehiclesTable;
  vehicle_passengers: VehiclePassengersTable;
  cargo_items: CargoItemsTable;
  user_sessions: UserSessionsTable;
  login_attempts: LoginAttemptsTable;
  notification_prefs: NotificationPrefsTable;
  rooms: RoomsTable;
  room_occupants: RoomOccupantsTable;
  error_events: ErrorEventsTable;
  analytics_events: AnalyticsEventsTable;
  deposit_refunds: DepositRefundsTable;
}
