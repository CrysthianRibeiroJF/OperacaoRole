import type {
  Action,
  Diet,
  EventStatus,
  NotificationCategory,
  PanelTab,
  Quota,
  Reliability,
  RideMode,
  RoleKey,
  StopKind,
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
  /** "Andorinha confiável" ou "primeira vez": só o Idealizador recebe (nos demais é sempre nulo). */
  reliability: Reliability;
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

export interface ExpenseItemDto {
  id: string;
  label: string;
  amountCents: number;
  consumers: PublicUser[];
}

export interface ExpenseDto {
  id: string;
  description: string;
  category: ExpenseCategory;
  amountCents: number;
  quota: Quota;
  customParticipants: PublicUser[];
  /** Conta por item (vazio nas demais despesas). */
  items: ExpenseItemDto[];
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
  /** Rota do app para onde o aviso leva; nulo: abre o QG do rolê (ou nada). */
  link: string | null;
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

/* ------------------------------- Enquetes, tropa e mural ------------------------------- */

export interface PollOptionDto {
  id: string;
  label: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  votes: number;
  votedByMe: boolean;
  /** Só para quem está logado. */
  voters: PublicUser[];
}

export interface PollDto {
  id: string;
  code: string;
  title: string;
  status: 'open' | 'closed';
  organizer: PublicUser;
  options: PollOptionDto[];
  winnerOptionId: string | null;
  /** Opções na frente (mais de uma: empate). */
  leaderOptionIds: string[];
  totalVoters: number;
  isOrganizer: boolean;
  loggedIn: boolean;
  /** Proposta criada a partir da enquete. */
  event: { id: string; code: string } | null;
  createdAt: string;
  closedAt: string | null;
}

export interface PollSummaryDto {
  id: string;
  code: string;
  title: string;
  status: 'open' | 'closed';
  totalVoters: number;
  isOrganizer: boolean;
  votedByMe: boolean;
}

export interface CrewDto {
  id: string;
  code: string;
  name: string;
  owner: PublicUser;
  members: PublicUser[];
  isOwner: boolean;
}

export interface CrewPreview {
  code: string;
  name: string;
  owner: PublicUser;
  memberCount: number;
  /** Nulo se a pessoa não está logada. */
  joined: boolean | null;
}

export interface PhotoDto {
  id: string;
  by: PublicUser;
  createdAt: string;
  mine: boolean;
  canDelete: boolean;
}

export interface PhotosDto {
  photos: PhotoDto[];
  canAdd: boolean;
  max: number;
}

export interface PackingItemDto {
  id: string;
  label: string;
  scope: 'group' | 'mine';
  checked: boolean;
  canDelete: boolean;
}

export interface PackingDto {
  items: PackingItemDto[];
  doneCount: number;
  canSuggest: boolean;
}

export interface TrackDto {
  id: string;
  title: string;
  url: string | null;
  by: PublicUser;
  votes: number;
  votedByMe: boolean;
  canDelete: boolean;
}

export interface TracksDto {
  playlistUrl: string | null;
  canEditPlaylist: boolean;
  tracks: TrackDto[];
}

export interface PixPaymentDto {
  /** Texto do Pix copia e cola, já com o valor. */
  payload: string;
  amountCents: number;
  payee: PublicUser;
  /** Chave como cadastrada (para conferir antes de pagar). */
  key: string;
}

export interface MissionReportDto {
  event: {
    id: string;
    title: string;
    destination: string;
    startDate: string;
    endDate: string | null;
  };
  /** A conta já foi fechada: os números não mudam mais. */
  final: boolean;
  days: number;
  headcount: number;
  totalCents: number;
  perHeadCents: number;
  perDayPerHeadCents: number;
  expenseCount: number;
  topPayer: { user: PublicUser; amountCents: number } | null;
  biggestExpense: { description: string; amountCents: number } | null;
  topCategory: { category: string; cents: number } | null;
  categories: { category: string; cents: number }[];
  participants: PublicUser[];
}

/* ------------------------------ Transporte, pontos e painéis ------------------------------ */

export interface StopDto {
  id: string;
  kind: StopKind;
  name: string;
  address: string | null;
  /** HH:MM; nulo: sem hora marcada. */
  time: string | null;
  note: string | null;
}

export interface RidePlanDto {
  mode: 'app' | 'own';
  estCents: number | null;
}

export interface TransportDto {
  /** Em ordem de horário. */
  stops: StopDto[];
  canEdit: boolean;
  /** Como a pessoa chega: lugar no carro vale mais que o plano. */
  myRide: RideMode;
  myPlan: RidePlanDto | null;
  /** Quem declarou app (Uber, 99, táxi) e quem vai por conta própria, entre os sem lugar no carro. */
  appRiders: PublicUser[];
  ownRiders: PublicUser[];
}

export interface PanelPart {
  key: 'quorum' | 'deposit' | 'supplies' | 'fleet' | 'rooms' | 'base' | 'expenses';
  label: string;
  percent: number;
  /** Quantas pendências faltam nessa área. */
  pending: number;
  hint: string;
  tab: PanelTab;
}

export interface PanelAlert {
  key: string;
  tone: 'danger' | 'warn' | 'info';
  text: string;
  tab: PanelTab;
}

/** Visão geral do Idealizador: prontidão por área e o que precisa de atenção agora. */
export interface OverviewPanel {
  percent: number;
  parts: PanelPart[];
  alerts: PanelAlert[];
  vacantRoles: RoleKey[];
}

export interface SuppliesPanel {
  totalItems: number;
  doneItems: number;
  unassignedItems: number;
  percentDone: number;
  estCents: number;
  realCents: number;
  deviationCents: number;
  perHeadEstCents: number | null;
  byCategory: {
    category: SupplyCategory;
    total: number;
    done: number;
    unassigned: number;
    estCents: number;
    realCents: number;
  }[];
  load: { user: PublicUser; items: number; done: number }[];
  /** Itens sem responsável, para o General distribuir (os primeiros). */
  unassigned: { id: string; name: string; category: SupplyCategory; quantityLabel: string }[];
}

export interface FleetPanel {
  headcount: number;
  drivers: number;
  passengers: number;
  appRiders: number;
  ownRiders: number;
  undecided: number;
  seatsTotal: number;
  seatsFree: number;
  seatShortfall: number;
  percentCovered: number;
  /** Soma das estimativas de corrida dos que vão de app (informativa). */
  rideEstimateCents: number;
  stops: StopDto[];
  vehicles: {
    id: string;
    label: string;
    driver: PublicUser;
    departurePlace: string | null;
    departureTime: string | null;
    seats: number;
    taken: number;
  }[];
  appRiderUsers: PublicUser[];
  ownRiderUsers: PublicUser[];
  undecidedUsers: PublicUser[];
}

export interface BasePanel {
  percent: number;
  info: { key: string; label: string; done: boolean }[];
  rooms: { total: number; beds: number; occupied: number };
  withoutBed: PublicUser[];
}

export interface TreasuryPanel {
  deposit: {
    required: boolean;
    open: boolean;
    amountCents: number | null;
    approved: number;
    submitted: number;
    pending: number;
    rejected: number;
    waitlisted: number;
    collectedCents: number;
  };
  expenses: {
    count: number;
    approvedCents: number;
    pendingCount: number;
    openContests: number;
    perHeadCents: number | null;
  };
  settled: boolean;
}

export interface MyStepDto {
  key: string;
  label: string;
  done: boolean;
  tab: PanelTab;
}

/** Acompanhamento pessoal: o que já está resolvido e o que falta para esta pessoa. */
export interface MyPanel {
  percent: number;
  steps: MyStepDto[];
  deposit: {
    required: boolean;
    status: DepositStatus;
    amountCents: number | null;
    deadlineAt: string | null;
  };
  ride: {
    mode: RideMode;
    vehicleLabel: string | null;
    departurePlace: string | null;
    departureTime: string | null;
  };
  room: string | null;
  items: { id: string; name: string; done: boolean }[];
  packing: { done: number; total: number };
  finance: { projectedShareCents: number; projectedNetCents: number; paidByMeCents: number };
  stops: StopDto[];
  checkoutTime: string | null;
}

export interface PanelDto {
  isOrganizer: boolean;
  roles: RoleKey[];
  /** Cada seção só vem para quem pode vê-la (o servidor decide). */
  overview: OverviewPanel | null;
  supplies: SuppliesPanel | null;
  fleet: FleetPanel | null;
  base: BasePanel | null;
  treasury: TreasuryPanel | null;
  mine: MyPanel;
}
