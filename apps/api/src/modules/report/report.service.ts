import type { MissionReportDto } from '@role/contracts';
import { buildIcs, buildMissionReport, can } from '@role/domain';
import type { AppContext } from '../../context';
import { conflict, forbidden } from '../../errors';
import { formatBRL } from '../../lib/format';
import {
  buildActor,
  confirmedUserIds,
  loadParties,
  partyTotals,
  requireEvent,
  usersById,
} from '../events/event.queries';

/**
 * Relatório de Missão: totais e curiosidades do rolê, sem saldo individual. Fica disponível com o
 * rolê confirmado (parcial) e vira definitivo quando a conta é fechada.
 */
export async function getMissionReport(
  ctx: AppContext,
  userId: string,
  eventId: string,
): Promise<MissionReportDto> {
  const event = await requireEvent(ctx.db, eventId);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'event.viewInternal')) throw forbidden('Confirme presença para ver o relatório');
  if (event.status !== 'confirmed' && event.status !== 'closed') {
    throw conflict('EVENT_NOT_ACTIVE', 'O relatório existe depois que o rolê é confirmado');
  }

  const [expenses, memberIds] = await Promise.all([
    ctx.db
      .selectFrom('expenses')
      .select(['description', 'category', 'amount_cents', 'paid_by'])
      .where('event_id', '=', eventId)
      .where('status', '=', 'approved')
      .execute(),
    confirmedUserIds(ctx.db, eventId),
  ]);
  // O custo por cabeça divide pelas cotas que pagam (criança é isenta); "pessoas" mostra as cabeças.
  const { heads, units } = partyTotals(memberIds, await loadParties(ctx.db, eventId));
  const report = buildMissionReport({
    startDate: event.start_date,
    endDate: event.end_date,
    headcount: units,
    expenses: expenses.map((e) => ({
      description: e.description,
      category: e.category,
      amountCents: e.amount_cents,
      paidBy: e.paid_by,
    })),
  });

  const users = await usersById(ctx.db, [
    ...memberIds,
    ...(report.topPayer ? [report.topPayer.userId] : []),
  ]);
  const user = (id: string) => users.get(id) ?? { id, name: '—' };
  return {
    event: {
      id: event.id,
      title: event.title,
      destination: event.destination,
      startDate: event.start_date,
      endDate: event.end_date,
    },
    final: event.status === 'closed',
    days: report.days,
    headcount: heads,
    payingCount: report.headcount,
    totalCents: report.totalCents,
    perHeadCents: report.perHeadCents,
    perDayPerHeadCents: report.perDayPerHeadCents,
    expenseCount: report.expenseCount,
    topPayer: report.topPayer
      ? { user: user(report.topPayer.userId), amountCents: report.topPayer.amountCents }
      : null,
    biggestExpense: report.biggestExpense,
    topCategory: report.topCategory,
    categories: report.categories,
    participants: memberIds.map(user),
  };
}

/** Arquivo .ics do rolê, para a agenda do celular. Só quem está no rolê baixa. */
export async function getCalendarFile(
  ctx: AppContext,
  userId: string,
  eventId: string,
): Promise<{ filename: string; body: string }> {
  const event = await requireEvent(ctx.db, eventId);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'event.viewInternal')) throw forbidden('Confirme presença para salvar na agenda');
  if (event.status === 'cancelled' || event.status === 'archived') {
    throw conflict('EVENT_NOT_ACTIVE', 'Esse rolê não está mais de pé');
  }
  const web = ctx.config.PUBLIC_WEB_URL.replace(/\/$/, '');
  const body = buildIcs({
    uid: event.id,
    title: event.title,
    location: event.destination,
    startDate: event.start_date,
    endDate: event.end_date,
    description: `Operação Rolê · ${formatBRL(event.cost_cap_cents)} por pessoa.\nConvite: ${web}/c/${event.code}`,
    url: `${web}/role/${event.id}`,
    now: ctx.clock.now(),
  });
  return { filename: `role-${event.code}.ics`, body };
}
