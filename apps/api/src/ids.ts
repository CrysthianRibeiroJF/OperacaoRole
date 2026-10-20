import { randomBytes, randomUUID } from 'node:crypto';

export const newId = (): string => randomUUID();

/** Alfabeto sem caracteres ambíguos (0/O, 1/I/L) para o código curto do convite. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function newInviteCode(length = 8): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}
