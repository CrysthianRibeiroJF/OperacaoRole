/** Arquivo de calendário (.ics, RFC 5545) para o rolê confirmado entrar na agenda do celular. */
export interface IcsInput {
  uid: string;
  title: string;
  location: string;
  /** AAAA-MM-DD. */
  startDate: string;
  endDate: string | null;
  description: string;
  url: string;
  now: Date;
}

const escapeText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Linhas do .ics têm no máximo 75 bytes; o excedente continua na linha seguinte, com um espaço. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) {
      out.push(current);
      current = ' ';
      bytes = 1;
    }
    current += char;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n');
}

const compactDate = (iso: string) => iso.replace(/-/g, '');

/** Dia final do evento de dia inteiro é exclusivo no iCalendar: soma um dia. */
function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const stamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

export function buildIcs(input: IcsInput): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Operacao Role//PT-BR//',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${input.uid}@operacao-role`,
    `DTSTAMP:${stamp(input.now)}`,
    `DTSTART;VALUE=DATE:${compactDate(input.startDate)}`,
    `DTEND;VALUE=DATE:${compactDate(nextDay(input.endDate ?? input.startDate))}`,
    `SUMMARY:${escapeText(input.title)}`,
    `LOCATION:${escapeText(input.location)}`,
    `DESCRIPTION:${escapeText(input.description)}`,
    `URL:${input.url}`,
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(`Amanhã: ${input.title}`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
