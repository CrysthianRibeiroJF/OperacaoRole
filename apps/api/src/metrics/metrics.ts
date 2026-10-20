import type { Db } from '../context';

/**
 * Métricas do PRD (G1 a G5) calculadas direto do banco, sem ferramenta externa.
 * Servem para o beta: dizem se a tese (quórum, sinal, rateio sem calote) está funcionando.
 */
export interface ProductMetrics {
  generatedAt: string;
  totals: {
    events: number;
    confirmed: number;
    archived: number;
    cancelled: number;
    closed: number;
    users: number;
  };
  /** G2: das propostas que já chegaram ao prazo, quantas viraram rolê. */
  conversionRate: number | null;
  /** G1: mediana de horas entre criar a proposta e ela virar oficial. */
  medianHoursToConfirm: number | null;
  /** Sinal: dos confirmados que precisavam pagar, quantos estão com o sinal aprovado. */
  depositApprovedRate: number | null;
  /** G3: rolês confirmados em que ao menos 2 pessoas diferentes ocupam cargos. */
  rolesSharedRate: number | null;
  /** G4: dos acertos que já passaram de 7 dias, quantos foram pagos em até 7 dias. */
  settlementPaidIn7DaysRate: number | null;
  /** G5 (proxy): média de pessoas confirmadas além de quem criou, por rolê confirmado. */
  guestsPerConfirmedEvent: number | null;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const ratio = (num: number, den: number): number | null =>
  den === 0 ? null : Math.round((num / den) * 1000) / 1000;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return Math.round(value * 10) / 10;
}

export async function computeMetrics(db: Db, now: Date): Promise<ProductMetrics> {
  const [events, parts, roles, transfers, users] = await Promise.all([
    db.selectFrom('events').selectAll().execute(),
    db.selectFrom('participations').selectAll().where('response', '=', 'in').execute(),
    db.selectFrom('event_roles').select(['event_id', 'user_id', 'role']).execute(),
    db
      .selectFrom('settlement_transfers')
      .innerJoin('settlements', 'settlements.id', 'settlement_transfers.settlement_id')
      .select(['settlement_transfers.paid_at as paid_at', 'settlements.closed_at as closed_at'])
      .execute(),
    db.selectFrom('users').select('id').where('deleted_at', 'is', null).execute(),
  ]);

  const count = (status: string) => events.filter((e) => e.status === status).length;
  const reached = events.filter((e) => ['confirmed', 'closed'].includes(e.status));
  const decided = events.filter((e) => ['confirmed', 'closed', 'archived'].includes(e.status));

  const hoursToConfirm = reached
    .filter((e) => e.confirmed_at)
    .map((e) => (new Date(e.confirmed_at!).getTime() - new Date(e.created_at).getTime()) / HOUR);

  // Sinal: só rolês com janela aberta; o Tesoureiro (que segura o dinheiro) fica de fora da conta.
  let needed = 0;
  let approved = 0;
  for (const e of events.filter((x) => x.deposit_opened_at)) {
    const treasurer =
      roles.find((r) => r.event_id === e.id && r.role === 'treasury')?.user_id ?? e.organizer_id;
    for (const p of parts.filter((x) => x.event_id === e.id && x.user_id !== treasurer)) {
      needed++;
      if (p.deposit_status === 'approved') approved++;
    }
  }

  const rolesShared = reached.filter(
    (e) => new Set(roles.filter((r) => r.event_id === e.id).map((r) => r.user_id)).size >= 2,
  ).length;

  const dueTransfers = transfers.filter(
    (t) => now.getTime() - new Date(t.closed_at).getTime() >= 7 * DAY,
  );
  const paidInTime = dueTransfers.filter(
    (t) => t.paid_at && new Date(t.paid_at).getTime() - new Date(t.closed_at).getTime() <= 7 * DAY,
  ).length;

  const guests = reached.map(
    (e) => parts.filter((p) => p.event_id === e.id && p.user_id !== e.organizer_id).length,
  );

  return {
    generatedAt: now.toISOString(),
    totals: {
      events: events.length,
      confirmed: count('confirmed'),
      archived: count('archived'),
      cancelled: count('cancelled'),
      closed: count('closed'),
      users: users.length,
    },
    conversionRate: ratio(reached.length, decided.length),
    medianHoursToConfirm: median(hoursToConfirm),
    depositApprovedRate: ratio(approved, needed),
    rolesSharedRate: ratio(rolesShared, reached.length),
    settlementPaidIn7DaysRate: ratio(paidInTime, dueTransfers.length),
    guestsPerConfirmedEvent: guests.length
      ? Math.round((guests.reduce((s, n) => s + n, 0) / guests.length) * 10) / 10
      : null,
  };
}

const pct = (v: number | null) => (v === null ? 'sem dados' : `${Math.round(v * 100)}%`);

/** Texto para o terminal: cada métrica com a meta do PRD ao lado. */
export function formatMetrics(m: ProductMetrics): string {
  const lines = [
    `Métricas da Operação Rolê (${m.generatedAt})`,
    '',
    `Usuários: ${m.totals.users} · Rolês: ${m.totals.events} (confirmados ${m.totals.confirmed}, encerrados ${m.totals.closed}, arquivados ${m.totals.archived}, cancelados ${m.totals.cancelled})`,
    '',
    `G1  Tempo até confirmar (mediana) : ${m.medianHoursToConfirm === null ? 'sem dados' : m.medianHoursToConfirm + ' h'}   meta ≤ 24 h`,
    `G2  Conversão de propostas        : ${pct(m.conversionRate)}   meta ≥ 50%`,
    `    Sinal aprovado                : ${pct(m.depositApprovedRate)}   meta ≥ 80%`,
    `G3  Cargos divididos (≥ 2 pessoas): ${pct(m.rolesSharedRate)}   meta ≥ 70%`,
    `G4  Acerto pago em até 7 dias     : ${pct(m.settlementPaidIn7DaysRate)}   meta ≥ 90%`,
    `G5  Convidados por rolê (proxy)   : ${m.guestsPerConfirmedEvent ?? 'sem dados'}   meta ≥ 1,5`,
  ];
  return lines.join('\n');
}
