import { describe, expect, it } from 'vitest';
import {
  computeSettlement,
  simplifyDebts,
  type RosterMember,
  type SettlementExpense,
} from './settlement';

const member = (userId: string, o: Partial<RosterMember> = {}): RosterMember => ({
  userId,
  drinksAlcohol: false,
  diet: 'omnivore',
  ...o,
});

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('computeSettlement', () => {
  it('divide a cota global igualmente e acerta com o pagador (RN-32)', () => {
    const r = computeSettlement({
      roster: [member('a'), member('b'), member('c')],
      expenses: [{ id: 'e1', payerId: 'a', amountCents: 9000, quota: 'global' }],
      deposits: [],
      treasurerId: 'c',
    });
    const net = Object.fromEntries(r.balances.map((b) => [b.userId, b.netCents]));
    expect(net).toEqual({ a: 6000, b: -3000, c: -3000 });
    expect(r.transfers).toEqual([
      { fromUserId: 'b', toUserId: 'a', amountCents: 3000 },
      { fromUserId: 'c', toUserId: 'a', amountCents: 3000 },
    ]);
  });

  it('cota etílica só cobra quem bebe (RN-33)', () => {
    const r = computeSettlement({
      roster: [
        member('a', { drinksAlcohol: true }),
        member('b'),
        member('c', { drinksAlcohol: true }),
      ],
      expenses: [{ id: 'e1', payerId: 'b', amountCents: 10000, quota: 'alcohol' }],
      deposits: [],
      treasurerId: 'b',
    });
    const cost = Object.fromEntries(r.balances.map((x) => [x.userId, x.costCents]));
    expect(cost).toEqual({ a: 5000, b: 0, c: 5000 });
  });

  it('separa carnívoros e vegetarianos (RN-34)', () => {
    const r = computeSettlement({
      roster: [member('a'), member('b', { diet: 'vegetarian' }), member('c')],
      expenses: [
        { id: 'carne', payerId: 'a', amountCents: 6000, quota: 'meat' },
        { id: 'veg', payerId: 'a', amountCents: 2000, quota: 'vegetarian' },
      ],
      deposits: [],
      treasurerId: 'a',
    });
    const cost = Object.fromEntries(r.balances.map((x) => [x.userId, x.costCents]));
    expect(cost).toEqual({ a: 3000, b: 2000, c: 3000 });
  });

  it('cota custom (veículo) divide só entre os ocupantes (RN-35)', () => {
    const r = computeSettlement({
      roster: [member('a'), member('b'), member('c'), member('d')],
      expenses: [
        {
          id: 'gas',
          payerId: 'a',
          amountCents: 8000,
          quota: 'custom',
          customParticipantIds: ['b', 'c'],
        },
      ],
      deposits: [],
      treasurerId: 'a',
    });
    const cost = Object.fromEntries(r.balances.map((x) => [x.userId, x.costCents]));
    expect(cost).toEqual({ a: 0, b: 4000, c: 4000, d: 0 });
  });

  it('abate o sinal e gera crédito quando ele excede o custo (RN-36)', () => {
    const r = computeSettlement({
      roster: [member('t'), member('a'), member('b')],
      expenses: [{ id: 'e1', payerId: 't', amountCents: 6000, quota: 'global' }],
      deposits: [
        { userId: 'a', amountCents: 5000 },
        { userId: 'b', amountCents: 1000 },
      ],
      treasurerId: 't',
    });
    const net = Object.fromEntries(r.balances.map((x) => [x.userId, x.netCents]));
    // Custo de 2000 para cada um. 'a' adiantou 5000 e recebe 3000; 'b' adiantou 1000 e deve 1000.
    // 't' pagou 6000, custa 2000 e segura 6000 de sinais alheios: 6000 - 2000 - 6000 = -2000.
    expect(net['a']).toBe(3000);
    expect(net['b']).toBe(-1000);
    expect(net['t']).toBe(-2000);
    expect(sum(Object.values(net))).toBe(0);
    expect(r.transfers).toEqual([
      { fromUserId: 't', toUserId: 'a', amountCents: 2000 },
      { fromUserId: 'b', toUserId: 'a', amountCents: 1000 },
    ]);
  });

  it('centavos residuais vão para o Tesoureiro (RN-37)', () => {
    const r = computeSettlement({
      roster: [member('a'), member('b'), member('t')],
      expenses: [{ id: 'e1', payerId: 'a', amountCents: 1000, quota: 'global' }],
      deposits: [],
      treasurerId: 't',
    });
    const cost = Object.fromEntries(r.balances.map((x) => [x.userId, x.costCents]));
    expect(cost).toEqual({ a: 333, b: 333, t: 334 });
    expect(sum(Object.values(cost))).toBe(1000);
  });

  it('sinaliza despesa sem beneficiários sem quebrar o resto', () => {
    const r = computeSettlement({
      roster: [member('a'), member('b')],
      expenses: [
        { id: 'x', payerId: 'a', amountCents: 500, quota: 'alcohol' },
        { id: 'y', payerId: 'a', amountCents: 400, quota: 'global' },
      ],
      deposits: [],
      treasurerId: 'a',
    });
    expect(r.issues).toEqual([{ expenseId: 'x', code: 'NO_BENEFICIARIES' }]);
    expect(r.totalExpensesCents).toBe(400);
  });

  it('invariante: soma dos saldos é zero e as transferências zeram todo mundo (RN-40)', () => {
    let seed = 42;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const quotas = ['global', 'alcohol', 'meat', 'vegetarian', 'custom'] as const;

    for (let round = 0; round < 200; round++) {
      const n = 2 + Math.floor(rnd() * 9);
      const roster = Array.from({ length: n }, (_, i) =>
        member(`u${i}`, {
          drinksAlcohol: rnd() > 0.4,
          diet: rnd() > 0.7 ? 'vegetarian' : 'omnivore',
        }),
      );
      const expenses: SettlementExpense[] = Array.from(
        { length: 1 + Math.floor(rnd() * 8) },
        (_, i) => ({
          id: `e${i}`,
          payerId: roster[Math.floor(rnd() * n)]!.userId,
          amountCents: 1 + Math.floor(rnd() * 50000),
          quota: quotas[Math.floor(rnd() * quotas.length)]!,
          customParticipantIds: roster.filter(() => rnd() > 0.5).map((m) => m.userId),
        }),
      );
      const deposits = roster
        .filter(() => rnd() > 0.5)
        .map((m) => ({ userId: m.userId, amountCents: 1000 + Math.floor(rnd() * 9000) }));
      const treasurerId = roster[Math.floor(rnd() * n)]!.userId;

      const r = computeSettlement({ roster, expenses, deposits, treasurerId });
      expect(sum(r.balances.map((b) => b.netCents))).toBe(0);

      const residual = new Map(r.balances.map((b) => [b.userId, b.netCents]));
      for (const t of r.transfers) {
        residual.set(t.fromUserId, (residual.get(t.fromUserId) ?? 0) + t.amountCents);
        residual.set(t.toUserId, (residual.get(t.toUserId) ?? 0) - t.amountCents);
      }
      expect([...residual.values()].every((v) => v === 0)).toBe(true);
      expect(r.transfers.length).toBeLessThanOrEqual(Math.max(0, r.balances.length - 1));
    }
  });
});

describe('simplifyDebts', () => {
  it('cadeia A→B→C vira A→C (RN-38)', () => {
    const t = simplifyDebts([
      { userId: 'a', netCents: -1000 },
      { userId: 'b', netCents: 0 },
      { userId: 'c', netCents: 1000 },
    ]);
    expect(t).toEqual([{ fromUserId: 'a', toUserId: 'c', amountCents: 1000 }]);
  });
});
