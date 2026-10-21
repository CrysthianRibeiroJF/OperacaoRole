import type {
  BasePanel,
  FleetPanel,
  MyPanel,
  OverviewPanel,
  PanelAlert,
  PanelDto,
  PanelPart,
  SuppliesPanel,
  TreasuryPanel,
} from '@role/contracts';
import {
  can,
  myProgress,
  overallReadiness,
  percentOf,
  ROLE_LABELS,
  summarizeFleet,
  summarizeSupplies,
  type MyStep,
  type RideMode,
} from '@role/domain';
import type { AppContext } from '../../context';
import { forbidden } from '../../errors';
import {
  buildActor,
  effectiveDepositStatus,
  requireEvent,
  usersById,
  vacantRolesOf,
  getTreasurerId,
  type EventRow,
  type ParticipationRow,
} from '../events/event.queries';
import { getVault } from '../settlement/settlement.service';
import { loadRides, loadStops } from '../transport/transport.service';

/** Tudo que os painéis usam, lido uma vez só. */
async function loadData(ctx: AppContext, event: EventRow, userId: string) {
  const db = ctx.db;
  const eventId = event.id;
  const [parts, supplies, vehicles, passengers, rooms, occupants, stops, expenses, contests] =
    await Promise.all([
      db
        .selectFrom('participations')
        .selectAll()
        .where('event_id', '=', eventId)
        .where('response', '=', 'in')
        .orderBy('responded_at')
        .execute(),
      db
        .selectFrom('supply_items')
        .selectAll()
        .where('event_id', '=', eventId)
        .orderBy('created_at')
        .orderBy('id')
        .execute(),
      db.selectFrom('vehicles').selectAll().where('event_id', '=', eventId).execute(),
      db.selectFrom('vehicle_passengers').selectAll().where('event_id', '=', eventId).execute(),
      db
        .selectFrom('rooms')
        .selectAll()
        .where('event_id', '=', eventId)
        .orderBy('created_at')
        .execute(),
      db.selectFrom('room_occupants').selectAll().where('event_id', '=', eventId).execute(),
      loadStops(db, eventId),
      db
        .selectFrom('expenses')
        .select(['id', 'amount_cents', 'status'])
        .where('event_id', '=', eventId)
        .execute(),
      db
        .selectFrom('expense_contests')
        .innerJoin('expenses', 'expenses.id', 'expense_contests.expense_id')
        .select('expense_contests.id as id')
        .where('expenses.event_id', '=', eventId)
        .where('expense_contests.resolved_at', 'is', null)
        .execute(),
    ]);

  const memberIds = parts.map((p) => p.user_id);
  const [rides, treasurerId, packing] = await Promise.all([
    loadRides(db, eventId, memberIds),
    getTreasurerId(db, event),
    db
      .selectFrom('packing_items')
      .select(['id'])
      .where('event_id', '=', eventId)
      .where((eb) => eb.or([eb('owner_id', 'is', null), eb('owner_id', '=', userId)]))
      .execute(),
  ]);
  const checks = packing.length
    ? await db
        .selectFrom('packing_checks')
        .select('item_id')
        .where('user_id', '=', userId)
        .where(
          'item_id',
          'in',
          packing.map((i) => i.id),
        )
        .execute()
    : [];

  const users = await usersById(db, [
    ...memberIds,
    ...supplies.flatMap((s) => (s.assignee_id ? [s.assignee_id] : [])),
    ...vehicles.map((v) => v.driver_id),
  ]);
  return {
    parts,
    supplies,
    vehicles,
    passengers,
    rooms,
    occupants,
    stops,
    expenses,
    openContests: contests.length,
    memberIds,
    rides,
    treasurerId,
    packingTotal: packing.length,
    packingDone: checks.length,
    users,
  };
}

type Data = Awaited<ReturnType<typeof loadData>>;

/* -------------------------------------- Painéis dos Generals -------------------------------------- */

