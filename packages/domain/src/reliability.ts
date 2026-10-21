/**
 * "Andorinha confiável": selo discreto, visível só ao Idealizador. Só existe o lado positivo (ou a
 * indicação de "primeira vez"): ninguém ganha rótulo negativo nem é exposto ao grupo (D-005).
 */
export const TRUSTED_MIN_EVENTS = 2;
/** Prazo para pagar o acerto antes de contar como atraso (mesmo marco da cobrança D+7). */
export const PAYMENT_GRACE_DAYS = 7;

export interface ReliabilityStats {
  /** Rolês encerrados em que a pessoa estava confirmada. */
  completed: number;
  /** Vezes em que perdeu o prazo do sinal e voltou para a fila de espera. */
  missedDeposits: number;
  /** Acertos pagos depois do prazo ou ainda em aberto depois dele. */
  latePayments: number;
}

export type Reliability = 'trusted' | 'newcomer' | null;

export function reliabilityOf(stats: ReliabilityStats): Reliability {
  if (stats.completed === 0) return 'newcomer';
  if (
    stats.completed >= TRUSTED_MIN_EVENTS &&
    stats.missedDeposits === 0 &&
    stats.latePayments === 0
  ) {
    return 'trusted';
  }
  return null;
}

/** Pagou fora do prazo, ou segue devendo depois dele. */
export function isLatePayment(
  settlementClosedAt: Date,
  paidAt: Date | null,
  now: Date,
  graceDays = PAYMENT_GRACE_DAYS,
): boolean {
  const limit = settlementClosedAt.getTime() + graceDays * 86_400_000;
  return (paidAt ?? now).getTime() > limit;
}
