import { assertCents, splitEvenly, type Cents } from './money';

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
}

export interface SettlementExpense {
  id: string;
  payerId: string;
  amountCents: Cents;
  quota: Quota;
  /** Obrigatório quando quota === 'custom'. */
  customParticipantIds?: readonly string[];
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

export function resolveBeneficiaries(
  expense: SettlementExpense,
  roster: readonly RosterMember[],
): string[] {
  switch (expense.quota) {
    case 'global':
      return roster.map((m) => m.userId);
    case 'alcohol':
      return roster.filter((m) => m.drinksAlcohol).map((m) => m.userId);
    case 'meat':
      return roster.filter((m) => m.diet === 'omnivore').map((m) => m.userId);
    case 'vegetarian':
      return roster.filter((m) => m.diet === 'vegetarian').map((m) => m.userId);
    case 'custom': {
      const wanted = new Set(expense.customParticipantIds ?? []);
      return roster.filter((m) => wanted.has(m.userId)).map((m) => m.userId);
    }
  }
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
    const beneficiaries = resolveBeneficiaries(expense, roster);
    if (beneficiaries.length === 0) {
      issues.push({ expenseId: expense.id, code: 'NO_BENEFICIARIES' });
      continue;
    }
    totalExpensesCents += expense.amountCents;
    entry(expense.payerId).paidCents += expense.amountCents;

    const { share, remainder } = splitEvenly(expense.amountCents, beneficiaries.length);
    for (const userId of beneficiaries) entry(userId).costCents += share;
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