function suppliesPanel(data: Data): SuppliesPanel {
  const s = summarizeSupplies(
    data.supplies.map((i) => ({
      category: i.category,
      estPriceCents: i.est_price_cents,
      realPriceCents: i.real_price_cents,
      done: i.done === 1,
      assigneeId: i.assignee_id,
    })),
    data.memberIds.length,
  );
  const user = (id: string) => data.users.get(id) ?? { id, name: '—' };
  return {
    totalItems: s.totalItems,
    doneItems: s.doneItems,
    unassignedItems: s.unassignedItems,
    percentDone: s.percentDone,
    estCents: s.estCents,
    realCents: s.realCents,
    deviationCents: s.deviationCents,
    perHeadEstCents: s.perHeadEstCents,
    byCategory: s.byCategory,
    load: s.load.map((l) => ({ user: user(l.userId), items: l.items, done: l.done })),
    unassigned: data.supplies
      .filter((i) => i.done === 0 && !i.assignee_id)
      .slice(0, 8)
      .map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        quantityLabel: i.quantity_label,
      })),
  };
}

function fleetPanel(data: Data): FleetPanel {
  const user = (id: string) => data.users.get(id) ?? { id, name: '—' };
  const modeOf = (id: string): RideMode => data.rides.modes.get(id) ?? 'none';
  const seatsTotal = data.vehicles.reduce((sum, v) => sum + v.seats, 0);
  const summary = summarizeFleet({ modes: data.memberIds.map(modeOf), seatsTotal });
  const who = (mode: RideMode) => data.memberIds.filter((id) => modeOf(id) === mode).map(user);

  return {
    ...summary,
    rideEstimateCents: data.memberIds
      .filter((id) => modeOf(id) === 'app')
      .reduce((sum, id) => sum + (data.rides.plans.get(id)?.estCents ?? 0), 0),
    stops: data.stops,
    vehicles: data.vehicles.map((v) => ({
      id: v.id,
      label: v.label,
      driver: user(v.driver_id),
      departurePlace: v.departure_place,
      departureTime: v.departure_time,
      seats: v.seats,
      taken: data.passengers.filter((p) => p.vehicle_id === v.id).length,
    })),
    appRiderUsers: who('app'),
    ownRiderUsers: who('own'),
    undecidedUsers: who('none'),
  };
}

const BASE_INFO = [
  ['address', 'Endereço', (e: EventRow) => e.base_address],
  ['wifi', 'Wi-Fi', (e: EventRow) => e.base_wifi_name],
  ['gate', 'Código do portão', (e: EventRow) => e.base_gate_code],
  ['checkout', 'Horário de saída', (e: EventRow) => e.base_checkout_time],
  ['rules', 'Regras da casa', (e: EventRow) => e.base_house_rules],
  ['schedule', 'Roteiro', (e: EventRow) => e.base_schedule],
] as const;

function basePanel(event: EventRow, data: Data): BasePanel {
  const info = BASE_INFO.map(([key, label, pick]) => ({
    key,
    label,
    done: !!pick(event)?.trim(),
  }));
  const placed = new Set(data.occupants.map((o) => o.user_id));
  const hasRooms = data.rooms.length > 0;
  const withoutBed = hasRooms
    ? data.memberIds
        .filter((id) => !placed.has(id))
        .map((id) => data.users.get(id) ?? { id, name: '—' })
    : [];
  const infoPct = percentOf(info.filter((i) => i.done).length, info.length);
  return {
    percent: overallReadiness([
      { percent: infoPct },
      ...(hasRooms ? [{ percent: percentOf(data.occupants.length, data.memberIds.length) }] : []),
    ]),
    info,
    rooms: {
      total: data.rooms.length,
      beds: data.rooms.reduce((sum, r) => sum + r.beds, 0),
      occupied: data.occupants.length,
    },
    withoutBed,
  };
}

