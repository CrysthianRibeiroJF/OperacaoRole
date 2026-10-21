import { describe, expect, it } from 'vitest';
import { buildIcs } from './ics';
import { splitByItems } from './items';
import { buildPixPayload, crc16, normalizePixKey } from './pix';
import { pollOutcome, resolvePollWinner } from './polls';
import { isLatePayment, reliabilityOf } from './reliability';
import { buildMissionReport, eventDays } from './report';
import { computeSettlement } from './settlement';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('enquete de data e local', () => {
  const t = (...votes: number[]) => votes.map((v, i) => ({ optionId: `o${i}`, votes: v }));

  it('maioria clara vence sem escolha', () => {
    expect(pollOutcome(t(1, 3, 2))).toMatchObject({ leaderIds: ['o1'], decided: true });
    expect(resolvePollWinner(t(1, 3, 2))).toEqual({ ok: true, winnerId: 'o1' });
  });

  it('empate exige que o Idealizador escolha entre as empatadas', () => {
    expect(resolvePollWinner(t(2, 2, 1))).toEqual({ ok: false, reason: 'CHOICE_REQUIRED' });
    expect(resolvePollWinner(t(2, 2, 1), 'o1')).toEqual({ ok: true, winnerId: 'o1' });
    expect(resolvePollWinner(t(2, 2, 1), 'o2')).toEqual({ ok: false, reason: 'INVALID_CHOICE' });
  });

  it('sem votos qualquer opção pode ser escolhida; opção desconhecida nunca', () => {
    expect(resolvePollWinner(t(0, 0))).toEqual({ ok: false, reason: 'CHOICE_REQUIRED' });
    expect(resolvePollWinner(t(0, 0), 'o1')).toEqual({ ok: true, winnerId: 'o1' });
    expect(resolvePollWinner(t(0, 0), 'x')).toEqual({ ok: false, reason: 'INVALID_CHOICE' });
  });

  it('com maioria clara não dá para contrariar o resultado', () => {
    expect(resolvePollWinner(t(5, 1), 'o1')).toEqual({ ok: false, reason: 'INVALID_CHOICE' });
  });
});

describe('Pix copia e cola', () => {
  it('o CRC16 bate com o exemplo oficial do manual do Banco Central', () => {
    const sample =
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
    expect(crc16(sample)).toBe('1D3D');
  });

  it('monta o texto com a chave, o valor em centavos exatos e CRC válido', () => {
    const payload = buildPixPayload({
      key: '123e4567-e12b-12d1-a456-426655440000',
      merchantName: 'João da Silva',
      merchantCity: 'São Sebastião',
      amountCents: 12_305,
      txid: 'ROLE-abc 123',
    });
    expect(payload).toContain('br.gov.bcb.pix0136123e4567');
    expect(payload).toContain('5406123.05');
    expect(payload).toContain('5913JOAO DA SILVA');
    expect(payload).toContain('6013SAO SEBASTIAO');
    expect(payload).toContain('0510ROLEabc123');
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)));
  });

  it('sem valor não inclui o campo de valor', () => {
    const payload = buildPixPayload({ key: 'a@b.com', merchantName: 'X', merchantCity: 'Y' });
    expect(payload).not.toContain('54');
    expect(payload).toContain('0503***');
  });

  it('normaliza chaves digitadas com máscara', () => {
    expect(normalizePixKey('(11) 99999-0001')).toBe('+5511999990001');
    expect(normalizePixKey('123.456.789-09')).toBe('12345678909');
    expect(normalizePixKey(' Fulano@Mail.com ')).toBe('fulano@mail.com');
    expect(normalizePixKey('123e4567-e12b-12d1-a456-426655440000')).toBe(
      '123e4567-e12b-12d1-a456-426655440000',
    );
  });

  it('recusa chave que não cabe no campo', () => {
    expect(() =>
      buildPixPayload({ key: 'x'.repeat(90), merchantName: 'A', merchantCity: 'B' }),
    ).toThrow();
  });
});

