import { assertCents, splitEvenly, type Cents } from './money';

/**
 * Conta por item ("a conta do bar"): cada item é dividido só entre quem o consumiu; o que sobra do
 * valor da despesa (taxa, gorjeta, itens sem dono) é rateado na proporção do consumo de cada um.
 * A soma devolvida é sempre igual ao valor da despesa, para não quebrar a invariante dos saldos.
 */
export interface ItemLine {
  amountCents: Cents;
  consumerIds: readonly string[];
}

/** `eligible` = quem está no rateio (roster). Devolve null se ninguém consumiu nada. */
export function splitByItems(
  totalCents: Cents,
  items: readonly ItemLine[],
  eligible: ReadonlySet<string>,
): Record<string, Cents> | null {
  assertCents(totalCents, 'despesa');
  const base = new Map<string, Cents>();

  for (const item of items) {
    assertCents(item.amountCents, 'item');
    const who = [...new Set(item.consumerIds)].filter((id) => eligible.has(id)).sort();
    if (who.length === 0) continue;
    const { share, remainder } = splitEvenly(item.amountCents, who.length);
    who.forEach((id, i) => base.set(id, (base.get(id) ?? 0) + share + (i < remainder ? 1 : 0)));
  }

  const claimed = [...base.values()].reduce((sum, v) => sum + v, 0);
  if (claimed === 0) return null;
  const extras = totalCents - claimed;
  if (extras < 0) throw new RangeError('Os itens passam do valor da despesa');

  // Maior resto: o que sobrou vai para quem tem a fração maior (desempate pelo id, reproduzível).
  const ids = [...base.keys()].sort();
  const parts = ids.map((id) => {
    const exact = extras * base.get(id)!;
    return { id, whole: Math.floor(exact / claimed), rest: exact % claimed };
  });
  let leftover = extras - parts.reduce((sum, p) => sum + p.whole, 0);
  const byRest = [...parts].sort((a, b) => b.rest - a.rest || a.id.localeCompare(b.id));
  const bonus = new Map<string, number>();
  for (const p of byRest) {
    if (leftover <= 0) break;
    bonus.set(p.id, 1);
    leftover--;
  }

  const shares: Record<string, Cents> = {};
  for (const p of parts) shares[p.id] = base.get(p.id)! + p.whole + (bonus.get(p.id) ?? 0);
  return shares;
}