function treasuryPanel(event: EventRow, data: Data): TreasuryPanel {
  const payers = data.parts.filter((p) => p.user_id !== data.treasurerId);
  const status = (p: ParticipationRow) => effectiveDepositStatus(event, p, data.treasurerId);
  const open = !!event.deposit_opened_at;
  const count = (s: string) => (open ? payers.filter((p) => status(p) === s).length : 0);
  const approved = count('approved');
  const approvedExpenses = data.expenses.filter((e) => e.status === 'approved');
  const approvedCents = approvedExpenses.reduce((sum, e) => sum + e.amount_cents, 0);
  return {
    deposit: {
      required: event.deposit_required === 1,
      open,
      amountCents: event.deposit_cents,
      approved,
      submitted: count('submitted'),
      pending: count('pending'),
      rejected: count('rejected'),
      waitlisted: count('waitlisted'),
      collectedCents: approved * (event.deposit_cents ?? 0),
    },
    expenses: {
      count: data.expenses.length,
      approvedCents,
      pendingCount: data.expenses.filter((e) => e.status === 'pending').length,
      openContests: data.openContests,
      perHeadCents:
        data.memberIds.length > 0 ? Math.floor(approvedCents / data.memberIds.length) : null,
    },
    settled: event.status === 'closed',
  };
}

/* ------------------------------------------- Idealizador ------------------------------------------- */

