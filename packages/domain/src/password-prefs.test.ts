import { describe, expect, it } from 'vitest';
import { categoryOfKind, NOTIFICATION_CATEGORIES, tabForKind } from './notification-prefs';
import {
  checkPassword,
  formatRecoveryCode,
  isValidRecoveryCodeShape,
  normalizeRecoveryCode,
  passwordStrength,
} from './password';

describe('checkPassword', () => {
  it.each([
    ['abc', 'too-short'],
    ['12345678', 'common'],
    ['Senha123', 'common'],
    ['Cachorro77', null],
    ['aaaaaaaa', 'repetitive'],
    ['abcdefgh', 'repetitive'],
    ['87654321', 'common'],
    ['x'.repeat(73), 'too-long'],
  ])('%s → %s', (password, expected) => {
    expect(checkPassword(password)).toBe(expected);
  });

  it('não aceita o próprio celular, com ou sem 55', () => {
    expect(checkPassword('11999990001', '5511999990001')).toBe('same-as-phone');
    expect(checkPassword('5511999990001', '5511999990001')).toBe('same-as-phone');
    expect(checkPassword('cachorro-azul-77', '5511999990001')).toBeNull();
  });
});

describe('passwordStrength', () => {
  it('cresce com tamanho e variedade e nunca dá nota a senha rejeitada', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('12345678')).toBe(1);
    expect(passwordStrength('cachorroazul')).toBeLessThan(passwordStrength('Cachorro-Azul-77!'));
    expect(passwordStrength('Cachorro-Azul-77!')).toBe(4);
  });
});

describe('código de recuperação', () => {
  it('normaliza e formata', () => {
    expect(normalizeRecoveryCode('k7m2-9qxa pd4t_zw8r')).toBe('K7M29QXAPD4TZW8R');
    expect(formatRecoveryCode('K7M29QXAPD4TZW8R')).toBe('K7M2-9QXA-PD4T-ZW8R');
  });

  it('valida o formato (16 caracteres, sem os ambíguos)', () => {
    expect(isValidRecoveryCodeShape('K7M2-9QXA-PD4T-ZW8R')).toBe(true);
    expect(isValidRecoveryCodeShape('K7M2-9QXA-PD4T')).toBe(false);
    expect(isValidRecoveryCodeShape('K7M2-9QXA-PD4T-ZW80')).toBe(false); // zero é ambíguo
  });
});

describe('categorias de aviso', () => {
  it('todo tipo conhecido cai numa categoria e leva a uma aba', () => {
    const kinds = [
      'event.confirmed',
      'quorum.almost',
      'deposit.reminder',
      'role.drawn',
      'supplies.list_ready',
      'fleet.passenger_joined',
      'expense.contested',
      'settlement.closed',
    ];
    for (const kind of kinds) {
      expect(NOTIFICATION_CATEGORIES).toContain(categoryOfKind(kind));
    }
    expect(categoryOfKind('algo.novo')).toBeNull();
    expect(tabForKind('settlement.paid')).toBe('cofre');
    expect(tabForKind('fleet.removed')).toBe('frotas');
    expect(tabForKind('supplies.list_ready')).toBe('mercado');
    expect(tabForKind('event.confirmed')).toBe('base');
  });
});
