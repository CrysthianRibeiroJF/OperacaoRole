import { assertCents, type Cents } from './money';

/**
 * Pix "copia e cola" estático (BR Code, padrão EMV do Banco Central). O app só monta o texto com a
 * chave e o valor certos; quem move o dinheiro é o banco de cada pessoa (D-003: sem custódia).
 */
const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

/** CRC16/CCITT-FALSE exigido no fim do BR Code. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Nome e cidade do BR Code: ASCII maiúsculo, sem acento, no tamanho máximo do padrão. */
function ascii(value: string, max: number, fallback: string): string {
  const clean = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
  return clean || fallback;
}

/**
 * Chaves digitadas com máscara viram o formato do Pix: telefone com +55, CPF/CNPJ só com números,
 * e-mail em minúsculas. O que não dá para ter certeza (11 dígitos soltos) segue como foi digitado.
 */
export function normalizePixKey(raw: string): string {
  const key = raw.trim();
  if (/^\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/.test(key) && /[()\-\s]/.test(key)) {
    return `+55${key.replace(/\D/g, '')}`;
  }
  if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(key) || /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(key)) {
    return key.replace(/\D/g, '');
  }
  if (key.includes('@')) return key.toLowerCase();
  return key;
}

export interface PixPayloadInput {
  key: string;
  merchantName: string;
  merchantCity: string;
  amountCents?: Cents;
  /** Identificador da cobrança (só letras e números, até 25). */
  txid?: string;
}

export function buildPixPayload(input: PixPayloadInput): string {
  const account = tlv('00', 'br.gov.bcb.pix') + tlv('01', normalizePixKey(input.key));
  if (account.length > 99) throw new RangeError('A chave Pix é longa demais');

  let payload = tlv('00', '01') + tlv('26', account) + tlv('52', '0000') + tlv('53', '986');
  if (input.amountCents !== undefined && input.amountCents > 0) {
    assertCents(input.amountCents, 'valor do Pix');
    // Sem ponto flutuante: reais e centavos saem direto do inteiro.
    const reais = Math.trunc(input.amountCents / 100);
    payload += tlv('54', `${reais}.${String(input.amountCents % 100).padStart(2, '0')}`);
  }
  const txid = (input.txid ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  payload +=
    tlv('58', 'BR') +
    tlv('59', ascii(input.merchantName, 25, 'RECEBEDOR')) +
    tlv('60', ascii(input.merchantCity, 15, 'BRASIL')) +
    tlv('62', tlv('05', txid)) +
    '6304';
  return payload + crc16(payload);
}