function overviewPanel(
  event: EventRow,
  data: Data,
  roleRows: { role: string }[],
  panels: { supplies: SuppliesPanel; fleet: FleetPanel; base: BasePanel; treasury: TreasuryPanel },
): OverviewPanel {
  const confirmed = data.memberIds.length;
  const live = event.status === 'confirmed' || event.status === 'closed';
  const { supplies, fleet, base, treasury } = panels;

  const parts: PanelPart[] = [
    {
      key: 'quorum',
      label: 'Confirmados',
      percent: Math.min(100, percentOf(confirmed, event.quorum)),
      pending: Math.max(0, event.quorum - confirmed),
      hint: `${confirmed} de ${event.quorum} para virar oficial`,
      tab: 'equipe',
    },
  ];
  if (live) {
    const payers =
      treasury.deposit.approved +
      treasury.deposit.submitted +
      treasury.deposit.pending +
      treasury.deposit.rejected +
      treasury.deposit.waitlisted;
    if (treasury.deposit.required && treasury.deposit.open) {
      parts.push({
        key: 'deposit',
        label: 'Sinal',
        percent: percentOf(treasury.deposit.approved, payers),
        pending: payers - treasury.deposit.approved,
        hint: `${treasury.deposit.approved} de ${payers} aprovados`,
        tab: 'cofre',
      });
    }
    parts.push({
      key: 'supplies',
      label: 'Mercado',
      percent: supplies.percentDone,
      pending: supplies.totalItems - supplies.doneItems,
      hint:
        supplies.totalItems === 0
          ? 'A lista ainda não foi criada'
          : `${supplies.doneItems} de ${supplies.totalItems} itens comprados`,
      tab: 'mercado',
    });
    parts.push({
      key: 'fleet',
      label: 'Transporte',
      percent: fleet.percentCovered,
      pending: fleet.undecided,
      hint: `${fleet.headcount - fleet.undecided} de ${fleet.headcount} com transporte`,
      tab: 'frotas',
    });
    if (base.rooms.total > 0) {
      parts.push({
        key: 'rooms',
        label: 'Quartos',
        percent: percentOf(base.rooms.occupied, confirmed),
        pending: base.withoutBed.length,
        hint: `${base.rooms.occupied} de ${confirmed} com cama`,
        tab: 'base',
      });
    }
    const infoDone = base.info.filter((i) => i.done).length;
    parts.push({
      key: 'base',
      label: 'Informações da Base',
      percent: percentOf(infoDone, base.info.length),
      pending: base.info.length - infoDone,
      hint: `${infoDone} de ${base.info.length} preenchidas`,
      tab: 'base',
    });
    if (treasury.expenses.count > 0) {
      const open = treasury.expenses.pendingCount + treasury.expenses.openContests;
      parts.push({
        key: 'expenses',
        label: 'Despesas',
        percent: percentOf(Math.max(0, treasury.expenses.count - open), treasury.expenses.count),
        pending: open,
        hint:
          open === 0
            ? 'Tudo aprovado e sem contestação'
            : `${open} aguardando decisão do Tesoureiro`,
        tab: 'cofre',
      });
    }
  }

  const vacantRoles = vacantRolesOf(roleRows as never);
  const alerts: PanelAlert[] = [];
  if (vacantRoles.length > 0) {
    alerts.push({
      key: 'vacant',
      tone: 'warn',
      text: `Cargo vago: ${vacantRoles.map((r) => ROLE_LABELS[r].replace('General ', '')).join(', ')}. Você cobre enquanto ninguém assume.`,
      tab: 'equipe',
    });
  }
  if (event.status === 'confirmed' && confirmed < event.quorum) {
    alerts.push({
      key: 'quorum',
      tone: 'warn',
      text: `Abaixo do mínimo: ${confirmed} de ${event.quorum}. Chame mais gente.`,
      tab: 'equipe',
    });
  }
  if (live) {
    if (treasury.deposit.waitlisted > 0) {
      alerts.push({
        key: 'waitlisted',
        tone: 'warn',
        text: `${treasury.deposit.waitlisted} na fila de espera por prazo do sinal.`,
        tab: 'cofre',
      });
    }
    if (treasury.deposit.submitted > 0) {
      alerts.push({
        key: 'proofs',
        tone: 'info',
        text: `${treasury.deposit.submitted} comprovante(s) de sinal aguardando conferência.`,
        tab: 'cofre',
      });
    }
    if (supplies.unassignedItems > 0) {
      alerts.push({
        key: 'supplies',
        tone: 'warn',
        text: `${supplies.unassignedItems} item(ns) do mercado sem responsável.`,
        tab: 'mercado',
      });
    }
    if (fleet.seatShortfall > 0) {
      alerts.push({
        key: 'seats',
        tone: 'danger',
        text: `Faltam ${fleet.seatShortfall} lugar(es) nos carros para quem ainda não se resolveu.`,
        tab: 'frotas',
      });
    } else if (fleet.undecided > 0) {
      alerts.push({
        key: 'rides',
        tone: 'warn',
        text: `${fleet.undecided} pessoa(s) ainda sem transporte definido.`,
        tab: 'frotas',
      });
    }
    if (base.withoutBed.length > 0) {
      alerts.push({
        key: 'beds',
        tone: 'info',
        text: `${base.withoutBed.length} pessoa(s) sem cama.`,
        tab: 'base',
      });
    }
    if (treasury.expenses.pendingCount + treasury.expenses.openContests > 0) {
      alerts.push({
        key: 'expenses',
        tone: 'warn',
        text: `${treasury.expenses.pendingCount} despesa(s) a aprovar e ${treasury.expenses.openContests} contestação(ões) abertas.`,
        tab: 'cofre',
      });
    }
    const missing = base.info.filter((i) => !i.done).map((i) => i.label.toLowerCase());
    if (missing.length > 0) {
      alerts.push({
        key: 'base',
        tone: 'info',
        text: `Faltam na Base: ${missing.join(', ')}.`,
        tab: 'base',
      });
    }
  }
  const order = { danger: 0, warn: 1, info: 2 } as const;
  alerts.sort((a, b) => order[a.tone] - order[b.tone]);

  return { percent: overallReadiness(parts), parts, alerts, vacantRoles };
}

/* ----------------------------------------- Meu andamento ----------------------------------------- */

