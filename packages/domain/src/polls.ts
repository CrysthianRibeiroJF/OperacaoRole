/** Enquete de data e local (antes da proposta): quem tem mais votos vence; empate, o Idealizador desempata. */
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 6;

export interface PollTally {
  optionId: string;
  votes: number;
}

export interface PollOutcome {
  /** Opções com o maior número de votos (vazio se ninguém votou). */
  leaderIds: string[];
  topVotes: number;
  /** Há uma única opção na frente. */
  decided: boolean;
}

export function pollOutcome(tallies: readonly PollTally[]): PollOutcome {
  const topVotes = tallies.reduce((max, t) => Math.max(max, t.votes), 0);
  const leaderIds =
    topVotes === 0 ? [] : tallies.filter((t) => t.votes === topVotes).map((t) => t.optionId);
  return { leaderIds, topVotes, decided: leaderIds.length === 1 };
}

export type PollWinner =
  { ok: true; winnerId: string } | { ok: false; reason: 'CHOICE_REQUIRED' | 'INVALID_CHOICE' };

/**
 * Fecha a enquete. Maioria clara: vence ela, sem escolha. Empate: o Idealizador escolhe entre as
 * empatadas. Sem nenhum voto: escolhe qualquer opção.
 */
export function resolvePollWinner(tallies: readonly PollTally[], chosenId?: string): PollWinner {
  const { leaderIds, decided } = pollOutcome(tallies);
  const known = new Set(tallies.map((t) => t.optionId));
  if (chosenId !== undefined && !known.has(chosenId))
    return { ok: false, reason: 'INVALID_CHOICE' };

  if (decided) {
    const leader = leaderIds[0]!;
    if (chosenId !== undefined && chosenId !== leader)
      return { ok: false, reason: 'INVALID_CHOICE' };
    return { ok: true, winnerId: leader };
  }
  if (chosenId === undefined) return { ok: false, reason: 'CHOICE_REQUIRED' };
  if (leaderIds.length > 0 && !leaderIds.includes(chosenId))
    return { ok: false, reason: 'INVALID_CHOICE' };
  return { ok: true, winnerId: chosenId };
}
