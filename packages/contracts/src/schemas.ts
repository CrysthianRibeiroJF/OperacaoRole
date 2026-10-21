import { z } from 'zod';
import {
  checkPassword,
  isValidRecoveryCodeShape,
  NOTIFICATION_CATEGORIES,
  PASSWORD_MAX,
  PASSWORD_PROBLEM_MESSAGES,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  QUORUM_DEFAULT,
  RIDE_PLAN_MODES,
  STOP_KINDS,
  QUORUM_MAX,
  QUORUM_MIN,
  SUPPLY_CATEGORIES,
} from '@role/domain';

/** Esquemas de entrada da API. A mesma fonte valida o servidor e tipa o front. */

/** Telefone brasileiro: aceita máscara, normaliza para 55 + DDD + número. */
export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .transform((digits) => (digits.length === 10 || digits.length === 11 ? `55${digits}` : digits))
  .refine((digits) => /^55\d{10,11}$/.test(digits), 'Telefone inválido. Use DDD + número.');

const cents = z.number().int().min(1).max(100_000_00);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD');
const isoDateTime = z.string().datetime({ offset: true });
const text = (max: number) => z.string().trim().max(max);

/** Senha nova: segue a política do domínio e informa o motivo em português. */
const newPassword = z
  .string()
  .max(PASSWORD_MAX, PASSWORD_PROBLEM_MESSAGES['too-long'])
  .superRefine((value, ctx) => {
    const problem = checkPassword(value);
    if (problem) ctx.addIssue({ code: 'custom', message: PASSWORD_PROBLEM_MESSAGES[problem] });
  });

export const registerSchema = z
  .object({
    phone: phoneSchema,
    name: text(60).min(2, 'Informe seu nome'),
    password: z.string().max(PASSWORD_MAX),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'Aceite os termos para criar a conta' }),
    }),
  })
  .superRefine((v, ctx) => {
    const problem = checkPassword(v.password, v.phone);
    if (problem) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: PASSWORD_PROBLEM_MESSAGES[problem],
      });
    }
  });

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, 'Informe a senha').max(200),
});

const recoveryCode = z
  .string()
  .refine(
    isValidRecoveryCodeShape,
    'O código de recuperação tem 16 caracteres (ex.: K7M2-9QXA-PD4T-ZW8R)',
  );

export const recoverSchema = z
  .object({ phone: phoneSchema, recoveryCode, newPassword: z.string().max(PASSWORD_MAX) })
  .superRefine((v, ctx) => {
    const problem = checkPassword(v.newPassword, v.phone);
    if (problem) {
      ctx.addIssue({
        code: 'custom',
        path: ['newPassword'],
        message: PASSWORD_PROBLEM_MESSAGES[problem],
      });
    }
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual').max(200),
  newPassword,
});

export const regenerateRecoverySchema = z.object({
  password: z.string().min(1, 'Informe a senha').max(200),
});

export const notificationPrefsSchema = z.object({
  categories: z.record(z.enum(NOTIFICATION_CATEGORIES), z.boolean()),
});

export const updateProfileSchema = z.object({
  name: text(60).min(2).optional(),
  pixKey: text(140).nullable().optional(),
});

export const createEventSchema = z
  .object({
    title: text(80).min(3),
    destination: text(120).min(2),
    startDate: isoDate,
    endDate: isoDate.optional(),
    costCapCents: cents,
    quorum: z.number().int().min(QUORUM_MIN).max(QUORUM_MAX).default(QUORUM_DEFAULT),
    responseHours: z.number().int().min(1).max(168).default(48),
    requiresDeposit: z.boolean().default(false),
    depositCents: cents.optional(),
    pixKey: text(140).min(3).optional(),
    /** Enquete encerrada que originou a proposta: avisa os votantes e liga os dois. */
    pollId: z.string().min(1).optional(),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    path: ['endDate'],
    message: 'A data final não pode ser antes da inicial',
  })
  .refine((v) => !v.requiresDeposit || v.depositCents !== undefined, {
    path: ['depositCents'],
    message: 'Informe o valor do sinal',
  });

export const respondSchema = z.object({
  response: z.enum(['in', 'out']),
  drinksAlcohol: z.boolean().optional(),
  diet: z.enum(['omnivore', 'vegetarian']).optional(),
});

