import type {
  CompanionDto,
  DepositStatus,
  EventCard,
  MyContext,
  ParticipationState,
  PublicUser,
} from '@role/contracts';
import {
  adultsOf,
  childrenOf,
  headsOf,
  payingUnits,
  permissionsFor,
  ROLE_KEYS,
  type Actor,
  type RoleKey,
} from '@role/domain';
import type { Selectable } from 'kysely';
import type { Db } from '../../context';
import type { CompanionsTable, EventsTable, ParticipationsTable } from '../../db/types';
import { notFound } from '../../errors';

export type EventRow = Selectable<EventsTable>;
export type ParticipationRow = Selectable<ParticipationsTable>;
export type CompanionRow = Selectable<CompanionsTable>;

export const toCompanionDto = (c: CompanionRow): CompanionDto => ({
  id: c.id,
  name: c.name,
  kind: c.kind,
  drinksAlcohol: c.drinks_alcohol === 1,
  diet: c.diet,
});

/** A "festa" de uma confirmação: o responsável e quem vai com ele. */
export interface PartyInfo {
  companions: CompanionRow[];
  adults: number;
  children: number;
  /** Cotas que o responsável paga: ele e cada acompanhante adulto. */
  units: number;
  /** Cabeças: ele e todos os acompanhantes. */
  heads: number;
}

const EMPTY_PARTY: PartyInfo = { companions: [], adults: 0, children: 0, units: 1, heads: 1 };

function toParty(companions: CompanionRow[]): PartyInfo {
  return {
    companions,
    adults: adultsOf(companions),
    children: childrenOf(companions),
    units: payingUnits(companions),
    heads: headsOf(companions),
  };
}

/** Acompanhantes de cada confirmado do rolê (só de quem segue confirmado), por responsável. */
export async function loadParties(db: Db, eventId: string): Promise<Map<string, PartyInfo>> {
  const rows = await db
    .selectFrom('companions')
    .innerJoin('participations', (join) =>
      join
        .onRef('participations.event_id', '=', 'companions.event_id')
        .onRef('participations.user_id', '=', 'companions.owner_id'),
    )
    .selectAll('companions')
    .where('companions.event_id', '=', eventId)
    .where('participations.response', '=', 'in')
    .orderBy('companions.created_at')
    .orderBy('companions.id')
    .execute();
  const byOwner = new Map<string, CompanionRow[]>();
  for (const r of rows) byOwner.set(r.owner_id, [...(byOwner.get(r.owner_id) ?? []), r]);
  return new Map([...byOwner].map(([owner, list]) => [owner, toParty(list)]));
}

export const partyOf = (parties: ReadonlyMap<string, PartyInfo>, userId: string): PartyInfo =>
  parties.get(userId) ?? EMPTY_PARTY;

/** Cabeças e cotas do rolê inteiro, dadas as confirmações. */
export function partyTotals(memberIds: readonly string[], parties: ReadonlyMap<string, PartyInfo>) {
  let heads = 0;
  let units = 0;
  for (const id of memberIds) {
    const p = partyOf(parties, id);
    heads += p.heads;
    units += p.units;
  }
  return { heads, units };
}

export async function requireEvent(db: Db, id: string): Promise<EventRow> {
  const event = await db.selectFrom('events').selectAll().where('id', '=', id).executeTakeFirst();
  if (!event) throw notFound('Rolê não encontrado');
  return event;
}

export async function findEventByCode(db: Db, code: string): Promise<EventRow | undefined> {
  return db
    .selectFrom('events')
    .selectAll()
    .where('code', '=', code.toUpperCase())
    .executeTakeFirst();
}

export async function getParticipation(
  db: Db,
  eventId: string,
  userId: string,
): Promise<ParticipationRow | undefined> {
  return db
    .selectFrom('participations')
    .selectAll()
    .where('event_id', '=', eventId)
    .where('user_id', '=', userId)
    .executeTakeFirst();
}

export interface RoleRow {
  role: RoleKey;
  user_id: string;
  drawn: number;
}

export async function getEventRoles(db: Db, eventId: string): Promise<RoleRow[]> {
  return db
    .selectFrom('event_roles')
    .select(['role', 'user_id', 'drawn'])
    .where('event_id', '=', eventId)
    .execute();
}

export const vacantRolesOf = (rows: readonly RoleRow[]): RoleKey[] =>
  ROLE_KEYS.filter((role) => !rows.some((r) => r.role === role));

/** Quem opera o Tesouro: o General do Tesouro ou, se vago, o Idealizador (RN-25). */
export async function getTreasurerId(db: Db, event: EventRow): Promise<string> {
  const row = await db
    .selectFrom('event_roles')
    .select('user_id')
    .where('event_id', '=', event.id)
    .where('role', '=', 'treasury')
    .executeTakeFirst();
  return row?.user_id ?? event.organizer_id;
}

export async function countConfirmed(db: Db, eventId: string): Promise<number> {
  const row = await db
    .selectFrom('participations')
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('event_id', '=', eventId)
    .where('response', '=', 'in')
    .executeTakeFirstOrThrow();
  return Number(row.n);
}

