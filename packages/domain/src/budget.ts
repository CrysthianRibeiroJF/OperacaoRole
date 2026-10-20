import type { Cents } from './money';

/**
 * Simulador de orçamento: custos fixos (casa) + estimativa do mercado, divididos pela turma.
 * Mais gente, menos por cabeça: é o incentivo para chamar mais amigos.
 */
export interface BudgetInput {
  fixedCents: Cents;
  suppliesCents: Cents;
  people: number;
}

/** Arredonda para cima: o grupo nunca fica devendo por causa de centavos. */
export function perPersonCents({ fixedCents, suppliesCents, people }: BudgetInput): Cents | null {
  if (!Number.isInteger(people) || people < 1) return null;
  return Math.ceil((fixedCents + suppliesCents) / people);
}

export interface BudgetPoint {
  people: number;
  perPersonCents: Cents;
}

export function budgetCurve(
  input: BudgetInput,
  extras: readonly number[] = [0, 1, 2, 3, 5],
): BudgetPoint[] {
  return extras
    .map((extra) => ({
      people: input.people + extra,
      value: perPersonCents({ ...input, people: input.people + extra }),
    }))
    .filter((p): p is { people: number; value: Cents } => p.value !== null)
    .map((p) => ({ people: p.people, perPersonCents: p.value }));
}
