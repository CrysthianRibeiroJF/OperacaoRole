import { describe, expect, it } from 'vitest';
import { budgetCurve, perPersonCents } from './budget';
import {
  expenseCategoryFor,
  quotaForCategory,
  suggestSupplies,
  SUPPLY_CATEGORIES,
} from './supplies';

describe('suggestSupplies', () => {
  const list = suggestSupplies({ people: 10, drinkers: 6, vegetarians: 2, days: 2 });
  const byName = (name: string) => list.find((i) => i.name.startsWith(name))!;

  it('calcula carne só para quem come carne (0,4 kg por pessoa por dia)', () => {
    expect(byName('Carne').quantityLabel).toBe('6,4 kg'); // 8 pessoas × 0,4 × 2 dias
    expect(byName('Carne').estPriceCents).toBe(28800);
  });

  it('cerveja só para quem bebe e opções vegetarianas só se houver vegetarianos', () => {
    expect(byName('Cerveja').quantityLabel).toBe('72 un'); // 6 × 6 × 2
    expect(byName('Opções vegetarianas').category).toBe('veg');
  });

  it('não sugere o que ninguém consome', () => {
    const none = suggestSupplies({ people: 4, drinkers: 0, vegetarians: 0, days: 1 });
    expect(none.some((i) => i.category === 'drinks_alc')).toBe(false);
    expect(none.some((i) => i.category === 'veg')).toBe(false);
  });

  it('tolera entradas inválidas sem quebrar', () => {
    const safe = suggestSupplies({ people: 0, drinkers: 99, vegetarians: -3, days: 0 });
    expect(safe.length).toBeGreaterThan(0);
    expect(safe.every((i) => Number.isInteger(i.estPriceCents) && i.estPriceCents >= 0)).toBe(true);
  });
});

describe('categorias', () => {
  it('toda categoria tem cota e categoria de despesa', () => {
    for (const c of SUPPLY_CATEGORIES) {
      expect(quotaForCategory(c)).toBeTruthy();
      expect(expenseCategoryFor(c)).toBeTruthy();
    }
    expect(quotaForCategory('drinks_alc')).toBe('alcohol');
    expect(quotaForCategory('meat')).toBe('meat');
    expect(quotaForCategory('cleaning')).toBe('global');
  });
});

describe('orçamento', () => {
  it('divide arredondando para cima e cai conforme entra gente', () => {
    expect(perPersonCents({ fixedCents: 100000, suppliesCents: 50000, people: 4 })).toBe(37500);
    expect(perPersonCents({ fixedCents: 100001, suppliesCents: 0, people: 3 })).toBe(33334);
    const curve = budgetCurve({ fixedCents: 100000, suppliesCents: 50000, people: 5 });
    const values = curve.map((p) => p.perPersonCents);
    expect(values).toEqual([...values].sort((a, b) => b - a));
    expect(curve[0]).toEqual({ people: 5, perPersonCents: 30000 });
  });

  it('sem ninguém não há valor por cabeça', () => {
    expect(perPersonCents({ fixedCents: 1, suppliesCents: 1, people: 0 })).toBeNull();
  });
});
