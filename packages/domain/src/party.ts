import type { Diet } from './settlement';

/**
 * Acompanhantes (casal, criança): vinculados à confirmação de quem os leva, só para este rolê (não
 * têm conta nem histórico). Regras:
 * - o quórum conta só o responsável (uma andorinha), mas a casa conta cabeças (responsável + acompanhantes);
 * - o responsável paga por si e por cada acompanhante adulto (cota e sinal); criança é isenta;
 * - há limite por confirmação e, opcionalmente, capacidade da casa.
 */
export type CompanionKind = 'adult' | 'child';

export interface Companion {
  kind: CompanionKind;
  drinksAlcohol: boolean;
  diet: Diet;
}

/** Um acompanhante adulto por confirmação (o par); crianças têm teto por rolê, definido pelo Idealizador. */
export const MAX_ADULT_COMPANIONS = 1;
export const MAX_CHILDREN_HARD = 4;
export const DEFAULT_MAX_CHILDREN = 2;
export const MAX_CAPACITY = 500;

export interface PartyRules {
  allowCompanions: boolean;
  /** Crianças por confirmação (0 a MAX_CHILDREN_HARD). */
  maxChildren: number;
  /** Capacidade da casa em pessoas (cabeças); nulo = sem limite. */
  capacity: number | null;
}

export type PartyProblem = 'COMPANIONS_OFF' | 'TOO_MANY_ADULTS' | 'TOO_MANY_CHILDREN';

export const PARTY_PROBLEM_MESSAGES: Record<PartyProblem, string> = {
  COMPANIONS_OFF: 'O Idealizador não liberou acompanhantes neste rolê',
  TOO_MANY_ADULTS: 'Só dá para levar um acompanhante adulto por confirmação',
  TOO_MANY_CHILDREN: 'Passou do limite de crianças por confirmação neste rolê',
};

export const adultsOf = (companions: readonly Pick<Companion, 'kind'>[]): number =>
  companions.filter((c) => c.kind === 'adult').length;

export const childrenOf = (companions: readonly Pick<Companion, 'kind'>[]): number =>
  companions.filter((c) => c.kind === 'child').length;

/** Cotas que o responsável paga: ele mesmo e cada acompanhante adulto. Criança é isenta. */
export const payingUnits = (companions: readonly Pick<Companion, 'kind'>[]): number =>
  1 + adultsOf(companions);

/** Cabeças da confirmação: o responsável e todos os acompanhantes (crianças contam para a casa e os carros). */
export const headsOf = (companions: readonly unknown[]): number => 1 + companions.length;

export function checkParty(
  companions: readonly Pick<Companion, 'kind'>[],
  rules: Pick<PartyRules, 'allowCompanions' | 'maxChildren'>,
): PartyProblem | null {
  if (companions.length > 0 && !rules.allowCompanions) return 'COMPANIONS_OFF';
  if (adultsOf(companions) > MAX_ADULT_COMPANIONS) return 'TOO_MANY_ADULTS';
  if (childrenOf(companions) > Math.min(rules.maxChildren, MAX_CHILDREN_HARD)) {
    return 'TOO_MANY_CHILDREN';
  }
  return null;
}

/** Cabe na casa? `totalHeadsAfter` é o total de cabeças do rolê já com a mudança. */
export const fitsCapacity = (capacity: number | null, totalHeadsAfter: number): boolean =>
  capacity === null || totalHeadsAfter <= capacity;

/* ------------------------------------------- Camas ------------------------------------------- */

export interface RoomBeds {
  /** Camas de solteiro. */
  singles: number;
  /** Camas de casal: só um par de adultos (a mesma confirmação) ocupa. */
  doubles: number;
}

export interface BedParty {
  /** Adultos da confirmação (responsável + acompanhante adulto). Criança divide a cama de um adulto. */
  adults: number;
}

export interface BedAllocation {
  ok: boolean;
  singlesUsed: number;
  doublesUsed: number;
}

/**
 * Distribui as confirmações nas camas do quarto. Cada par de adultos ocupa uma cama de casal (se
 * houver) ou duas de solteiro; adulto sozinho ocupa uma de solteiro; criança divide a cama de um
 * adulto. Cama de casal nunca é dada a um adulto sozinho (evita estranhos na mesma cama).
 */
export function allocateBeds(room: RoomBeds, parties: readonly BedParty[]): BedAllocation {
  const pairs = parties.reduce((sum, p) => sum + Math.floor(p.adults / 2), 0);
  const alone = parties.reduce((sum, p) => sum + (p.adults % 2), 0);
  const doublesUsed = Math.min(pairs, room.doubles);
  const singlesUsed = alone + 2 * (pairs - doublesUsed);
  return { ok: singlesUsed <= room.singles, singlesUsed, doublesUsed };
}