export const preferencesSchema = z.object({
  drinksAlcohol: z.boolean(),
  diet: z.enum(['omnivore', 'vegetarian']),
});

export const roleKeySchema = z.enum(['base', 'fleet', 'supplies', 'treasury']);
export const roleActionSchema = z.object({ role: roleKeySchema });

export const baseInfoSchema = z.object({
  address: text(240).nullable(),
  wifiName: text(60).nullable(),
  wifiPassword: text(80).nullable(),
  gateCode: text(40).nullable(),
  checkoutTime: text(20).nullable(),
  houseRules: text(1000).nullable(),
  schedule: text(2000).nullable(),
});

export const depositConfigSchema = z.object({
  required: z.boolean(),
  amountCents: cents.optional(),
  pixKey: text(140).min(3).optional(),
  deadlineAt: isoDateTime.optional(),
});

export const depositReviewSchema = z
  .object({ decision: z.enum(['approve', 'reject']), reason: text(240).optional() })
  .refine((v) => v.decision === 'approve' || !!v.reason, {
    path: ['reason'],
    message: 'Explique o motivo da recusa',
  });

export const quotaSchema = z.enum(['global', 'alcohol', 'meat', 'vegetarian', 'custom']);
export const expenseCategorySchema = z.enum([
  'food',
  'drinks',
  'fuel',
  'toll',
  'lodging',
  'cleaning',
  'other',
]);

/** Item da conta por item: o que foi pedido, quanto custou e quem consumiu. */
export const expenseItemInputSchema = z.object({
  label: text(60).min(1, 'Dê um nome ao item'),
  amountCents: cents,
  consumerIds: z.array(z.string()).max(50).default([]),
});

export const createExpenseSchema = z
  .object({
    description: text(120).min(2),
    category: expenseCategorySchema,
    amountCents: cents,
    quota: quotaSchema,
    customParticipantIds: z.array(z.string()).max(50).optional(),
    /** Conta por item. Vale no lugar da cota: o servidor guarda a despesa como "pessoas específicas". */
    items: z.array(expenseItemInputSchema).min(1).max(30).optional(),
  })
  .refine((v) => v.items || v.quota !== 'custom' || (v.customParticipantIds?.length ?? 0) > 0, {
    path: ['customParticipantIds'],
    message: 'Escolha quem divide esta despesa',
  })
  .refine((v) => !v.items || v.items.reduce((s, i) => s + i.amountCents, 0) <= v.amountCents, {
    path: ['items'],
    message: 'Os itens passam do valor da despesa',
  });

export const toggleItemConsumerSchema = z.object({ userId: z.string().min(1).optional() });

export const expenseReviewSchema = z
  .object({ decision: z.enum(['approve', 'reject']), reason: text(240).optional() })
  .refine((v) => v.decision === 'approve' || !!v.reason, {
    path: ['reason'],
    message: 'Explique o motivo da recusa',
  });

export const contestSchema = z.object({ reason: text(240).min(3) });
export const resolveContestSchema = z.object({
  decision: z.enum(['keep', 'reject']),
  note: text(240).min(3),
});

export const budgetSchema = z.object({
  fixedCostsCents: z.number().int().min(0).max(100_000_00).nullable(),
});

export const supplyCategorySchema = z.enum(SUPPLY_CATEGORIES);
export const supplyCreateSchema = z.object({
  name: text(80).min(2),
  category: supplyCategorySchema,
  quantityLabel: text(30).min(1),
  estPriceCents: z.number().int().min(0).max(100_000_00).nullable().optional(),
});
export const supplyUpdateSchema = supplyCreateSchema.partial();
export const supplyDoneSchema = z.object({
  priceCents: z.number().int().min(1).max(100_000_00).optional(),
  createExpense: z.boolean().default(false),
});

