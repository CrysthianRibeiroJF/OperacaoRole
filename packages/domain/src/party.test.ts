import { describe, expect, it } from 'vitest';
import {
  allocateBeds,
  checkParty,
  fitsCapacity,
  headsOf,
  payingUnits,
  type Companion,
} from './party';
import { splitByItems } from './items';
import { computeSettlement, resolveBeneficiaries, type RosterMember } from './settlement';

const adult = (over: Partial<Companion> = {}): Companion => ({
  kind: 'adult',
  drinksAlcohol: false,
  diet: 'omnivore',
  ...over,
});
const child = (): Companion => ({ kind: 'child', drinksAlcohol: false, diet: 'omnivore' });
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

const member = (userId: string, over: Partial<RosterMember> = {}): RosterMember => ({
  userId,
  drinksAlcohol: false,
  diet: 'omnivore',
  ...over,
});

describe('acompanhantes: cotas e cabeças', () => {
  it('o responsável paga por si e pelo adulto; criança é isenta mas conta como cabeça', () => {
    expect(payingUnits([])).toBe(1);
    expect(payingUnits([adult()])).toBe(2);
    expect(payingUnits([adult(), child(), child()])).toBe(2);
    expect(payingUnits([child()])).toBe(1);
    expect(headsOf([])).toBe(1);
    expect(headsOf([adult(), child(), child()])).toBe(4);
  });

  it('respeita o teto de adultos, o de crianças e o interruptor do Idealizador', () => {
    const open = { allowCompanions: true, maxChildren: 2 };
    expect(checkParty([adult(), child(), child()], open)).toBeNull();
    expect(checkParty([adult(), adult()], open)).toBe('TOO_MANY_ADULTS');
    expect(checkParty([child(), child(), child()], open)).toBe('TOO_MANY_CHILDREN');
    expect(checkParty([child()], { allowCompanions: true, maxChildren: 0 })).toBe(
      'TOO_MANY_CHILDREN',
    );
    expect(checkParty([adult()], { allowCompanions: false, maxChildren: 2 })).toBe(
      'COMPANIONS_OFF',
    );
    expect(checkParty([], { allowCompanions: false, maxChildren: 2 })).toBeNull();
  });

  it('o teto de crianças nunca passa do limite absoluto, mesmo que a regra diga mais', () => {
    expect(
      checkParty([child(), child(), child(), child(), child()], {
        allowCompanions: true,
        maxChildren: 99,
      }),
    ).toBe('TOO_MANY_CHILDREN');
  });

  it('capacidade da casa conta cabeças; sem capacidade não há limite', () => {
    expect(fitsCapacity(null, 999)).toBe(true);
    expect(fitsCapacity(10, 10)).toBe(true);
    expect(fitsCapacity(10, 11)).toBe(false);
  });
});

describe('camas de casal e de solteiro', () => {
  it('casal ocupa cama de casal; sozinho, cama de solteiro; criança divide com um adulto', () => {
    expect(allocateBeds({ singles: 1, doubles: 1 }, [{ adults: 2 }, { adults: 1 }])).toEqual({
      ok: true,
      singlesUsed: 1,
      doublesUsed: 1,
    });
  });

  it('vários casais: cada um pega sua cama de casal; o que sobra usa duas de solteiro', () => {
    const room = { singles: 2, doubles: 1 };
    expect(allocateBeds(room, [{ adults: 2 }, { adults: 2 }])).toEqual({
      ok: true,
      singlesUsed: 2,
      doublesUsed: 1,
    });
    expect(allocateBeds(room, [{ adults: 2 }, { adults: 2 }, { adults: 2 }]).ok).toBe(false);
  });

  it('adulto sozinho nunca ocupa cama de casal', () => {
    expect(allocateBeds({ singles: 0, doubles: 2 }, [{ adults: 1 }]).ok).toBe(false);
  });

  it('quarto vazio cabe; casal sem nenhuma cama não cabe', () => {
    expect(allocateBeds({ singles: 0, doubles: 0 }, []).ok).toBe(true);
    expect(allocateBeds({ singles: 1, doubles: 0 }, [{ adults: 2 }]).ok).toBe(false);
  });
});

