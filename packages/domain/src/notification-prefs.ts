/** Categorias de aviso que a pessoa pode ligar ou desligar na central da conta. */
export const NOTIFICATION_CATEGORIES = [
  'quorum',
  'deposit',
  'roles',
  'supplies',
  'fleet',
  'expenses',
  'settlement',
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_CATEGORY_INFO: Record<
  NotificationCategory,
  { label: string; hint: string }
> = {
  quorum: {
    label: 'Quórum e confirmação',
    hint: 'Quando falta gente, o rolê vira oficial, é arquivado ou cancelado.',
  },
  deposit: {
    label: 'Sinal por Pix',
    hint: 'Janela aberta, prazo vencendo, comprovante aprovado ou recusado.',
  },
  roles: {
    label: 'Cargos e missões',
    hint: 'Sorteio de cargos e missões pendentes perto do rolê.',
  },
  supplies: { label: 'Mercado', hint: 'Lista pronta e itens para assumir.' },
  fleet: { label: 'Carros e caronas', hint: 'Novos passageiros e mudanças no seu carro.' },
  expenses: { label: 'Despesas', hint: 'Aprovações, recusas e contestações.' },
  settlement: {
    label: 'Acerto de contas',
    hint: 'Conta fechada, lembretes de pagamento e baixas. Evita calote.',
  },
};

/** Cada tipo de aviso pertence a uma categoria; tipos desconhecidos nunca são silenciados por engano. */
export function categoryOfKind(kind: string): NotificationCategory | null {
  const prefix = kind.split('.')[0];
  switch (prefix) {
    case 'event':
    case 'quorum':
      return 'quorum';
    case 'deposit':
      return 'deposit';
    case 'role':
      return 'roles';
    case 'supplies':
      return 'supplies';
    case 'fleet':
      return 'fleet';
    case 'expense':
      return 'expenses';
    case 'settlement':
      return 'settlement';
    default:
      return null;
  }
}

/** Para onde o aviso leva dentro do QG (aba do rolê). */
export function tabForKind(kind: string): 'base' | 'equipe' | 'mercado' | 'frotas' | 'cofre' {
  switch (categoryOfKind(kind)) {
    case 'deposit':
    case 'expenses':
    case 'settlement':
      return 'cofre';
    case 'roles':
      return 'equipe';
    case 'supplies':
      return 'mercado';
    case 'fleet':
      return 'frotas';
    default:
      return 'base';
  }
}
