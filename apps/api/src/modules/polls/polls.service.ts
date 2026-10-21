import type { PollDto, PollSummaryDto } from '@role/contracts';
import { pollOutcome, resolvePollWinner } from '@role/domain';
import type { AppContext, Db } from '../../context';
import { conflict, forbidden, notFound, unprocessable } from '../../errors';
import { newId, newInviteCode } from '../../ids';
import { audit } from '../../lib/audit';
import { usersById } from '../events/event.queries';
import { notify } from '../notifications/notifications.service';

type Option = {
  label: string;
  destination?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
};

async function requirePollByCode(db: Db, code: string) {
  const poll = await db
    .selectFrom('polls')
    .selectAll()
    .where('code', '=', code.toUpperCase())
    .executeTakeFirst();
  if (!poll) throw notFound('Enquete não encontrada');
  return poll;
}

async function requirePoll(db: Db, id: string) {
  const poll = await db.selectFrom('polls').selectAll().where('id', '=', id).executeTakeFirst();
  if (!poll) throw notFound('Enquete não encontrada');
  return poll;
}

export async function createPoll(
  ctx: AppContext,
  userId: string,
  input: { title: string; options: Option[] },
): Promise<PollDto> {
  const now = ctx.clock.now();
  const id = newId();
  await ctx.db.transaction().execute(async (trx) => {
    let inserted = false;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      try {
        await trx
          .insertInto('polls')
          .values({
            id,
            code: newInviteCode(),
            organizer_id: userId,
            title: input.title,
            status: 'open',
            winner_option_id: null,
            event_id: null,
            created_at: now.toISOString(),
            closed_at: null,
          })
          .execute();
        inserted = true;
      } catch (err) {
        if (!(err instanceof Error) || !/UNIQUE.*polls\.code/i.test(err.message)) throw err;
      }
    }
    if (!inserted)
      throw conflict('CODE_COLLISION', 'Não foi possível gerar o link. Tente de novo.');

    await trx
      .insertInto('poll_options')
      .values(
        input.options.map((o, position) => ({
          id: newId(),
          poll_id: id,
          label: o.label,
          destination: o.destination ?? null,
          start_date: o.startDate ?? null,
          end_date: o.endDate ?? null,
          position,
        })),
      )
      .execute();
    await audit(trx, now, {
      eventId: null,
      actorId: userId,
      action: 'poll.created',
      entity: 'poll',
      entityId: id,
    });
  });
  return toDto(ctx, await requirePoll(ctx.db, id), userId);
}

async function toDto(
  ctx: AppContext,
  poll: Awaited<ReturnType<typeof requirePoll>>,
  userId: string | null,
) {
  const [options, votes, event] = await Promise.all([
    ctx.db
      .selectFrom('poll_options')
      .selectAll()
      .where('poll_id', '=', poll.id)
      .orderBy('position')
      .execute(),
    ctx.db.selectFrom('poll_votes').selectAll().where('poll_id', '=', poll.id).execute(),
    poll.event_id
      ? ctx.db
          .selectFrom('events')
          .select(['id', 'code'])
          .where('id', '=', poll.event_id)
          .executeTakeFirst()
      : Promise.resolve(undefined),
  ]);
  const users = await usersById(ctx.db, [poll.organizer_id, ...votes.map((v) => v.user_id)]);
  const user = (id: string) => users.get(id) ?? { id, name: '—' };

  const tallies = options.map((o) => ({
    optionId: o.id,
    votes: votes.filter((v) => v.option_id === o.id).length,
  }));
  const { leaderIds } = pollOutcome(tallies);

  const dto: PollDto = {
    id: poll.id,
    code: poll.code,
    title: poll.title,
    status: poll.status,
    organizer: user(poll.organizer_id),
    options: options.map((o) => {
      const mine = votes.filter((v) => v.option_id === o.id);
      return {
        id: o.id,
        label: o.label,
        destination: o.destination,
        startDate: o.start_date,
        endDate: o.end_date,
        votes: mine.length,
        votedByMe: userId !== null && mine.some((v) => v.user_id === userId),
        voters: userId ? mine.map((v) => user(v.user_id)) : [],
      };
    }),
    winnerOptionId: poll.winner_option_id,
    leaderOptionIds: leaderIds,
    totalVoters: new Set(votes.map((v) => v.user_id)).size,
    isOrganizer: userId !== null && poll.organizer_id === userId,
    loggedIn: userId !== null,
    event: event ? { id: event.id, code: event.code } : null,
    createdAt: poll.created_at,
    closedAt: poll.closed_at,
  };
  return dto;
}

/** A enquete é pública para leitura (o link circula no grupo); votar exige conta. */
export async function getPollByCode(ctx: AppContext, code: string, userId: string | null) {
  return toDto(ctx, await requirePollByCode(ctx.db, code), userId);
}

export async function listPolls(ctx: AppContext, userId: string): Promise<PollSummaryDto[]> {
  const rows = await ctx.db
    .selectFrom('polls')
    .selectAll()
    .where((eb) =>
      eb.or([
        eb('organizer_id', '=', userId),
        eb('id', 'in', eb.selectFrom('poll_votes').select('poll_id').where('user_id', '=', userId)),
      ]),
    )
    .orderBy('created_at', 'desc')
    .limit(30)
    .execute();
  // Abertas, mais as que o Idealizador encerrou e ainda não virou proposta (falta o próximo passo).
  const relevant = rows.filter(
    (p) => p.status === 'open' || (p.organizer_id === userId && !p.event_id),
  );
  if (relevant.length === 0) return [];
  const votes = await ctx.db
    .selectFrom('poll_votes')
    .select(['poll_id', 'user_id'])
    .where(
      'poll_id',
      'in',
      relevant.map((p) => p.id),
    )
    .execute();
  return relevant.map((p) => {
    const mine = votes.filter((v) => v.poll_id === p.id);
    return {
      id: p.id,
      code: p.code,
      title: p.title,
      status: p.status,
      totalVoters: new Set(mine.map((v) => v.user_id)).size,
      isOrganizer: p.organizer_id === userId,
      votedByMe: mine.some((v) => v.user_id === userId),
    };
  });
}

