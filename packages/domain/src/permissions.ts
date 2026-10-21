/** RN-20 a RN-25: cargos e matriz de permissões (aplicada sempre no servidor). */
export const ROLE_KEYS = ['base', 'fleet', 'supplies', 'treasury'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const ROLE_LABELS: Record<RoleKey, string> = {
  base: 'General da Base',
  fleet: 'General da Frota',
  supplies: 'General de Suprimentos',
  treasury: 'General do Tesouro',
};

export const MAX_ROLES_PER_USER_DEFAULT = 2;

export type ParticipationState = 'in' | 'out' | 'none';

export interface Actor {
  isOrganizer: boolean;
  /** Cargos de General que este usuário ocupa no rolê. */
  roles: readonly RoleKey[];
  participation: ParticipationState;
  /** Cargos sem ocupante: o Idealizador cobre a função enquanto estiverem vagos (RN-25). */
  vacantRoles: readonly RoleKey[];
}

export const ACTIONS = [
  'event.cancel',
  'event.viewInternal',
  'roles.draw',
  'roles.claim',
  'base.edit',
  'deposit.configure',
  'deposit.review',
  'expense.create',
  'expense.review',
  'expense.resolveContest',
  'settlement.close',
  'settlement.viewAll',
  'supplies.edit',
  'supplies.claim',
  'fleet.edit',
  'fleet.join',
  'budget.edit',
  'rooms.edit',
  'rooms.join',
  'photos.add',
  'tracks.add',
  'panel.overview',
  'panel.supplies',
  'panel.fleet',
  'panel.base',
  'panel.treasury',
] as const;
export type Action = (typeof ACTIONS)[number];

export function permissionsFor(actor: Actor): Record<Action, boolean> {
  return Object.fromEntries(ACTIONS.map((a) => [a, can(actor, a)])) as Record<Action, boolean>;
}

function holds(actor: Actor, role: RoleKey): boolean {
  return actor.roles.includes(role) || (actor.isOrganizer && actor.vacantRoles.includes(role));
}

export function can(actor: Actor, action: Action): boolean {
  const confirmed = actor.participation === 'in';
  switch (action) {
    case 'event.cancel':
    case 'roles.draw':
    case 'panel.overview':
      return actor.isOrganizer;
    // Painel do General: quem ocupa o cargo e o Idealizador (que vê tudo, mesmo com o cargo preenchido).
    case 'panel.supplies':
      return actor.isOrganizer || actor.roles.includes('supplies');
    case 'panel.fleet':
      return actor.isOrganizer || actor.roles.includes('fleet');
    case 'panel.base':
      return actor.isOrganizer || actor.roles.includes('base');
    case 'panel.treasury':
      return actor.isOrganizer || actor.roles.includes('treasury');
    case 'event.viewInternal':
      return confirmed || actor.isOrganizer;
    case 'roles.claim':
    case 'expense.create':
    case 'supplies.claim':
    case 'fleet.join':
    case 'rooms.join':
    case 'photos.add':
    case 'tracks.add':
      return confirmed;
    case 'base.edit':
    case 'budget.edit':
    case 'rooms.edit':
      return holds(actor, 'base');
    case 'supplies.edit':
      return holds(actor, 'supplies');
    case 'fleet.edit':
      return holds(actor, 'fleet');
    case 'deposit.configure':
    case 'deposit.review':
    case 'expense.review':
    case 'expense.resolveContest':
    case 'settlement.close':
    case 'settlement.viewAll':
      return holds(actor, 'treasury');
  }
}

export function canTakeAnotherRole(
  currentRoles: readonly RoleKey[],
  max = MAX_ROLES_PER_USER_DEFAULT,
): boolean {
  return currentRoles.length < max;
}

export interface DrawCandidate {
  userId: string;
  roles: readonly RoleKey[];
  /** Cargos que a pessoa já recusou em sorteios anteriores (RN-21). */
  declined: readonly RoleKey[];
}

export interface DrawAssignment {
  role: RoleKey;
  userId: string;
}

/**
 * Sorteia cargos vagos entre confirmados. Prioriza quem tem menos cargos (distribui a carga),
 * respeita o limite por pessoa e não sorteia quem já recusou aquele cargo.
 */
export function drawRoles(params: {
  vacantRoles: readonly RoleKey[];
  candidates: readonly DrawCandidate[];
  maxRolesPerUser?: number;
  random?: () => number;
}): DrawAssignment[] {
  const { vacantRoles, candidates, maxRolesPerUser = MAX_ROLES_PER_USER_DEFAULT } = params;
  const random = params.random ?? Math.random;
  const load = new Map(candidates.map((c) => [c.userId, c.roles.length]));
  const result: DrawAssignment[] = [];

  for (const role of vacantRoles) {
    const eligible = candidates.filter(
      (c) => (load.get(c.userId) ?? 0) < maxRolesPerUser && !c.declined.includes(role),
    );
    if (eligible.length === 0) continue;
    const minLoad = Math.min(...eligible.map((c) => load.get(c.userId) ?? 0));
    const pool = eligible.filter((c) => (load.get(c.userId) ?? 0) === minLoad);
    const pick = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]!;
    result.push({ role, userId: pick.userId });
    load.set(pick.userId, (load.get(pick.userId) ?? 0) + 1);
  }
  return result;
}
