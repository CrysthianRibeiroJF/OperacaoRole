import { assertCents, splitEvenly, type Cents } from './money';
import type { Companion } from './party';

/**
 * Motor de rateio (RN-32 a RN-41).
 * - Cotas: global, etílica, carnívora, vegetariana e custom (subconjunto explícito, ex.: veículo).
 * - O sinal pago é crédito de quem pagou e dívida do Tesoureiro, que o recebeu via Pix.
 * - Centavos residuais de cada divisão vão para o Tesoureiro (RN-37).
 * - Invariante (RN-40): a soma dos saldos é sempre zero.
 */
export type Diet = 'omnivore' | 'vegetarian';
export type Quota = 'global' | 'alcohol' | 'meat' | 'vegetarian' | 'custom';

export interface RosterMember {
  userId: string;
  drinksAlcohol: boolean;
  diet: Diet;
  /**
   * Acompanhantes da confirmação. Cada adulto é mais uma cota (com a própria bebida e dieta), cobrada
   * do responsável; criança é isenta. Os saldos seguem sendo por conta: só o responsável tem saldo.
   */
  companions?: readonly Companion[];
}

export interface SettlementExpense {
  id: string;
  payerId: string;
  amountCents: Cents;
  quota: Quota;
  /** Obrigatório quando quota === 'custom'. */
  customParticipantIds?: readonly string[];
  /**
   * Conta por item: custo exato de cada pessoa (veja `splitByItems`). Quando presente, vale no lugar
   * da cota e a soma deve ser o valor da despesa.
   */
  shares?: Readonly<Record<string, Cents>> | null;
}

export interface SettlementDeposit {
  userId: string;
  amountCents: Cents;
}

export interface SettlementInput {
  roster: readonly RosterMember[];
  expenses: readonly SettlementExpense[];
  deposits: readonly SettlementDeposit[];
  treasurerId: string;
}

export interface Balance {
  userId: string;
  /** O que a pessoa pagou do próprio bolso pelo grupo. */
  paidCents: Cents;
  /** Sinal que a pessoa já adiantou ao Tesoureiro. */
  depositCents: Cents;
  /** Quanto o consumo/cotas dela custou. */
  costCents: Cents;
  /** Sinais de terceiros que estão com esta pessoa (só o Tesoureiro). */
  heldDepositsCents: Cents;
  /** > 0: tem a receber. < 0: deve pagar. */
  netCents: Cents;
}

export interface Transfer {
  fromUserId: string;
  toUserId: string;
  amountCents: Cents;
}

export interface SettlementIssue {
  expenseId: string;
  code: 'NO_BENEFICIARIES';
}

export interface SettlementResult {
  balances: Balance[];
  transfers: Transfer[];
  issues: SettlementIssue[];
  totalExpensesCents: Cents;
}

/** Uma cota de rateio: pertence a uma conta (o responsável) mas tem consumo próprio. */
interface Unit {
  ownerId: string;
  drinksAlcohol: boolean;
  diet: Diet;
}

/** Responsável e cada acompanhante adulto; criança fica de fora (isenta). */
function unitsOf(roster: readonly RosterMember[]): Unit[] {
  return roster.flatMap((m) => [
    { ownerId: m.userId, drinksAlcohol: m.drinksAlcohol, diet: m.diet },
    ...(m.companions ?? [])
      .filter((c) => c.kind === 'adult')
      .map((c) => ({ ownerId: m.userId, drinksAlcohol: c.drinksAlcohol, diet: c.diet })),
  ]);
}

/** Dono de cada cota que entra na divisão, repetido uma vez por cota (casal = duas vezes). */
function resolveUnits(expense: SettlementExpense, roster: readonly RosterMember[]): string[] {
  const units = unitsOf(roster);
  const pick = (keep: (u: Unit) => boolean) => units.filter(keep).map((u) => u.ownerId);
  switch (expense.quota) {
    case 'global':
      return pick(() => true);
    case 'alcohol':
      return pick((u) => u.drinksAlcohol);
    case 'meat':
      return pick((u) => u.diet === 'omnivore');
    case 'vegetarian':
      return pick((u) => u.diet === 'vegetarian');
    case 'custom': {
      // "Pessoas específicas" escolhe confirmações: o casal divide o carro, a casa, a corrida.
      const wanted = new Set(expense.customParticipantIds ?? []);
      return pick((u) => wanted.has(u.ownerId));
    }
  }
}

