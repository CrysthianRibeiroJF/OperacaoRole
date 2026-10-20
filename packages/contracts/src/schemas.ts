import { z } from 'zod';
import { QUORUM_DEFAULT, QUORUM_MAX, QUORUM_MIN } from '@role/domain';

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

export const otpRequestSchema = z.object({ phone: phoneSchema });
export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, 'O código tem 6 dígitos'),
  name: text(60).min(2).optional(),
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

export const createExpenseSchema = z
  .object({
    description: text(120).min(2),
    category: expenseCategorySchema,
    amountCents: cents,
    quota: quotaSchema,
    customParticipantIds: z.array(z.string()).max(50).optional(),
  })
  .refine((v) => v.quota !== 'custom' || (v.customParticipantIds?.length ?? 0) > 0, {
    path: ['customParticipantIds'],
    message: 'Escolha quem divide esta despesa',
  });

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

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type RespondInput = z.infer<typeof respondSchema>;
export type BaseInfoInput = z.infer<typeof baseInfoSchema>;
export type DepositConfigInput = z.infer<typeof depositConfigSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
