import type { ExpenseCategory } from '@role/contracts';
import type { Quota } from '@role/domain';

export const QUOTA_LABELS: Record<Quota, string> = {
  global: 'Todo mundo',
  alcohol: 'Só quem bebe',
  meat: 'Só quem come carne',
  vegetarian: 'Só vegetarianos',
  custom: 'Pessoas específicas',
};

export const QUOTA_HINTS: Record<Quota, string> = {
  global: 'Casa, gelo, carvão, limpeza, temperos',
  alcohol: 'Cerveja, destilados, energéticos',
  meat: 'Churrasco e afins',
  vegetarian: 'Itens sem carne',
  custom: 'Ex.: gasolina e pedágio de um carro',
};

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  food: 'Comida',
  drinks: 'Bebida',
  fuel: 'Combustível',
  toll: 'Pedágio',
  lodging: 'Hospedagem',
  cleaning: 'Limpeza',
  other: 'Outros',
};