/** Contas que entram na divisão (sem repetir): quem tem ao menos uma cota na despesa. */
export function resolveBeneficiaries(
  expense: SettlementExpense,
  roster: readonly RosterMember[],
): string[] {
  return [...new Set(resolveUnits(expense, roster))];
}

export function computeSettlement(input: SettlementInput): SettlementResult {
  const { roster, expenses, deposits, treasurerId } = input;
  const book = new Map<string, Balance>();
  const entry = (userId: string): Balance => {
    let b = book.get(userId);
    if (!b) {
      b = {
        userId,
        paidCents: 0,
        depositCents: 0,
        costCents: 0,
        heldDepositsCents: 0,
        netCents: 0,
      };
      book.set(userId, b);
    }
    return b;
  };

  roster.forEach((m) => entry(m.userId));
  entry(treasurerId);

  const issues: SettlementIssue[] = [];
  let totalExpensesCents = 0;

  for (const expense of expenses) {
    assertCents(expense.amountCents, `despesa ${expense.id}`);

    if (expense.shares) {
      const inRoster = new Set(roster.map((m) => m.userId));
      const owed = Object.entries(expense.shares).filter(([id, c]) => c > 0 && inRoster.has(id));
      if (owed.length === 0) {
        issues.push({ expenseId: expense.id, code: 'NO_BENEFICIARIES' });
        continue;
      }
      let assigned = 0;
      for (const [userId, cents] of owed) {
        assertCents(cents, `parte em ${expense.id}`);
        entry(userId).costCents += cents;
        assigned += cents;
      }
      if (assigned > expense.amountCents) {
        throw new RangeError(`as partes de ${expense.id} passam do valor da despesa`);
      }
      totalExpensesCents += expense.amountCents;
      entry(expense.payerId).paidCents += expense.amountCents;
      entry(treasurerId).costCents += expense.amountCents - assigned; // RN-37 (normalmente 0)
      continue;
    }

    const units = resolveUnits(expense, roster);
    if (units.length === 0) {
      issues.push({ expenseId: expense.id, code: 'NO_BENEFICIARIES' });
      continue;
    }
    totalExpensesCents += expense.amountCents;
    entry(expense.payerId).paidCents += expense.amountCents;

    const { share, remainder } = splitEvenly(expense.amountCents, units.length);
    for (const ownerId of units) entry(ownerId).costCents += share;
    entry(treasurerId).costCents += remainder; // RN-37
  }

  for (const deposit of deposits) {
    assertCents(deposit.amountCents, 'sinal');
    entry(deposit.userId).depositCents += deposit.amountCents;
    entry(treasurerId).heldDepositsCents += deposit.amountCents;
  }

  const balances = [...book.values()].sort((a, b) => a.userId.localeCompare(b.userId));
  for (const b of balances) {
    b.netCents = b.paidCents + b.depositCents - b.costCents - b.heldDepositsCents;
  }

  return { balances, transfers: simplifyDebts(balances), issues, totalExpensesCents };
}

/**
 * RN-38: casa maiores devedores com maiores credores. Gera no máximo (n-1) transferências,
 * sempre em ordem determinística para ser reproduzível e auditável.
 */
export function simplifyDebts(
  balances: readonly { userId: string; netCents: Cents }[],
): Transfer[] {
  const debtors = balances
    .filter((b) => b.netCents < 0)
    .map((b) => ({ userId: b.userId, left: -b.netCents }))
    .sort((a, b) => b.left - a.left || a.userId.localeCompare(b.userId));
  const creditors = balances
    .filter((b) => b.netCents > 0)
    .map((b) => ({ userId: b.userId, left: b.netCents }))
    .sort((a, b) => b.left - a.left || a.userId.localeCompare(b.userId));

  const transfers: Transfer[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d]!;
    const creditor = creditors[c]!;
    const amount = Math.min(debtor.left, creditor.left);
    if (amount > 0) {
      transfers.push({ fromUserId: debtor.userId, toUserId: creditor.userId, amountCents: amount });
    }
    debtor.left -= amount;
    creditor.left -= amount;
    if (debtor.left === 0) d++;
    if (creditor.left === 0) c++;
  }
  return transfers;
}