describe('conta por item', () => {
  const everyone = new Set(['a', 'b', 'c']);

  it('cada item é dividido só entre quem consumiu', () => {
    const shares = splitByItems(
      10_000,
      [
        { amountCents: 6000, consumerIds: ['a', 'b'] },
        { amountCents: 4000, consumerIds: ['c'] },
      ],
      everyone,
    )!;
    expect(shares).toEqual({ a: 3000, b: 3000, c: 4000 });
  });

  it('taxa e gorjeta são rateadas na proporção do consumo, sem perder centavo', () => {
    const shares = splitByItems(
      11_000,
      [
        { amountCents: 6000, consumerIds: ['a'] },
        { amountCents: 4000, consumerIds: ['b'] },
      ],
      everyone,
    )!;
    expect(shares).toEqual({ a: 6600, b: 4400 });
  });

  it('a soma é sempre o valor da despesa (200 cenários)', () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const ids = ['a', 'b', 'c', 'd', 'e'];
    for (let n = 0; n < 200; n++) {
      const items = Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => ({
        amountCents: 1 + Math.floor(rnd() * 9000),
        consumerIds: ids.filter(() => rnd() < 0.5),
      }));
      const total = sum(items.map((i) => i.amountCents)) + Math.floor(rnd() * 3000);
      const shares = splitByItems(total, items, new Set(ids));
      if (shares) expect(sum(Object.values(shares))).toBe(total);
    }
  });

  it('item sem dono e consumidor de fora do rateio viram sobra proporcional', () => {
    const shares = splitByItems(
      3000,
      [
        { amountCents: 1000, consumerIds: ['a'] },
        { amountCents: 1000, consumerIds: ['b'] },
        { amountCents: 1000, consumerIds: ['fora'] },
      ],
      new Set(['a', 'b']),
    )!;
    expect(sum(Object.values(shares))).toBe(3000);
    expect(shares).toEqual({ a: 1500, b: 1500 });
  });

  it('ninguém consumiu nada: sem rateio possível', () => {
    expect(splitByItems(1000, [{ amountCents: 500, consumerIds: [] }], everyone)).toBeNull();
  });

  it('itens acima do valor da despesa são recusados', () => {
    expect(() => splitByItems(500, [{ amountCents: 900, consumerIds: ['a'] }], everyone)).toThrow();
  });

  it('o motor mantém a soma dos saldos em zero com conta por item', () => {
    const roster = ['a', 'b', 'c'].map((userId) => ({
      userId,
      drinksAlcohol: false,
      diet: 'omnivore' as const,
    }));
    const shares = splitByItems(
      10_001,
      [
        { amountCents: 5000, consumerIds: ['a', 'b'] },
        { amountCents: 3333, consumerIds: ['b', 'c'] },
      ],
      new Set(['a', 'b', 'c']),
    );
    const r = computeSettlement({
      roster,
      treasurerId: 'c',
      deposits: [],
      expenses: [
        { id: 'e1', payerId: 'a', amountCents: 10_001, quota: 'custom', shares },
        { id: 'e2', payerId: 'b', amountCents: 9000, quota: 'global' },
      ],
    });
    expect(sum(r.balances.map((b) => b.netCents))).toBe(0);
    expect(r.issues).toEqual([]);
    expect(r.totalExpensesCents).toBe(19_001);
  });

  it('despesa por item sem partes válidas vira pendência, não cobra ninguém', () => {
    const r = computeSettlement({
      roster: [{ userId: 'a', drinksAlcohol: false, diet: 'omnivore' }],
      treasurerId: 'a',
      deposits: [],
      expenses: [{ id: 'e1', payerId: 'a', amountCents: 1000, quota: 'custom', shares: {} }],
    });
    expect(r.issues).toEqual([{ expenseId: 'e1', code: 'NO_BENEFICIARIES' }]);
  });
});

