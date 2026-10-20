export { formatBRL } from '@role/domain';

/** "120,50" ou "1.200,5" → centavos. Vazio/inválido → null. Nunca usa float para somar dinheiro. */
export function parseMoneyToCents(input: string): number | null {
  const clean = input.trim().replace(/[R$\s]/g, '');
  if (!clean) return null;
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole = '0', frac = ''] = normalized.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

const TZ = 'America/Sao_Paulo';
const shortDay = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const dateTime = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** "2026-11-14" → Date no meio-dia local, evitando o deslocamento de fuso. */
const fromDateOnly = (value: string) => new Date(`${value}T12:00:00`);

export function formatEventDates(start: string, end: string | null): string {
  const s = fromDateOnly(start);
  const label = `${weekday.format(s).replace('.', '')}, ${shortDay.format(s).replace('.', '')}`;
  if (!end || end === start) return label;
  return `${label} → ${shortDay.format(fromDateOnly(end)).replace('.', '')}`;
}

export const formatDateTime = (iso: string): string =>
  dateTime.format(new Date(iso)).replace(',', ' às');

export function timeLeft(iso: string, now = Date.now()): { expired: boolean; label: string } {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return { expired: true, label: 'encerrado' };
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return { expired: false, label: `${days}d ${hours}h` };
  if (hours > 0) return { expired: false, label: `${hours}h ${String(mins).padStart(2, '0')}min` };
  return { expired: false, label: `${Math.max(1, mins)}min` };
}

export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

export function formatPhone(digits: string): string {
  const d = digits.replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digits;
}