export async function confirmedUserIds(db: Db, eventId: string): Promise<string[]> {
  const rows = await db
    .selectFrom('participations')
    .select('user_id')
    .where('event_id', '=', eventId)
    .where('response', '=', 'in')
    .orderBy('responded_at')
    .execute();
  return rows.map((r) => r.user_id);
}

export async function buildActor(db: Db, event: EventRow, userId: string | null) {
  const [participation, roleRows] = await Promise.all([
    userId ? getParticipation(db, event.id, userId) : Promise.resolve(undefined),
    getEventRoles(db, event.id),
  ]);
  const state: ParticipationState = participation ? participation.response : 'none';
  const actor: Actor = {
    isOrganizer: userId !== null && event.organizer_id === userId,
    roles: roleRows.filter((r) => r.user_id === userId).map((r) => r.role),
    participation: state,
    vacantRoles: vacantRolesOf(roleRows),
  };
  return { actor, participation, roleRows };
}

/** Status do sinal como o usuário deve vê-lo: o Tesoureiro segura o dinheiro, então está sempre quite. */
export function effectiveDepositStatus(
  event: EventRow,
  participation: ParticipationRow | undefined,
  treasurerId: string,
): DepositStatus {
  if (!participation || participation.response !== 'in' || !event.deposit_opened_at) return 'none';
  if (participation.user_id === treasurerId) return 'approved';
  return participation.deposit_status;
}

export async function buildMyContext(db: Db, event: EventRow, userId: string): Promise<MyContext> {
  const { actor, participation } = await buildActor(db, event, userId);
  const treasurerId = await getTreasurerId(db, event);
  const myCompanions = await db
    .selectFrom('companions')
    .select('kind')
    .where('event_id', '=', event.id)
    .where('owner_id', '=', userId)
    .execute();
  return {
    participation: actor.participation,
    isOrganizer: actor.isOrganizer,
    roles: [...actor.roles],
    depositStatus: effectiveDepositStatus(event, participation, treasurerId),
    drinksAlcohol: participation?.drinks_alcohol === 1,
    diet: participation?.diet ?? 'omnivore',
    payingUnits: participation?.response === 'in' ? payingUnits(myCompanions) : 1,
    can: permissionsFor(actor),
  };
}

export async function toEventCards(db: Db, rows: readonly EventRow[]): Promise<EventCard[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [counts, organizers, companionRows] = await Promise.all([
    db
      .selectFrom('participations')
      .select(['event_id', (eb) => eb.fn.countAll<number>().as('n')])
      .where('event_id', 'in', ids)
      .where('response', '=', 'in')
      .groupBy('event_id')
      .execute(),
    db
      .selectFrom('users')
      .select(['id', 'name'])
      .where('id', 'in', [...new Set(rows.map((r) => r.organizer_id))])
      .execute(),
    db
      .selectFrom('companions')
      .innerJoin('participations', (join) =>
        join
          .onRef('participations.event_id', '=', 'companions.event_id')
          .onRef('participations.user_id', '=', 'companions.owner_id'),
      )
      .select(['companions.event_id as event_id', 'companions.kind as kind'])
      .where('companions.event_id', 'in', ids)
      .where('participations.response', '=', 'in')
      .execute(),
  ]);
  const countByEvent = new Map(counts.map((c) => [c.event_id, Number(c.n)]));
  const organizerById = new Map(organizers.map((o) => [o.id, o]));

  return rows.map((e) => {
    const confirmedCount = countByEvent.get(e.id) ?? 0;
    const mine = companionRows.filter((c) => c.event_id === e.id);
    const organizer = organizerById.get(e.organizer_id);
    return {
      id: e.id,
      code: e.code,
      title: e.title,
      destination: e.destination,
      startDate: e.start_date,
      endDate: e.end_date,
      costCapCents: e.cost_cap_cents,
      quorum: e.quorum,
      status: e.status,
      responseDeadlineAt: e.response_deadline_at,
      confirmedCount,
      missing: Math.max(0, e.quorum - confirmedCount),
      belowQuorum: e.status === 'confirmed' && confirmedCount < e.quorum,
      organizer: { id: e.organizer_id, name: organizer?.name ?? '—' },
      requiresDeposit: e.deposit_required === 1,
      depositCents: e.deposit_cents,
      createdAt: e.created_at,
      confirmedAt: e.confirmed_at,
      peopleCount: confirmedCount + mine.length,
      payingCount: confirmedCount + adultsOf(mine),
      capacity: e.capacity,
    };
  });
}

export async function toEventCard(db: Db, row: EventRow): Promise<EventCard> {
  const [card] = await toEventCards(db, [row]);
  return card!;
}

export async function usersById(db: Db, ids: readonly string[]): Promise<Map<string, PublicUser>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .selectFrom('users')
    .select(['id', 'name'])
    .where('id', 'in', unique)
    .execute();
  return new Map(rows.map((r) => [r.id, { id: r.id, name: r.name }]));
}
