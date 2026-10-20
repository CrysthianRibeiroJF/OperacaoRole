import { describe, expect, it } from 'vitest';
import {
  createEventSchema,
  createExpenseSchema,
  depositReviewSchema,
  phoneSchema,
} from './schemas';

const validEvent = {
  title: 'Praia',
  destination: 'Maresias',
  startDate: '2026-11-14',
  costCapCents: 12000,
};

describe('phoneSchema', () => {
  it.each([
    ['(11) 99999-0001', '5511999990001'],
    ['11999990001', '5511999990001'],
    ['+55 11 99999-0001', '5511999990001'],
    ['1133334444', '551133334444'],
  ])('normaliza %s', (input, expected) => {
    expect(phoneSchema.parse(input)).toBe(expected);
  });

  it('rejeita número curto', () => {
    expect(phoneSchema.safeParse('123').success).toBe(false);
  });
});

describe('createEventSchema', () => {
  it('aplica os padrões do PRD: quórum 3, prazo 48h, sem sinal', () => {
    const parsed = createEventSchema.parse(validEvent);
    expect(parsed).toMatchObject({ quorum: 3, responseHours: 48, requiresDeposit: false });
  });

  it('limita o quórum à faixa 2–6 (RN-01)', () => {
    expect(createEventSchema.safeParse({ ...validEvent, quorum: 1 }).success).toBe(false);
    expect(createEventSchema.safeParse({ ...validEvent, quorum: 7 }).success).toBe(false);
    expect(createEventSchema.safeParse({ ...validEvent, quorum: 6 }).success).toBe(true);
  });

  it('exige valor do sinal quando o sinal é obrigatório', () => {
    expect(createEventSchema.safeParse({ ...validEvent, requiresDeposit: true }).success).toBe(
      false,
    );
    expect(
      createEventSchema.safeParse({
        ...validEvent,
        requiresDeposit: true,
        depositCents: 5000,
        pixKey: 'a@b.com',
      }).success,
    ).toBe(true);
  });

  it('não aceita data final antes da inicial', () => {
    expect(createEventSchema.safeParse({ ...validEvent, endDate: '2026-11-01' }).success).toBe(
      false,
    );
  });

  it('não aceita dinheiro fracionado (sempre centavos inteiros)', () => {
    expect(createEventSchema.safeParse({ ...validEvent, costCapCents: 120.5 }).success).toBe(false);
  });
});

describe('createExpenseSchema', () => {
  const base = { description: 'Gelo', category: 'food', amountCents: 1000 };

  it('cota custom exige participantes', () => {
    expect(createExpenseSchema.safeParse({ ...base, quota: 'custom' }).success).toBe(false);
    expect(
      createExpenseSchema.safeParse({ ...base, quota: 'custom', customParticipantIds: ['a'] })
        .success,
    ).toBe(true);
  });
});

describe('depositReviewSchema', () => {
  it('recusar exige motivo', () => {
    expect(depositReviewSchema.safeParse({ decision: 'reject' }).success).toBe(false);
    expect(depositReviewSchema.safeParse({ decision: 'reject', reason: 'ilegível' }).success).toBe(
      true,
    );
    expect(depositReviewSchema.safeParse({ decision: 'approve' }).success).toBe(true);
  });
});
