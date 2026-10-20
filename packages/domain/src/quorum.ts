/** RN-01 a RN-07: motor de massa crítica ("as 3 andorinhas"). */
export type EventStatus = 'open' | 'confirmed' | 'archived' | 'cancelled' | 'closed';

export const QUORUM_MIN = 2;
export const QUORUM_MAX = 6;
export const QUORUM_DEFAULT = 3;
export const RESPONSE_WINDOW_HOURS_DEFAULT = 48;

export interface QuorumInput {
  status: EventStatus;
  quorum: number;
  confirmedCount: number;
  responseDeadlineAt: Date;
  now: Date;
}

export interface QuorumResult {
  status: EventStatus;
  changed: boolean;
  /** RN-07: confirmado que perdeu gente e ficou abaixo do quórum — avisar o Idealizador. */
  belowQuorum: boolean;
  missing: number;
}

export function missingForQuorum(quorum: number, confirmedCount: number): number {
  return Math.max(0, quorum - confirmedCount);
}

export function evaluateQuorum(input: QuorumInput): QuorumResult {
  const { status, quorum, confirmedCount, responseDeadlineAt, now } = input;
  const missing = missingForQuorum(quorum, confirmedCount);

  if (status === 'open') {
    if (missing === 0) return { status: 'confirmed', changed: true, belowQuorum: false, missing };
    if (now.getTime() >= responseDeadlineAt.getTime()) {
      return { status: 'archived', changed: true, belowQuorum: false, missing };
    }
    return { status, changed: false, belowQuorum: false, missing };
  }

  return { status, changed: false, belowQuorum: status === 'confirmed' && missing > 0, missing };
}

export function isValidQuorum(quorum: number): boolean {
  return Number.isInteger(quorum) && quorum >= QUORUM_MIN && quorum <= QUORUM_MAX;
}
