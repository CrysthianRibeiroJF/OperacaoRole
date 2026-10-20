import type { Cents } from './money';
import type { Quota } from './settlement';

/** Lista de compras: categorias, cota padrão de rateio e sugestão de quantidades. */
export const SUPPLY_CATEGORIES = [
  'meat',
  'veg',
  'drinks_alc',
  'drinks',
  'breakfast',
  'cleaning',
  'other',
] as const;
export type SupplyCategory = (typeof SUPPLY_CATEGORIES)[number];

export const SUPPLY_CATEGORY_LABELS: Record<SupplyCategory, string> = {
  meat: 'Churrasco',
  veg: 'Vegetariano',
  drinks_alc: 'Bebidas alcoólicas',
  drinks: 'Bebidas sem álcool',
  breakfast: 'Café da manhã',
  cleaning: 'Limpeza e descartáveis',
  other: 'Outros',
};

/** Cota (RN-32 a RN-35) que cada categoria usa por padrão ao virar despesa. */
export function quotaForCategory(category: SupplyCategory): Quota {
  switch (category) {
    case 'meat':
      return 'meat';
    case 'veg':
      return 'vegetarian';
    case 'drinks_alc':
      return 'alcohol';
    default:
      return 'global';
  }
}

export type ExpenseCategoryKey =
  'food' | 'drinks' | 'fuel' | 'toll' | 'lodging' | 'cleaning' | 'other';

export function expenseCategoryFor(category: SupplyCategory): ExpenseCategoryKey {
  switch (category) {
    case 'meat':
    case 'veg':
    case 'breakfast':
      return 'food';
    case 'drinks_alc':
    case 'drinks':
      return 'drinks';
    case 'cleaning':
      return 'cleaning';
    default:
      return 'other';
  }
}

export interface SuggestInput {
  people: number;
  drinkers: number;
  vegetarians: number;
  days: number;
}

export interface SuggestedItem {
  name: string;
  category: SupplyCategory;
  quantityLabel: string;
  /** Estimativa do total do item, em centavos. */
  estPriceCents: Cents;
}

const decimal = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

/**
 * Sugere uma lista inicial a partir de pessoas, perfil de consumo e dias. São médias de mercado
 * para o General de Suprimentos editar, não verdade absoluta.
 */
export function suggestSupplies({
  people,
  drinkers,
  vegetarians,
  days,
}: SuggestInput): SuggestedItem[] {
  const p = Math.max(1, Math.floor(people));
  const d = Math.max(1, Math.floor(days));
  const drinkersN = Math.min(p, Math.max(0, Math.floor(drinkers)));
  const vegN = Math.min(p, Math.max(0, Math.floor(vegetarians)));
  const eaters = p - vegN;
  const items: SuggestedItem[] = [];

  if (eaters > 0) {
    const kg = 0.4 * eaters * d;
    items.push({
      name: 'Carne para o churrasco',
      category: 'meat',
      quantityLabel: `${decimal(kg)} kg`,
      estPriceCents: Math.round(kg * 4500),
    });
    const bread = eaters * d;
    items.push({
      name: 'Pão de alho',
      category: 'meat',
      quantityLabel: `${bread} un`,
      estPriceCents: bread * 400,
    });
  }
  const coal = Math.ceil(p * d * 0.4);
  items.push({
    name: 'Carvão',
    category: 'meat',
    quantityLabel: `${coal} kg`,
    estPriceCents: coal * 900,
  });

  if (vegN > 0) {
    const kg = 0.3 * vegN * d;
    items.push({
      name: 'Opções vegetarianas (hambúrguer, legumes)',
      category: 'veg',
      quantityLabel: `${decimal(kg)} kg`,
      estPriceCents: Math.round(kg * 3000),
    });
  }

  if (drinkersN > 0) {
    const cans = 6 * drinkersN * d;
    items.push({
      name: 'Cerveja (lata)',
      category: 'drinks_alc',
      quantityLabel: `${cans} un`,
      estPriceCents: cans * 450,
    });
    if (drinkersN >= 3) {
      const bottles = Math.ceil(drinkersN / 6) * d;
      items.push({
        name: 'Destilado (garrafa)',
        category: 'drinks_alc',
        quantityLabel: `${bottles} un`,
        estPriceCents: bottles * 6000,
      });
    }
  }

  const soda = 1.5 * p * d;
  items.push({
    name: 'Refrigerante e suco',
    category: 'drinks',
    quantityLabel: `${decimal(soda)} L`,
    estPriceCents: Math.round(soda * 400),
  });
  const water = 2 * p * d;
  items.push({
    name: 'Água',
    category: 'drinks',
    quantityLabel: `${decimal(water)} L`,
    estPriceCents: Math.round(water * 200),
  });
  const ice = 1.5 * p * d;
  items.push({
    name: 'Gelo',
    category: 'drinks',
    quantityLabel: `${decimal(ice)} kg`,
    estPriceCents: Math.round(ice * 150),
  });

  const rolls = 2 * p * d;
  items.push({
    name: 'Pão e frios',
    category: 'breakfast',
    quantityLabel: `${rolls} un`,
    estPriceCents: rolls * 150,
  });
  items.push({
    name: 'Café e leite',
    category: 'breakfast',
    quantityLabel: `${Math.ceil(d / 2)} kit`,
    estPriceCents: Math.ceil(d / 2) * 3500,
  });

  items.push({
    name: 'Copos e pratos descartáveis',
    category: 'cleaning',
    quantityLabel: `${p * d} un`,
    estPriceCents: p * d * 80,
  });
  items.push({
    name: 'Sacos de lixo e papel toalha',
    category: 'cleaning',
    quantityLabel: `${Math.ceil(p / 5)} kit`,
    estPriceCents: Math.ceil(p / 5) * 2500,
  });

  return items;
}