export const vehicleSchema = z.object({
  label: text(60).min(2),
  departurePlace: text(80).nullable().optional(),
  departureTime: text(20).nullable().optional(),
  seats: z.number().int().min(0).max(12),
  cargoCapacity: z.number().int().min(0).max(20).default(0),
  cargoNote: text(120).nullable().optional(),
});
export const vehicleUpdateSchema = vehicleSchema.partial();
export const assignPassengerSchema = z.object({ userId: z.string().min(1) });
export const cargoCreateSchema = z.object({
  name: text(60).min(2),
  vehicleId: z.string().nullable().optional(),
});
export const cargoMoveSchema = z.object({ vehicleId: z.string().nullable() });

export const roomSchema = z.object({
  name: text(40).min(2, 'Dê um nome ao quarto'),
  beds: z.number().int().min(1).max(12),
});
export const roomUpdateSchema = roomSchema.partial();

export const transferOrganizerSchema = z.object({ userId: z.string().min(1) });

const httpUrl = z
  .string()
  .trim()
  .max(300)
  .url('Informe um link válido')
  .refine((u) => /^https?:\/\//i.test(u), 'O link precisa começar com http:// ou https://');

export const pollOptionSchema = z
  .object({
    label: text(60).min(2, 'Dê um nome à opção'),
    destination: text(120).min(2).optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
  })
  .refine((v) => !v.endDate || (!!v.startDate && v.endDate >= v.startDate), {
    path: ['endDate'],
    message: 'A data final não pode ser antes da inicial',
  });
export const createPollSchema = z.object({
  title: text(80).min(3, 'Dê um título à enquete'),
  options: z
    .array(pollOptionSchema)
    .min(POLL_MIN_OPTIONS, 'Coloque ao menos 2 opções')
    .max(POLL_MAX_OPTIONS, `No máximo ${POLL_MAX_OPTIONS} opções`),
});
export const pollVoteSchema = z.object({
  optionIds: z.array(z.string().min(1)).max(POLL_MAX_OPTIONS),
});
export const pollCloseSchema = z.object({ optionId: z.string().min(1).optional() });

export const crewSchema = z.object({ name: text(40).min(2, 'Dê um nome à tropa') });
export const inviteCrewSchema = z.object({ crewId: z.string().min(1) });

export const repeatEventSchema = z
  .object({
    startDate: isoDate,
    endDate: isoDate.optional(),
    title: text(80).min(3).optional(),
    responseHours: z.number().int().min(1).max(168).default(48),
    crewId: z.string().min(1).optional(),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    path: ['endDate'],
    message: 'A data final não pode ser antes da inicial',
  });

/** Pontos de encontro e paradas (General da Frota). Horário no formato HH:MM. */
export const stopSchema = z.object({
  kind: z.enum(STOP_KINDS),
  name: text(60).min(2, 'Dê um nome ao ponto'),
  address: text(160).nullable().optional(),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use o horário no formato HH:MM')
    .nullable()
    .optional(),
  note: text(160).nullable().optional(),
});
export const stopUpdateSchema = stopSchema.partial();

/** Como a pessoa vai quando não tem lugar no carro. `mode: null` limpa o plano. */
export const ridePlanSchema = z.object({
  mode: z.enum(RIDE_PLAN_MODES).nullable(),
  estCents: z.number().int().min(0).max(100_000_00).nullable().optional(),
});

export const packingItemSchema = z.object({
  label: text(60).min(2, 'Escreva o item'),
  scope: z.enum(['group', 'mine']),
});
export const packingCheckSchema = z.object({ checked: z.boolean() });
export const trackSchema = z.object({
  title: text(80).min(2, 'Informe a música'),
  url: httpUrl.optional(),
});
export const playlistSchema = z.object({ url: httpUrl.nullable() });

export const TRACKED_EVENTS = [
  'invite_viewed',
  'share_clicked',
  'signup_started',
  'install_shown',
  'install_accepted',
] as const;
export const trackEventSchema = z.object({
  name: z.enum(TRACKED_EVENTS),
  path: z.string().max(200).optional(),
});
export const clientErrorSchema = z.object({
  message: z.string().min(1).max(300),
  stack: z.string().max(2000).optional(),
  path: z.string().max(200).optional(),
});

export const deleteAccountSchema = z.object({ confirm: z.literal('EXCLUIR') });

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type RespondInput = z.infer<typeof respondSchema>;
export type BaseInfoInput = z.infer<typeof baseInfoSchema>;
export type DepositConfigInput = z.infer<typeof depositConfigSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
