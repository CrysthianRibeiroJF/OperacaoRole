import { describe, expect, it } from 'vitest';
import { evaluateQuorum, isValidQuorum } from './quorum';
import { can, drawRoles, type Actor } from './permissions';
import { isContestable, depositReminderTimes } from './schedule';

const now = new Date('2026-11-01T12:00:00Z');
const future = new Date('2026-11-03T12:00:00Z');
const past = new Date('2026-10-31T12:00:00Z');

describe('evaluateQuorum', () => {
  it('confirma ao atingir o quórum (RN-03)', () => {
    const r = evaluateQuorum({
      status: 'open',
      quorum: 3,
      confirmedCount: 3,
      responseDeadlineAt: future,
      now,
    });
    expect(r).toMatchObject({ status: 'confirmed', changed: true });
  });

  it('segue aberta se falta gente e o prazo não venceu', () => {
    const r = evaluateQuorum({
      status: 'open',
      quorum: 3,
      confirmedCount: 2,
      responseDeadlineAt: future,
      now,
    });
    expect(r).toMatchObject({ status: 'open', changed: false, missing: 1 });
  });

  it('arquiva se o prazo vence sem quórum (RN-04)', () => {
    const r = evaluateQuorum({
      status: 'open',
      quorum: 3,
      confirmedCount: 2,
      responseDeadlineAt: past,
      now,
    });
    expect(r).toMatchObject({ status: 'archived', changed: true });
  });

  it('atingir o quórum no prazo vence a expiração', () => {
    const r = evaluateQuorum({
      status: 'open',
      quorum: 2,
      confirmedCount: 2,
      responseDeadlineAt: past,
      now,
    });
    expect(r.status).toBe('confirmed');
  });

  it('confirmado permanece confirmado abaixo do quórum e sinaliza (RN-07)', () => {
    const r = evaluateQuorum({
      status: 'confirmed',
      quorum: 3,
      confirmedCount: 2,
      responseDeadlineAt: past,
      now,
    });
    expect(r).toMatchObject({ status: 'confirmed', changed: false, belowQuorum: true });
  });

  it('valida a faixa de quórum 2 a 6 (RN-01)', () => {
    expect([1, 2, 6, 7, 2.5].map(isValidQuorum)).toEqual([false, true, true, false, false]);
  });
});

describe('can', () => {
  const base: Actor = { isOrganizer: false, roles: [], participation: 'in', vacantRoles: [] };

  it('observador só lê (RN-23)', () => {
    const observer: Actor = { ...base, participation: 'none' };
    expect(can(observer, 'expense.create')).toBe(false);
    expect(can(observer, 'roles.claim')).toBe(false);
    expect(can(observer, 'event.viewInternal')).toBe(false);
  });

  it('cada General só opera o próprio domínio', () => {
    const treasurer: Actor = { ...base, roles: ['treasury'] };
    expect(can(treasurer, 'settlement.close')).toBe(true);
    expect(can(treasurer, 'base.edit')).toBe(false);
    expect(can({ ...base, roles: ['base'] }, 'base.edit')).toBe(true);
    expect(can({ ...base, roles: ['base'] }, 'deposit.review')).toBe(false);
  });

  it('Idealizador cobre cargos vagos, mas não os ocupados (RN-25)', () => {
    const org: Actor = { ...base, isOrganizer: true, vacantRoles: ['treasury', 'base'] };
    expect(can(org, 'settlement.close')).toBe(true);
    expect(can({ ...org, vacantRoles: ['base'] }, 'settlement.close')).toBe(false);
  });

  it('só o Idealizador cancela e sorteia', () => {
    expect(can(base, 'event.cancel')).toBe(false);
    expect(can({ ...base, isOrganizer: true }, 'roles.draw')).toBe(true);
  });
});

describe('drawRoles', () => {
  it('distribui a carga, respeita limite e recusas (RN-21)', () => {
    const result = drawRoles({
      vacantRoles: ['base', 'fleet', 'supplies', 'treasury'],
      candidates: [
        { userId: 'a', roles: [], declined: ['base'] },
        { userId: 'b', roles: [], declined: [] },
      ],
      maxRolesPerUser: 2,
      random: () => 0,
    });
    expect(result).toHaveLength(4);
    expect(result.find((r) => r.role === 'base')?.userId).toBe('b');
    const perUser = result.reduce<Record<string, number>>(
      (acc, r) => ({ ...acc, [r.userId]: (acc[r.userId] ?? 0) + 1 }),
      {},
    );
    expect(Math.max(...Object.values(perUser))).toBeLessThanOrEqual(2);
  });

  it('deixa cargo vago se ninguém é elegível', () => {
    const result = drawRoles({
      vacantRoles: ['base'],
      candidates: [{ userId: 'a', roles: [], declined: ['base'] }],
    });
    expect(result).toEqual([]);
  });
});

describe('schedule', () => {
  it('janela de contestação de 72h (RN-39)', () => {
    const created = new Date('2026-11-01T00:00:00Z');
    expect(isContestable(created, new Date('2026-11-03T23:59:00Z'))).toBe(true);
    expect(isContestable(created, new Date('2026-11-04T00:01:00Z'))).toBe(false);
  });

  it('lembretes do sinal em 24h e 3h antes', () => {
    const [d24, d3] = depositReminderTimes(new Date('2026-11-10T20:00:00Z'));
    expect(d24!.toISOString()).toBe('2026-11-09T20:00:00.000Z');
    expect(d3!.toISOString()).toBe('2026-11-10T17:00:00.000Z');
  });
});
