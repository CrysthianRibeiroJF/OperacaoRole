/** Calendário do "Chato Oficial" (RN-50 a RN-53). Funções puras: recebem datas, devolvem datas. */
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function depositReminderTimes(deadlineAt: Date): Date[] {
  return [24 * HOUR, 3 * HOUR].map((before) => new Date(deadlineAt.getTime() - before));
}

export function settlementReminderTimes(closedAt: Date): Date[] {
  return [3 * DAY, 7 * DAY].map((after) => new Date(closedAt.getTime() + after));
}

/** Alerta de cargo vago: 2 dias antes do início do rolê. */
export function vacantRoleAlertTime(startsAt: Date): Date {
  return new Date(startsAt.getTime() - 2 * DAY);
}

/** Janela de contestação de despesa: 72h (RN-39). */
export const CONTEST_WINDOW_HOURS = 72;

export function isContestable(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() <= CONTEST_WINDOW_HOURS * HOUR;
}
