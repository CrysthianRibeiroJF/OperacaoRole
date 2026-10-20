import { formatBRL } from '@role/domain';

export { formatBRL };

const TZ = 'America/Sao_Paulo';

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const day = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit' });

/** Texto para notificações (o servidor fala o fuso do Brasil). */
export const fmtDateTime = (iso: string | Date): string =>
  dateTime.format(new Date(iso)).replace(',', ' às');
export const fmtDay = (iso: string | Date): string => day.format(new Date(iso));
