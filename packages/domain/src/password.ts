/**
 * Política de senha e código de recuperação. Funções puras: o servidor valida, a tela só orienta.
 * Sem canal externo (SMS/WhatsApp/e-mail), o acesso é celular + senha, e a recuperação é por um
 * código que a pessoa guarda no cadastro.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

const COMMON = new Set([
  '12345678',
  '123456789',
  '1234567890',
  '87654321',
  'senha123',
  'senha1234',
  'password',
  'password1',
  'qwertyui',
  'qwerty123',
  'abcd1234',
  'abc12345',
  '11111111',
  '00000000',
  'brasil123',
  'mudar123',
  'iloveyou',
]);

export type PasswordProblem = 'too-short' | 'too-long' | 'common' | 'repetitive' | 'same-as-phone';

export const PASSWORD_PROBLEM_MESSAGES: Record<PasswordProblem, string> = {
  'too-short': `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`,
  'too-long': `A senha pode ter no máximo ${PASSWORD_MAX} caracteres.`,
  common: 'Essa senha é muito comum. Escolha outra.',
  repetitive: 'Evite repetir o mesmo caractere ou uma sequência óbvia.',
  'same-as-phone': 'A senha não pode ser o seu celular.',
};

const digits = (s: string) => s.replace(/\D/g, '');

function isSequence(value: string): boolean {
  if (value.length < 6) return false;
  let up = true;
  let down = true;
  for (let i = 1; i < value.length; i++) {
    const diff = value.charCodeAt(i) - value.charCodeAt(i - 1);
    if (diff !== 1) up = false;
    if (diff !== -1) down = false;
  }
  return up || down;
}

export function checkPassword(password: string, phone = ''): PasswordProblem | null {
  if (password.length < PASSWORD_MIN) return 'too-short';
  if (password.length > PASSWORD_MAX) return 'too-long';
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return 'common';
  if (/^(.)\1+$/.test(password) || isSequence(lower)) return 'repetitive';
  const phoneDigits = digits(phone);
  if (
    phoneDigits &&
    (digits(password) === phoneDigits || digits(password) === phoneDigits.replace(/^55/, ''))
  ) {
    return 'same-as-phone';
  }
  return null;
}

/** 0 (fraca) a 4 (forte), só para o medidor da tela. Não substitui `checkPassword`. */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (checkPassword(password) !== null) return password.length === 0 ? 0 : 1;
  let score = 1;
  if (password.length >= 10) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  else if (password.length >= 14) score++;
  return Math.min(4, score) as 1 | 2 | 3 | 4;
}

export const STRENGTH_LABELS = ['', 'Fraca', 'Razoável', 'Boa', 'Forte'] as const;

/** Alfabeto sem 0/O, 1/I/L: o código é copiado à mão e lido em voz alta. */
export const RECOVERY_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** "k7m2 9qxa pd4t zw8r" → "K7M29QXAPD4TZW8R". */
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Formata 16 caracteres em 4 grupos: K7M2-9QXA-PD4T-ZW8R. */
export function formatRecoveryCode(normalized: string): string {
  return (normalized.match(/.{1,4}/g) ?? []).join('-');
}

export const RECOVERY_CODE_LENGTH = 16;

export function isValidRecoveryCodeShape(input: string): boolean {
  const code = normalizeRecoveryCode(input);
  return (
    code.length === RECOVERY_CODE_LENGTH && [...code].every((c) => RECOVERY_ALPHABET.includes(c))
  );
}
