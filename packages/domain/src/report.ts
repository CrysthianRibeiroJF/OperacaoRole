import type { Cents } from './money';

/** Relatório de Missão: números do rolê para o cartão compartilhável. Só agrega, não expõe saldo de ninguém. */
export interface ReportExpense {
  description: string;
  category: string;
  amountCents: Cents;
  paidBy: string;
}

export interface MissionReportInput {
  startDate: string;
  endDate: string | null;
  headcount: number;
  expenses: readonly ReportExpense[];
}

export interface MissionReport {
  days: number;
  headcount: number;
  totalCents: Cents;
  /** Média por pessoa (arredondada para baixo). */
  perHeadCents: Cents;
  perDayPerHeadCents: Cents;
  expenseCount: number;
  /** Quem mais adiantou dinheiro pelo grupo. */
  topPayer: { userId: string; amountCents: Cents } | null;
  biggestExpense: { description: string; amountCents: Cents } | null;
  topCategory: { category: string; cents: Cents } | null;
  categories: { category: string; cents: Cents }[];
}

const DAY_MS = 86_400_000;

/** Dias do rolê, contando o primeiro e o último. */
export function eventDays(startDate: string, endDate: string | null): number {
  if (!endDate) return 1;
  const span = (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / DAY_MS;
  return Math.max(1, Math.round(span) + 1);
}

export function buildMissionReport(input: MissionReportInput): MissionReport {
  const days = eventDays(input.startDate, input.endDate);
  const headcount = Math.max(1, input.headcount);
  const totalCents = input.expenses.reduce((sum, e) => sum + e.amountCents, 0);

  const paid = new Map<string, Cents>();
  const byCategory = new Map<string, Cents>();
  for (const e of input.expenses) {
    paid.set(e.paidBy, (paid.get(e.paidBy) ?? 0) + e.amountCents);
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amountCents);
  }

  const payers = [...paid.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const categories = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([category, cents]) => ({ category, cents }));
  const biggest = [...input.expenses].sort(
    (a, b) => b.amountCents - a.amountCents || a.description.localeCompare(b.description),
  )[0];

  const perHeadCents = Math.floor(totalCents / headcount);
  return {
    days,
    headcount,
    totalCents,
    perHeadCents,
    perDayPerHeadCents: Math.floor(perHeadCents / days),
    expenseCount: input.expenses.length,
    topPayer: payers[0] ? { userId: payers[0][0], amountCents: payers[0][1] } : null,
    biggestExpense: biggest
      ? { description: biggest.description, amountCents: biggest.amountCents }
      : null,
    topCategory: categories[0] ?? null,
    categories,
  };
}
