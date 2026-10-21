import type { Cents } from './money';
import type { SupplyCategory } from './supplies';
import { SUPPLY_CATEGORIES } from './supplies';

/**
 * Painéis do QG: cada General acompanha a sua área, o Idealizador vê tudo e quem não tem cargo vê o
 * próprio andamento. Aqui ficam só as contas (resumos e prontidão); quem monta os números a partir do
 * banco é o servidor.
 */

/** Abas do QG para onde um pendente leva. */
export type PanelTab = 'base' | 'equipe' | 'mercado' | 'frotas' | 'cofre' | 'mural';

/** Percentual de 0 a 100; sem nada a medir (total 0) conta como 0, não como "tudo pronto". */
export function percentOf(done: number, total: number): number {
  if (!Number.isFinite(done) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

/* ----------------------------------------- Mercado ----------------------------------------- */

export interface SupplyLine {
  category: SupplyCategory;
  estPriceCents: Cents | null;
  realPriceCents: Cents | null;
  done: boolean;
  assigneeId: string | null;
}

export interface SupplyCategorySummary {
  category: SupplyCategory;
  total: number;
  done: number;
  unassigned: number;
  estCents: Cents;
  realCents: Cents;
}

export interface SuppliesSummary {
  /** Só as categorias que têm item, na ordem do app. */
  byCategory: SupplyCategorySummary[];
  totalItems: number;
  doneItems: number;
  /** Itens ainda sem "eu levo" (os já comprados não contam). */
  unassignedItems: number;
  estCents: Cents;
  realCents: Cents;
  /** Real menos estimado, só nos itens comprados que têm os dois preços. Positivo = gastou a mais. */
  deviationCents: Cents;
  /** Estimativa da lista inteira dividida pela turma (arredondada para cima). */
  perHeadEstCents: Cents | null;
  percentDone: number;
  /** Quantos itens cada pessoa assumiu, do maior para o menor. */
  load: { userId: string; items: number; done: number }[];
}

export function summarizeSupplies(
  items: readonly (SupplyLine & { id?: string })[],
  headcount: number,
): SuppliesSummary {
  const byCategory = SUPPLY_CATEGORIES.flatMap((category) => {
    const rows = items.filter((i) => i.category === category);
    if (rows.length === 0) return [];
    return [
      {
        category,
        total: rows.length,
        done: rows.filter((i) => i.done).length,
        unassigned: rows.filter((i) => !i.done && !i.assigneeId).length,
        estCents: rows.reduce((sum, i) => sum + (i.estPriceCents ?? 0), 0),
        realCents: rows.reduce((sum, i) => sum + (i.realPriceCents ?? 0), 0),
      },
    ];
  });

  const estCents = items.reduce((sum, i) => sum + (i.estPriceCents ?? 0), 0);
  const realCents = items.reduce((sum, i) => sum + (i.realPriceCents ?? 0), 0);
  const deviationCents = items
    .filter((i) => i.done && i.estPriceCents !== null && i.realPriceCents !== null)
    .reduce((sum, i) => sum + (i.realPriceCents! - i.estPriceCents!), 0);

  const loadMap = new Map<string, { items: number; done: number }>();
  for (const i of items) {
    if (!i.assigneeId) continue;
    const row = loadMap.get(i.assigneeId) ?? { items: 0, done: 0 };
    row.items += 1;
    if (i.done) row.done += 1;
    loadMap.set(i.assigneeId, row);
  }
  const load = [...loadMap.entries()]
    .map(([userId, v]) => ({ userId, ...v }))
    .sort((a, b) => b.items - a.items || a.userId.localeCompare(b.userId));

  const doneItems = items.filter((i) => i.done).length;
  return {
    byCategory,
    totalItems: items.length,
    doneItems,
    unassignedItems: items.filter((i) => !i.done && !i.assigneeId).length,
    estCents,
    realCents,
    deviationCents,
    perHeadEstCents: headcount > 0 ? Math.ceil(estCents / headcount) : null,
    percentDone: percentOf(doneItems, items.length),
    load,
  };
}

/* ------------------------------------------- Frota ------------------------------------------ */

/** Como cada pessoa chega ao rolê. O lugar no carro vale mais que um plano antigo. */
export type RideMode = 'driver' | 'passenger' | 'app' | 'own' | 'none';
/** O que a pessoa pode declarar quando não tem lugar: app (Uber, 99, táxi) ou por conta própria. */
export const RIDE_PLAN_MODES = ['app', 'own'] as const;
export type RidePlanMode = (typeof RIDE_PLAN_MODES)[number];

export function rideModeOf(input: {
  drives: boolean;
  hasSeat: boolean;
  plan: RidePlanMode | null;
}): RideMode {
  if (input.drives) return 'driver';
  if (input.hasSeat) return 'passenger';
  return input.plan ?? 'none';
}

export interface FleetSummary {
  headcount: number;
  drivers: number;
  passengers: number;
  appRiders: number;
  ownRiders: number;
  /** Sem lugar no carro e sem plano: ainda precisam se resolver. */
  undecided: number;
  seatsTotal: number;
  seatsFree: number;
  /** Quem ainda precisa de um lugar (sem plano e sem carro) e não cabe nos assentos livres. */
  seatShortfall: number;
  /** Pessoas com transporte definido sobre o total. */
  percentCovered: number;
}

export function summarizeFleet(input: {
  modes: readonly RideMode[];
  /** Assentos de passageiro cadastrados (sem o motorista). */
  seatsTotal: number;
}): FleetSummary {
  const count = (mode: RideMode) => input.modes.filter((m) => m === mode).length;
  const headcount = input.modes.length;
  const passengers = count('passenger');
  const undecided = count('none');
  const seatsFree = Math.max(0, input.seatsTotal - passengers);
  return {
    headcount,
    drivers: count('driver'),
    passengers,
    appRiders: count('app'),
    ownRiders: count('own'),
    undecided,
    seatsTotal: input.seatsTotal,
    seatsFree,
    seatShortfall: Math.max(0, undecided - seatsFree),
    percentCovered: percentOf(headcount - undecided, headcount),
  };
}

/* ------------------------------------ Pontos de encontro ------------------------------------ */

export const STOP_KINDS = ['meeting', 'stop', 'rideshare', 'return'] as const;
export type StopKind = (typeof STOP_KINDS)[number];

export const STOP_KIND_LABELS: Record<StopKind, string> = {
  meeting: 'Ponto de encontro',
  stop: 'Parada',
  rideshare: 'Ponto para chamar o app',
  return: 'Volta',
};

export interface StopLike {
  time: string | null;
  position: number;
}

/** Linha do tempo: por horário (HH:MM); sem horário vai para o fim, na ordem em que foi criada. */
export function sortStops<T extends StopLike>(stops: readonly T[]): T[] {
  return [...stops].sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time) || a.position - b.position;
    if (a.time) return -1;
    if (b.time) return 1;
    return a.position - b.position;
  });
}

/* --------------------------------------- Prontidão ---------------------------------------- */

export interface ReadinessPart {
  percent: number;
}

/** Média simples das áreas; sem nenhuma área, 0. */
export function overallReadiness(parts: readonly ReadinessPart[]): number {
  if (parts.length === 0) return 0;
  return Math.round(parts.reduce((sum, p) => sum + p.percent, 0) / parts.length);
}

export interface MyStep {
  key: string;
  label: string;
  done: boolean;
  tab: PanelTab;
}

/** Andamento pessoal: o que já está resolvido e o que ainda falta, na ordem dos passos. */
export function myProgress(steps: readonly MyStep[]): { percent: number; pending: MyStep[] } {
  return {
    percent: percentOf(steps.filter((s) => s.done).length, steps.length),
    pending: steps.filter((s) => !s.done),
  };
}