async function minePanel(
  ctx: AppContext,
  event: EventRow,
  data: Data,
  userId: string,
  participation: ParticipationRow | undefined,
): Promise<MyPanel> {
  const mode: RideMode = data.rides.modes.get(userId) ?? 'none';
  const myVehicle =
    data.vehicles.find((v) => v.driver_id === userId) ??
    data.vehicles.find((v) =>
      data.passengers.some((p) => p.vehicle_id === v.id && p.user_id === userId),
    );
  const myRoom = data.occupants.find((o) => o.user_id === userId);
  const myItems = data.supplies.filter((s) => s.assignee_id === userId);
  const depositStatus = effectiveDepositStatus(event, participation, data.treasurerId);
  const depositActive = event.deposit_required === 1 && !!event.deposit_opened_at;

  const steps: MyStep[] = [];
  if (event.status === 'confirmed') {
    if (depositActive) {
      steps.push({
        key: 'deposit',
        label: 'Pagar o sinal e enviar o comprovante',
        done: depositStatus === 'approved',
        tab: 'cofre',
      });
    }
    steps.push({
      key: 'ride',
      label: 'Definir como você vai (carro, app ou por conta própria)',
      done: mode !== 'none',
      tab: 'frotas',
    });
    if (data.rooms.length > 0) {
      steps.push({ key: 'room', label: 'Escolher sua cama', done: !!myRoom, tab: 'base' });
    }
    if (data.supplies.length > 0) {
      const open = data.supplies.some((s) => s.done === 0 && !s.assignee_id);
      steps.push({
        key: 'supply',
        label: 'Assumir um item da lista de compras',
        done: myItems.length > 0 || !open,
        tab: 'mercado',
      });
    }
    steps.push({
      key: 'packing',
      label: 'Montar a sua bagagem',
      done: data.packingTotal > 0 && data.packingDone === data.packingTotal,
      tab: 'mural',
    });
  }
  const progress = myProgress(steps);
  const vault = await getVault(ctx, userId, event.id);

  return {
    percent: progress.percent,
    steps,
    deposit: {
      required: event.deposit_required === 1,
      status: depositStatus,
      amountCents: event.deposit_cents,
      deadlineAt: event.deposit_deadline_at,
    },
    ride: {
      mode,
      vehicleLabel: myVehicle?.label ?? null,
      departurePlace: myVehicle?.departure_place ?? null,
      departureTime: myVehicle?.departure_time ?? null,
    },
    room: myRoom ? (data.rooms.find((r) => r.id === myRoom.room_id)?.name ?? null) : null,
    items: myItems.map((i) => ({ id: i.id, name: i.name, done: i.done === 1 })),
    packing: { done: data.packingDone, total: data.packingTotal },
    finance: {
      projectedShareCents: vault.projectedShareCents,
      projectedNetCents: vault.projectedNetCents,
      paidByMeCents: vault.paidByMeCents,
    },
    stops: data.stops,
    checkoutTime: event.base_checkout_time,
  };
}

/**
 * Painel do QG: cada seção só vem para quem pode vê-la. O Idealizador recebe tudo (e a visão geral);
 * cada General, o painel do próprio cargo; qualquer confirmado, o próprio acompanhamento.
 */
export async function getPanel(
  ctx: AppContext,
  userId: string,
  eventId: string,
): Promise<PanelDto> {
  const event = await requireEvent(ctx.db, eventId);
  const { actor, participation, roleRows } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'event.viewInternal')) throw forbidden('Confirme presença para abrir o painel');

  const data = await loadData(ctx, event, userId);
  const supplies = can(actor, 'panel.supplies') ? suppliesPanel(data) : null;
  const fleet = can(actor, 'panel.fleet') ? fleetPanel(data) : null;
  const base = can(actor, 'panel.base') ? basePanel(event, data) : null;
  const treasury = can(actor, 'panel.treasury') ? treasuryPanel(event, data) : null;

  const overview =
    can(actor, 'panel.overview') && supplies && fleet && base && treasury
      ? overviewPanel(event, data, roleRows, { supplies, fleet, base, treasury })
      : null;

  return {
    isOrganizer: actor.isOrganizer,
    roles: [...actor.roles],
    overview,
    supplies,
    fleet,
    base,
    treasury,
    mine: await minePanel(ctx, event, data, userId, participation),
  };
}
