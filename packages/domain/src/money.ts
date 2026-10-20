/** Todo dinheiro no sistema é inteiro em centavos. Nunca use float para valores. */
export type Cents = number;

export function assertCents(value: number, label = 'valor'): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} deve ser um inteiro em centavos`);
  }
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatBRL(cents: Cents): string {
  return brl.format(cents / 100);
}

/** Divide `total` por `parts` sem perder centavos: devolve a cota base e o resto (< parts). */
export function splitEvenly(total: Cents, parts: number): { share: Cents; remainder: Cents } {
  if (!Number.isInteger(parts) || parts <= 0) throw new RangeError('parts deve ser > 0');
  assertCents(total);
  const share = Math.trunc(total / parts);
  return { share, remainder: total - share * parts };
}
