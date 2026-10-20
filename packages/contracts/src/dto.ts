import type {
  Action,
  Diet,
  EventStatus,
  NotificationCategory,
  Quota,
  RoleKey,
  SupplyCategory,
} from '@role/domain';

/** Formatos das respostas da API. Datas em ISO 8601, dinheiro em centavos. */

export type ParticipationState = 'in' | 'out' | 'none';
export type DepositStatus =
  | 'none' // rolê sem sinal ou janela ainda não aberta
  | 'pending'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'waitlisted';
export type ExpenseStatus = 'pending' | 'approved' | 'rejected';
export type ExpenseCategory =
  'food' | 'drinks' | 'fuel' | 'toll' | 'lodging' | 'cleaning' | 'other';

export interface PublicUser {
  id: string;
  name: string;
}

export interface ProfileDto extends PublicUser {
  phone: string;
  pixKey: string | null;
}

export interface EventCard {
  id: string;
  code: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string | null;
  costCapCents: number;
  quorum: number;
  status: EventStatus;
  responseDeadlineAt: string;
  confirmedCount: number;
  missing: number;
  belowQuorum: boolean;
  organizer: PublicUser;
  requiresDeposit: boolean;
  depositCents: number | null;
  createdAt: string;
  confirmedAt: string | null;
}

export interface FeedItem extends EventCard {
  myState: ParticipationState;
  isOrganizer: boolean;
  myDepositStatus: DepositStatus;
}

export interface MyContext {
  participation: ParticipationState;
  isOrganizer: boolean;
  roles: RoleKey[];
  depositStatus: DepositStatus;
  drinksAlcohol: boolean;
  diet: Diet;
  can: Record<Action, boolean>;
}

export interface InviteView {
  event: EventCard;
  confirmed: PublicUser[];
  me: MyContext | null;
}

export interface BaseInfo {
  address: string | null;
  wifiName: string | null;
  wifiPassword: string | null;
  gateCode: string | null;
  checkoutTime: string | null;
  houseRules: string | null;
  schedule: string | null;
}

export interface RoleAssignment {
  role: RoleKey;
  user: PublicUser | null;
  drawn: boolean;
}

export interface RosterEntry {
  user: PublicUser;
  drinksAlcohol: boolean;
  diet: Diet;
  depositStatus: DepositStatus;
  roles: RoleKey[];
}

export interface DepositConfig {
  required: boolean;
  amountCents: number | null;
  pixKey: string | null;
  deadlineAt: string | null;
  openedAt: string | null;
}

export interface BudgetInfo {
  fixedCostsCents: number | null;
}

export interface EventDetail {
  event: EventCard;
  me: MyContext;
  base: BaseInfo;
  roles: RoleAssignment[];
  roster: RosterEntry[];
  deposit: DepositConfig;
  budget: BudgetInfo;
}

export interface DepositQueueItem {
  user: PublicUser;
  status: DepositStatus;
  submittedAt: string | null;
  rejectReason: string | null;
  hasProof: boolean;
}

export interface ExpenseContest {
  reason: string;
  by: PublicUser;
  at: string;
  resolvedAt: string | null;
  resolution: string | null;
}

export interface ExpenseDto {
  id: string;
  description: string;
  category: ExpenseCategory;
  amountCents: number;
  quota: Quota;
  customParticipants: PublicUser[];
  paidBy: PublicUser;
  status: ExpenseStatus;
  rejectReason: string | null;
  hasReceipt: boolean;
  contest: ExpenseContest | null;
  contestable: boolean;
  createdAt: string;
}

export interface VaultDto {
  paidByMeCents: number;
  depositPaidCents: number;
  projectedShareCents: number;
  projectedNetCents: number;
  pendingExpenses: number;
  settled: boolean;
}

export interface BalanceDto {
  user: PublicUser;
  paidCents: number;
  depositCents: number;
  costCents: number;
  heldDepositsCents: number;
  netCents: number;
}

export interface TransferDto {
  id: string;
  from: PublicUser;
  to: PublicUser;
  amountCents: number;
  toPixKey: string | null;
  paidAt: string | null;
}

export interface SettlementDto {
  closed: boolean;
  closedAt: string | null;
  totalExpensesCents: number;
  /** Tesoureiro vê todos; os demais veem só o próprio saldo (RN: cobrança privada). */
  balances: BalanceDto[];
  transfers: TransferDto[];
  issues: { expenseId: string; description: string; code: 'NO_BENEFICIARIES' | 'UNRESOLVED' }[];
}

export interface NotificationDto {
  id: string;
  kind: string;
  title: string;
  body: string;
  eventId: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface AuthResult {
  profile: ProfileDto;
  /** Só existe no cadastro e na recuperação: é mostrado uma única vez. */
  recoveryCode?: string;
}

export interface SessionDto {
  id: string;
  device: string;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

export interface SecurityOverview {
  sessions: SessionDto[];
  passwordChangedAt: string | null;
  recoveryCodeCreatedAt: string | null;
}

export interface NotificationPrefsDto {
  categories: Record<NotificationCategory, boolean>;
}

export interface MutedEventDto {
  id: string;
  code: string;
  title: string;
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export interface SupplyItemDto {
  id: string;
  name: string;
  category: SupplyCategory;
  quantityLabel: string;
  estPriceCents: number | null;
  realPriceCents: number | null;
  assignee: PublicUser | null;
  done: boolean;
  hasExpense: boolean;
}

export interface SuppliesDto {
  items: SupplyItemDto[];
  estimatedCents: number;
  realCents: number;
  doneCount: number;
}

export interface CargoDto {
  id: string;
  name: string;
  vehicleId: string | null;
}

export interface VehicleDto {
  id: string;
  label: string;
  driver: PublicUser;
  departurePlace: string | null;
  departureTime: string | null;
  seats: number;
  freeSeats: number;
  cargoCapacity: number;
  cargoNote: string | null;
  passengers: PublicUser[];
  cargo: CargoDto[];
  overloaded: boolean;
}

export interface FleetDto {
  vehicles: VehicleDto[];
  /** Confirmados que ainda não têm lugar nem dirigem. */
  seatless: PublicUser[];
  unassignedCargo: CargoDto[];
  myVehicleId: string | null;
  iAmDriver: boolean;
}

export interface AccountExport {
  exportedAt: string;
  profile: ProfileDto;
  events: { id: string; title: string; role: string; response: string }[];
  expensesPaid: { eventId: string; description: string; amountCents: number; status: string }[];
  notifications: { title: string; body: string; createdAt: string }[];
}

export interface RoomDto {
  id: string;
  name: string;
  beds: number;
  freeBeds: number;
  occupants: PublicUser[];
}

export interface RoomsDto {
  rooms: RoomDto[];
  /** Confirmados que ainda não têm cama. */
  unassigned: PublicUser[];
  myRoomId: string | null;
}

export interface RefundDto {
  user: PublicUser;
  amountCents: number;
  refundedAt: string | null;
}

export interface RefundsDto {
  /** O Tesoureiro vê todos; os demais veem só a própria linha. */
  canManage: boolean;
  items: RefundDto[];
}