describe('Relatório de Missão', () => {
  it('conta os dias contando o primeiro e o último', () => {
    expect(eventDays('2026-11-14', null)).toBe(1);
    expect(eventDays('2026-11-14', '2026-11-16')).toBe(3);
  });

  it('agrega total, média, quem mais adiantou e a categoria líder', () => {
    const r = buildMissionReport({
      startDate: '2026-11-14',
      endDate: '2026-11-16',
      headcount: 4,
      expenses: [
        { description: 'Carne', category: 'food', amountCents: 40_000, paidBy: 'u1' },
        { description: 'Casa', category: 'lodging', amountCents: 80_000, paidBy: 'u2' },
        { description: 'Gelo', category: 'food', amountCents: 5_000, paidBy: 'u1' },
      ],
    });
    expect(r.totalCents).toBe(125_000);
    expect(r.perHeadCents).toBe(31_250);
    expect(r.perDayPerHeadCents).toBe(10_416);
    expect(r.topPayer).toEqual({ userId: 'u2', amountCents: 80_000 });
    expect(r.biggestExpense).toEqual({ description: 'Casa', amountCents: 80_000 });
    expect(r.topCategory).toEqual({ category: 'lodging', cents: 80_000 });
    expect(r.categories.map((c) => c.category)).toEqual(['lodging', 'food']);
  });

  it('rolê sem despesa não quebra', () => {
    const r = buildMissionReport({
      startDate: '2026-11-14',
      endDate: null,
      headcount: 0,
      expenses: [],
    });
    expect(r).toMatchObject({ totalCents: 0, perHeadCents: 0, topPayer: null, topCategory: null });
  });
});

describe('agenda (.ics)', () => {
  const ics = buildIcs({
    uid: 'abc',
    title: 'Bate e volta, Maresias',
    location: 'Maresias; SP',
    startDate: '2026-11-14',
    endDate: '2026-11-16',
    description: 'Linha 1\nLinha 2',
    url: 'https://role.app/c/ABC',
    now: new Date('2026-11-01T12:00:00Z'),
  });

  it('é um evento de dia inteiro com fim exclusivo e escapa o texto', () => {
    expect(ics).toContain('DTSTART;VALUE=DATE:20261114');
    expect(ics).toContain('DTEND;VALUE=DATE:20261117');
    expect(ics).toContain('DTSTAMP:20261101T120000Z');
    expect(ics).toContain('SUMMARY:Bate e volta\\, Maresias');
    expect(ics).toContain('LOCATION:Maresias\\; SP');
    expect(ics).toContain('DESCRIPTION:Linha 1\\nLinha 2');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('dobra linhas longas em até 75 bytes', () => {
    const long = buildIcs({
      uid: 'x',
      title: 'Á'.repeat(80),
      location: 'L',
      startDate: '2026-11-14',
      endDate: null,
      description: 'D',
      url: 'https://x',
      now: new Date('2026-11-01T12:00:00Z'),
    });
    for (const line of long.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });
});

describe('selo "Andorinha confiável"', () => {
  it('só premia quem tem histórico limpo; nunca rotula negativamente', () => {
    expect(reliabilityOf({ completed: 0, missedDeposits: 0, latePayments: 0 })).toBe('newcomer');
    expect(reliabilityOf({ completed: 1, missedDeposits: 0, latePayments: 0 })).toBeNull();
    expect(reliabilityOf({ completed: 3, missedDeposits: 0, latePayments: 0 })).toBe('trusted');
    expect(reliabilityOf({ completed: 3, missedDeposits: 1, latePayments: 0 })).toBeNull();
    expect(reliabilityOf({ completed: 3, missedDeposits: 0, latePayments: 1 })).toBeNull();
  });

  it('atraso é pagar depois do prazo ou seguir devendo depois dele', () => {
    const closed = new Date('2026-11-20T12:00:00Z');
    const now = new Date('2026-12-05T12:00:00Z');
    expect(isLatePayment(closed, new Date('2026-11-25T12:00:00Z'), now)).toBe(false);
    expect(isLatePayment(closed, new Date('2026-12-01T12:00:00Z'), now)).toBe(true);
    expect(isLatePayment(closed, null, now)).toBe(true);
    expect(isLatePayment(closed, null, new Date('2026-11-22T12:00:00Z'))).toBe(false);
  });
});
