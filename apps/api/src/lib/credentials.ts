import { createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import {
  formatRecoveryCode,
  normalizeRecoveryCode,
  RECOVERY_ALPHABET,
  RECOVERY_CODE_LENGTH,
} from '@role/domain';

/** Senhas: scrypt com sal por usuário (nada de hash rápido). Formato: scrypt$<sal>$<hash>. */
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await derive(password, Buffer.from(saltHex, 'hex'));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Gasta o mesmo tempo de uma verificação real quando o celular não existe (evita revelar contas pelo tempo de resposta). */
let dummyHash: Promise<string> | null = null;
export async function burnPasswordTime(password: string): Promise<void> {
  dummyHash ??= hashPassword('operacao-role-dummy');
  await verifyPassword(password, await dummyHash);
}

/** Código de recuperação: 16 caracteres (~80 bits), mostrado uma única vez. */
export function generateRecoveryCode(): string {
  const raw = Array.from(
    { length: RECOVERY_CODE_LENGTH },
    () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)],
  ).join('');
  return formatRecoveryCode(raw);
}

/** Com tanta entropia, HMAC com o segredo do servidor basta (e permite comparar em tempo constante). */
export function hashRecoveryCode(secret: string, code: string): string {
  return createHmac('sha256', secret).update(normalizeRecoveryCode(code)).digest('hex');
}

export function recoveryCodeMatches(secret: string, code: string, storedHash: string): boolean {
  const a = Buffer.from(hashRecoveryCode(secret, code), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