/** Marca (ou refaz) os votos da pessoa: pode aprovar várias opções, como numa enquete de datas. */
export async function votePoll(
  ctx: AppContext,
  userId: string,
  pollId: string,
  optionIds: string[],
): Promise<PollDto> {
  const poll = await requirePoll(ctx.db, pollId);
  if (poll.status !== 'open') throw conflict('POLL_CLOSED', 'Essa enquete já foi encerrada');
  const unique = [...new Set(optionIds)];
  const valid = await ctx.db
    .selectFrom('poll_options')
    .select('id')
    .where('poll_id', '=', pollId)
    .execute();
  const known = new Set(valid.map((o) => o.id));
  if (unique.some((id) => !known.has(id))) {
    throw unprocessable('INVALID_OPTION', 'Essa opção não faz parte da enquete');
  }
  const now = ctx.clock.now();
  await ctx.db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom('poll_votes')
      .where('poll_id', '=', pollId)
      .where('user_id', '=', userId)
      .execute();
    if (unique.length > 0) {
      await trx
        .insertInto('poll_votes')
        .values(
          unique.map((optionId) => ({
            poll_id: pollId,
            option_id: optionId,
            user_id: userId,
            voted_at: now.toISOString(),
          })),
        )
        .execute();
    }
  });
  return toDto(ctx, poll, userId);
}

/** Só o Idealizador encerra. Maioria clara vence sozinha; em empate ele escolhe entre as empatadas. */
export async function closePoll(
  ctx: AppContext,
  userId: string,
  pollId: string,
  optionId: string | undefined,
): Promise<PollDto> {
  const poll = await requirePoll(ctx.db, pollId);
  if (poll.organizer_id !== userId) throw forbidden('Só quem criou a enquete a encerra');
  if (poll.status !== 'open') throw conflict('POLL_CLOSED', 'Essa enquete já foi encerrada');

  const options = await ctx.db
    .selectFrom('poll_options')
    .selectAll()
    .where('poll_id', '=', pollId)
    .execute();
  const votes = await ctx.db
    .selectFrom('poll_votes')
    .selectAll()
    .where('poll_id', '=', pollId)
    .execute();
  const winner = resolvePollWinner(
    options.map((o) => ({
      optionId: o.id,
      votes: votes.filter((v) => v.option_id === o.id).length,
    })),
    optionId,
  );
  if (!winner.ok) {
    throw unprocessable(
      winner.reason,
      winner.reason === 'CHOICE_REQUIRED'
        ? 'Deu empate (ou ninguém votou): escolha a opção vencedora'
        : 'Essa opção não pode vencer: a enquete tem outra na frente',
    );
  }

  const now = ctx.clock.now();
  const chosen = options.find((o) => o.id === winner.winnerId)!;
  await ctx.db.transaction().execute(async (trx) => {
    await trx
      .updateTable('polls')
      .set({ status: 'closed', winner_option_id: winner.winnerId, closed_at: now.toISOString() })
      .where('id', '=', pollId)
      .execute();
    await notify(trx, now, {
      userIds: votes.map((v) => v.user_id).filter((id) => id !== userId),
      eventId: null,
      kind: 'poll.closed',
      title: 'Enquete encerrada',
      body: `"${poll.title}": venceu ${chosen.label}. Agora o Idealizador lança a proposta.`,
      dedupeKey: `poll.closed:${pollId}`,
      link: `/enquete/${poll.code}`,
    });
    await audit(trx, now, {
      eventId: null,
      actorId: userId,
      action: 'poll.closed',
      entity: 'poll',
      entityId: pollId,
      data: { winnerOptionId: winner.winnerId },
    });
  });
  return toDto(ctx, await requirePoll(ctx.db, pollId), userId);
}

/**
 * Chamado quando a proposta nasce de uma enquete: liga as duas e avisa quem votou, com o link do
 * convite. Ignora silenciosamente enquete alheia ou ainda aberta (o rolê é criado do mesmo jeito).
 */
export async function linkPollToEvent(
  db: Db,
  now: Date,
  userId: string,
  pollId: string,
  event: { id: string; code: string; title: string },
): Promise<void> {
  const poll = await db.selectFrom('polls').selectAll().where('id', '=', pollId).executeTakeFirst();
  if (!poll || poll.organizer_id !== userId || poll.status !== 'closed' || poll.event_id) return;
  await db.updateTable('polls').set({ event_id: event.id }).where('id', '=', pollId).execute();
  const voters = await db
    .selectFrom('poll_votes')
    .select('user_id')
    .where('poll_id', '=', pollId)
    .execute();
  await notify(db, now, {
    userIds: voters.map((v) => v.user_id).filter((id) => id !== userId),
    eventId: null,
    kind: 'poll.proposal',
    title: 'Virou proposta!',
    body: `${event.title} saiu da enquete. Responda se está dentro.`,
    dedupeKey: `poll.proposal:${pollId}`,
    link: `/c/${event.code}`,
  });
}
