import { describe, expect, it } from 'vitest';
import {
  centsToInput,
  formatPhone,
  initials,
  maskPhone,
  parseMoneyToCents,
  timeAgo,
  timeLeft,
} from './format';

describe('parseMoneyToCents', () => {
  it.each([
    ['120', 12000],
    ['120,5', 12050],
    ['1.200,50', 120050],
    ['R$ 64,50', 6450],
    ['0,99', 99],
    ['10.5', 1050],
  ])('converte %s', (input, expected) => {
    expect(parseMoneyToCents(input)).toBe(expected);
  });

  it.each(['', 'abc', '12,345', '1,2,3', '-5'])('rejeita %j', (input) => {
    expect(parseMoneyToCents(input)).toBeNull();
  });

  it('ida e volta com centsToInput', () => {
    expect(parseMoneyToCents(centsToInput(123456))).toBe(123456);
  });
});

describe('timeLeft', () => {
  const now = new Date('2026-11-01T12:00:00Z').getTime();
  it('formata dias, horas e minutos', () => {
    expect(timeLeft('2026-11-03T15:00:00Z', now).label).toBe('2d 3h');
    expect(timeLeft('2026-11-01T14:05:00Z', now).label).toBe('2h 05min');
    expect(timeLeft('2026-11-01T12:20:00Z', now).label).toBe('20min');
  });
  it('marca encerrado', () => {
    expect(timeLeft('2026-11-01T11:59:00Z', now)).toEqual({ expired: true, label: 'encerrado' });
  });
});

describe('helpers', () => {
  it('iniciais e telefone', () => {
    expect(initials('Maria da Silva')).toBe('MD');
    expect(formatPhone('5511999990001')).toBe('(11) 99999-0001');
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-11-10T12:00:00Z').getTime();
  it.each([
    ['2026-11-10T11:59:50Z', 'agora'],
    ['2026-11-10T11:55:00Z', 'há 5 min'],
    ['2026-11-10T09:00:00Z', 'há 3 h'],
    ['2026-11-09T09:00:00Z', 'ontem'],
    ['2026-11-06T12:00:00Z', 'há 4 dias'],
  ])('%s → %s', (iso, expected) => {
    expect(timeAgo(iso, now)).toBe(expected);
  });
});

describe('maskPhone', () => {
  it.each([
    ['1', '1'],
    ['11999', '(11) 999'],
    ['1133334444', '(11) 3333-4444'],
    ['11999990001', '(11) 99999-0001'],
    ['119999900019999', '(11) 99999-0001'],
  ])('%s → %s', (raw, expected) => {
    expect(maskPhone(raw)).toBe(expected);
  });
});