describe('rateio com acompanhantes', () => {
  it('cota global: o casal paga por dois, a criança não paga, e o responsável carrega a conta', () => {
    const r = computeSettlement({
      roster: [
        member('a', { companions: [adult(), child()] }), // 2 cotas
        member('b'), // 1 cota
        member('c'), // 1 cota
      ],
      expenses: [{ id: 'e1', payerId: 'b', amountCents: 8000, quota: 'global' }],
      deposits: [],
      treasurerId: 'c',
    });
    const cost = Object.fromEntries(r.balances.map((x) => [x.userId, x.costCents]));
    expect(cost).toEqual({ a: 4000, b: 2000, c: 2000 });
    expect(sum(r.balances.map((x) => x.netCents))).toBe(0);
  });

  it('bebida e dieta valem para cada pessoa do casal, não para a conta inteira', () => {
    const roster = [
      // Ele bebe, ela não; ele come carne, ela é vegetariana.
      member('a', {
        drinksAlcohol: true,
        companions: [adult({ drinksAlcohol: false, diet: 'vegetarian' })],
      }),
      member('b', { drinksAlcohol: true }),
    ];
    const run = (quota: 'alcohol' | 'meat' | 'vegetarian') =>
      Object.fromEntries(
        computeSettlement({
          roster,
          expenses: [{ id: 'e', payerId: 'b', amountCents: 6000, quota }],
          deposits: [],
          treasurerId: 'b',
        }).balances.map((x) => [x.userId, x.costCents]),
      );
    expect(run('alcohol')).toEqual({ a: 3000, b: 3000 }); // só ele e o b bebem
    expect(run('meat')).toEqual({ a: 3000, b: 3000 });
    expect(run('vegetarian')).toEqual({ a: 6000, b: 0 }); // só ela
  });

  it('"pessoas específicas" escolhe confirmações: o casal inteiro divide o carro', () => {
    const roster = [member('a', { companions: [adult()] }), member('b'), member('c')];
    const r = computeSettlement({
      roster,
      expenses: [
        {
          id: 'gas',
          payerId: 'b',
          amountCents: 9000,
          quota: 'custom',
          customParticipantIds: ['a', 'b'],
        },
      ],
      deposits: [],
      treasurerId: 'c',
    });
    const cost = Object.fromEntries(r.balances.map((x) => [x.userId, x.costCents]));
    expect(cost).toEqual({ a: 6000, b: 3000, c: 0 });
    expect(
      resolveBeneficiaries(
        { id: 'x', payerId: 'a', amountCents: 1, quota: 'custom', customParticipantIds: ['a'] },
        roster,
      ),
    ).toEqual(['a']);
  });

  it('o resto da divisão vai para o Tesoureiro e a soma dos saldos segue zero (300 cenários)', () => {
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let n = 0; n < 300; n++) {
      const roster = ['a', 'b', 'c', 'd'].map((id) =>
        member(id, {
          drinksAlcohol: rnd() < 0.5,
          diet: rnd() < 0.3 ? 'vegetarian' : 'omnivore',
          companions: [
            ...(rnd() < 0.5
              ? [
                  adult({
                    drinksAlcohol: rnd() < 0.5,
                    diet: rnd() < 0.3 ? 'vegetarian' : 'omnivore',
                  }),
                ]
              : []),
            ...(rnd() < 0.4 ? [child()] : []),
          ],
        }),
      );
      const quotas = ['global', 'alcohol', 'meat', 'vegetarian', 'custom'] as const;
      const expenses = Array.from({ length: 1 + Math.floor(rnd() * 4) }, (_, i) => ({
        id: `e${i}`,
        payerId: ['a', 'b', 'c', 'd'][Math.floor(rnd() * 4)]!,
        amountCents: 1 + Math.floor(rnd() * 20_000),
        quota: quotas[Math.floor(rnd() * quotas.length)]!,
        customParticipantIds: ['a', 'b', 'c', 'd'].filter(() => rnd() < 0.5),
      }));
      const r = computeSettlement({
        roster,
        expenses,
        deposits: [{ userId: 'b', amountCents: 5000 }],
        treasurerId: 'a',
      });
      expect(sum(r.balances.map((x) => x.netCents))).toBe(0);
      const moved = sum(r.transfers.map((t) => t.amountCents));
      expect(moved).toBe(sum(r.balances.filter((b) => b.netCents > 0).map((b) => b.netCents)));
    }
  });

  it('sem acompanhantes nada muda: o rateio antigo continua igual', () => {
    const r = computeSettlement({
      roster: [member('a'), member('b'), member('c')],
      expenses: [{ id: 'e1', payerId: 'a', amountCents: 9000, quota: 'global' }],
      deposits: [],
      treasurerId: 'c',
    });
    expect(Object.fromEntries(r.balances.map((b) => [b.userId, b.netCents]))).toEqual({
      a: 6000,
      b: -3000,
      c: -3000,
    });
  });
});

describe('conta por item com casal', () => {
  const everyone = new Set(['a', 'b']);

  it('quem tem casal consome por dois: o item é dividido pelo número de cotas', () => {
    const weights = new Map([['a', 2]]);
    const shares = splitByItems(
      9000,
      [{ amountCents: 9000, consumerIds: ['a', 'b'] }],
      everyone,
      weights,
    )!;
    expect(shares).toEqual({ a: 6000, b: 3000 });
  });

  it('com pesos a soma continua sendo o valor da despesa (200 cenários)', () => {
    let seed = 5;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const ids = ['a', 'b', 'c', 'd'];
    for (let n = 0; n < 200; n++) {
      const weights = new Map(ids.map((id) => [id, 1 + Math.floor(rnd() * 2)]));
      const items = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => ({
        amountCents: 1 + Math.floor(rnd() * 9000),
        consumerIds: ids.filter(() => rnd() < 0.6),
      }));
      const total = sum(items.map((i) => i.amountCents)) + Math.floor(rnd() * 2000);
      const shares = splitByItems(total, items, new Set(ids), weights);
      if (shares) expect(sum(Object.values(shares))).toBe(total);
    }
  });

  it('sem pesos é igual à divisão antiga (o resto vai para os primeiros ids)', () => {
    const shares = splitByItems(
      1000,
      [{ amountCents: 1000, consumerIds: ['a', 'b', 'c'] }],
      new Set(['a', 'b', 'c']),
    )!;
    expect(shares).toEqual({ a: 334, b: 333, c: 333 });
  });
});
