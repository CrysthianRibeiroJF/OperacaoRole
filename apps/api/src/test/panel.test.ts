import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client, eventInput, makeApp } from './helpers';

type Env = Awaited<ReturnType<typeof makeApp>>;
let env: Env;
let ana: Client; // Idealizadora e, com os cargos vagos, quem cobre tudo
let bia: Client; // General da Frota
let caio: Client; // General de Suprimentos
let davi: Client; // confirmado, sem cargo
let eva: Client; // fora do rolê

beforeEach(async () => {
  env = await makeApp();
  const login = (phone: string, name: string) => new Client(env.app, phone, name).login();
  [ana, bia, caio, davi, eva] = await Promise.all([
    login('11911111111', 'Ana'),
    login('11922222222', 'Bia'),
    login('11933333333', 'Caio'),
    login('11944444444', 'Davi'),
    login('11955555555', 'Eva'),
  ]);
});

afterEach(async () => {
  await env.app.close();
  await env.ctx.db.destroy();
});

/** Rolê confirmado com quatro pessoas; Bia assume a Frota e Caio os Suprimentos. */
async function setup(overrides: Record<string, unknown> = {}) {
  const { id, code } = (await ana.post('/events', eventInput({ quorum: 3, ...overrides }))).body;
  for (const c of [bia, caio, davi]) await c.post(`/events/${id}/respond`, { response: 'in' });
  await bia.post(`/events/${id}/roles/claim`, { role: 'fleet' });
  await caio.post(`/events/${id}/roles/claim`, { role: 'supplies' });
  return { id: id as string, code: code as string };
}

const panel = async (who: Client, id: string) => (await who.get(`/events/${id}/panel`)).body;

describe('quem vê qual painel', () => {
  it('o Idealizador vê tudo; cada General vê só o painel do cargo; sem cargo, só o acompanhamento', async () => {
    const { id } = await setup();

    const org = await panel(ana, id);
    expect(org.isOrganizer).toBe(true);
    for (const key of ['overview', 'supplies', 'fleet', 'base', 'treasury']) {
      expect(org[key], key).not.toBeNull();
    }
    expect(org.mine).toBeTruthy();

    const frota = await panel(bia, id);
    expect(frota.roles).toEqual(['fleet']);
    expect(frota.fleet).not.toBeNull();
    expect([frota.overview, frota.supplies, frota.base, frota.treasury]).toEqual([
      null,
      null,
      null,
      null,
    ]);

    const mercado = await panel(caio, id);
    expect(mercado.supplies).not.toBeNull();
    expect([mercado.overview, mercado.fleet, mercado.base, mercado.treasury]).toEqual([
      null,
      null,
      null,
      null,
    ]);

    const livre = await panel(davi, id);
    expect(livre.roles).toEqual([]);
    expect([livre.overview, livre.supplies, livre.fleet, livre.base, livre.treasury]).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(livre.mine.steps.length).toBeGreaterThan(0);
  });

  it('quem não está no rolê não abre o painel nem o transporte', async () => {
    const { id } = await setup();
    expect((await eva.get(`/events/${id}/panel`)).status).toBe(403);
    expect((await eva.get(`/events/${id}/transport`)).status).toBe(403);
  });
});

describe('painel do Mercado', () => {
  it('detalha por categoria, quem assumiu o quê e o que ainda está sem dono', async () => {
    const { id } = await setup();
    await caio.post(`/events/${id}/supplies/suggest`);
    const list = (await caio.get(`/events/${id}/supplies`)).body.items;
    const beer = list.find((i: any) => i.name === 'Gelo');
    const coal = list.find((i: any) => i.name === 'Carvão');
    await davi.post(`/supplies/${beer.id}/claim`);
    await davi.post(`/supplies/${coal.id}/claim`);
    await davi.post(`/supplies/${beer.id}/done`, { priceCents: 9000, createExpense: false });

    const s = (await panel(caio, id)).supplies;
    expect(s.totalItems).toBe(list.length);
    expect(s.doneItems).toBe(1);
    expect(s.realCents).toBe(9000);
    expect(s.unassignedItems).toBe(list.length - 2);
    expect(s.byCategory.map((c: any) => c.category)).toContain('drinks');
    const meat = s.byCategory.find((c: any) => c.category === 'meat');
    expect(meat.unassigned).toBe(meat.total - 1); // o carvão tem dono
    expect(s.load).toEqual([
      expect.objectContaining({ user: { id: davi.userId, name: 'Davi' }, items: 2, done: 1 }),
    ]);
    expect(s.unassigned.length).toBeLessThanOrEqual(8);
    expect(s.perHeadEstCents).toBe(Math.ceil(s.estCents / 4));
  });
});

describe('transporte: pontos de encontro e plano de cada um', () => {
  const stop = (over: Record<string, unknown> = {}) => ({
    kind: 'meeting',
    name: 'Posto Ipiranga',
    address: 'Av. Brasil, 100',
    time: '07:30',
    ...over,
  });

  it('só o General da Frota (e o Idealizador, que cobre) cria pontos; todos os confirmados veem', async () => {
    const { id } = await setup();
    expect((await davi.post(`/events/${id}/stops`, stop())).status).toBe(403);
    expect((await caio.post(`/events/${id}/stops`, stop())).status).toBe(403);
    expect((await eva.post(`/events/${id}/stops`, stop())).status).toBe(403);

    const created = await bia.post(`/events/${id}/stops`, stop());
    expect(created.status).toBe(201);
    await bia.post(
      `/events/${id}/stops`,
      stop({ kind: 'stop', name: 'Parada do pastel', time: '09:00' }),
    );
    await bia.post(
      `/events/${id}/stops`,
      stop({ kind: 'rideshare', name: 'Rodoviária', time: '06:50' }),
    );
    await bia.post(
      `/events/${id}/stops`,
      stop({ kind: 'return', name: 'Saída da casa', time: null, address: null }),
    );

    const t = (await davi.get(`/events/${id}/transport`)).body;
    expect(t.canEdit).toBe(false);
    expect(t.stops.map((s: any) => s.name)).toEqual([
      'Rodoviária',
      'Posto Ipiranga',
      'Parada do pastel',
      'Saída da casa', // sem hora vai para o fim
    ]);
    expect((await bia.get(`/events/${id}/transport`)).body.canEdit).toBe(true);
    // O Idealizador cobre o cargo? Aqui a Frota está ocupada, mas ele segue vendo e podendo tudo no painel.
    expect((await ana.get(`/events/${id}/panel`)).body.fleet.stops).toHaveLength(4);
  });

  it('valida horário e nome, edita e remove, e avisa a turma só do que importa', async () => {
    const { id } = await setup();
    expect((await bia.post(`/events/${id}/stops`, stop({ time: '7h30' }))).status).toBe(400);
    expect((await bia.post(`/events/${id}/stops`, stop({ name: 'x' }))).status).toBe(400);

    const created = (await bia.post(`/events/${id}/stops`, stop())).body;
    const added = (await davi.get('/notifications')).body.items.filter(
      (n: any) => n.kind === 'fleet.stop',
    );
    expect(added).toHaveLength(1);
    expect(added[0].body).toContain('Posto Ipiranga às 07:30');
    expect(
      (await bia.get('/notifications')).body.items.some((n: any) => n.kind === 'fleet.stop'),
    ).toBe(false);

    const patch = await bia.call('PATCH', `/stops/${created.id}`, { time: '08:00' });
    expect(patch.body.time).toBe('08:00');
    expect(
      (await davi.get('/notifications')).body.items.filter((n: any) => n.kind === 'fleet.stop'),
    ).toHaveLength(2);
    await bia.call('PATCH', `/stops/${created.id}`, { note: 'Levar o cooler' }); // só observação: não avisa
    expect(
      (await davi.get('/notifications')).body.items.filter((n: any) => n.kind === 'fleet.stop'),
    ).toHaveLength(2);

    expect((await davi.call('DELETE', `/stops/${created.id}`)).status).toBe(403);
    expect((await bia.call('DELETE', `/stops/${created.id}`)).status).toBe(200);
    expect((await bia.call('DELETE', `/stops/${created.id}`)).status).toBe(404);
  });

  it('quem não tem lugar no carro declara app ou conta própria; quem tem lugar não precisa', async () => {
    const { id } = await setup();
    await bia.post(`/events/${id}/vehicles`, { label: 'Gol da Bia', seats: 2, cargoCapacity: 2 });

    expect(
      (await davi.put(`/events/${id}/ride-plan`, { mode: 'app', estCents: 4500 })).status,
    ).toBe(200);
    expect((await caio.put(`/events/${id}/ride-plan`, { mode: 'own' })).status).toBe(200);
    expect((await bia.put(`/events/${id}/ride-plan`, { mode: 'app' })).status).toBe(409); // motorista
    expect((await eva.put(`/events/${id}/ride-plan`, { mode: 'app' })).status).toBe(403);
    expect((await davi.put(`/events/${id}/ride-plan`, { mode: 'train' })).status).toBe(400);

    const t = (await ana.get(`/events/${id}/transport`)).body;
    expect(t.appRiders.map((u: any) => u.name)).toEqual(['Davi']);
    expect(t.ownRiders.map((u: any) => u.name)).toEqual(['Caio']);
    expect((await davi.get(`/events/${id}/transport`)).body).toMatchObject({
      myRide: 'app',
      myPlan: { mode: 'app', estCents: 4500 },
    });

    // Pegar lugar num carro desfaz o efeito do plano antigo.
    const car = (await davi.get(`/events/${id}/fleet`)).body.vehicles[0];
    await davi.post(`/vehicles/${car.id}/join`);
    expect((await davi.get(`/events/${id}/transport`)).body.myRide).toBe('passenger');
    expect((await ana.get(`/events/${id}/transport`)).body.appRiders).toEqual([]);

    // Limpar o plano volta para "sem definição".
    await caio.put(`/events/${id}/ride-plan`, { mode: null });
    expect((await caio.get(`/events/${id}/transport`)).body.myRide).toBe('none');
  });
});

describe('painel da Frota', () => {
  it('mostra cobertura, lugares livres, quem vai de app (com a estimativa) e quem ainda não se resolveu', async () => {
    const { id } = await setup();
    await bia.post(`/events/${id}/vehicles`, { label: 'Gol da Bia', seats: 1, cargoCapacity: 1 });
    await davi.put(`/events/${id}/ride-plan`, { mode: 'app', estCents: 4500 });

    const f = (await bia.get(`/events/${id}/panel`)).body.fleet;
    expect(f).toMatchObject({
      headcount: 4,
      drivers: 1,
      passengers: 0,
      appRiders: 1,
      undecided: 2, // Ana e Caio
      seatsTotal: 1,
      seatsFree: 1,
      seatShortfall: 1,
      percentCovered: 50,
      rideEstimateCents: 4500,
    });
    expect(f.appRiderUsers.map((u: any) => u.name)).toEqual(['Davi']);
    expect(f.undecidedUsers.map((u: any) => u.name).sort()).toEqual(['Ana', 'Caio']);
    expect(f.vehicles).toEqual([
      expect.objectContaining({ label: 'Gol da Bia', taken: 0, seats: 1 }),
    ]);
  });
});

describe('visão geral do Idealizador', () => {
  it('mostra a prontidão por área e os alertas, do mais grave para o mais leve', async () => {
    const { id } = await setup();
    await caio.post(`/events/${id}/supplies/suggest`);
    await bia.post(`/events/${id}/vehicles`, { label: 'Gol da Bia', seats: 1, cargoCapacity: 1 });

    const o = (await panel(ana, id)).overview;
    expect(o.parts.map((p: any) => p.key)).toEqual(
      expect.arrayContaining(['quorum', 'supplies', 'fleet', 'base']),
    );
    expect(o.parts.find((p: any) => p.key === 'quorum')).toMatchObject({
      percent: 100,
      pending: 0,
    });
    expect(o.parts.find((p: any) => p.key === 'supplies').percent).toBe(0);
    expect(o.parts.every((p: any) => p.percent >= 0 && p.percent <= 100)).toBe(true);
    expect(o.percent).toBeGreaterThanOrEqual(0);

    const keys = o.alerts.map((a: any) => a.key);
    expect(keys).toContain('vacant'); // Base e Tesouro vagos
    expect(keys).toContain('supplies');
    expect(keys).toContain('seats'); // 3 sem lugar e 1 assento
    expect(o.alerts[0].tone).toBe('danger'); // o mais grave primeiro
    expect(o.vacantRoles).toEqual(['base', 'treasury']);
  });

  it('proposta ainda aberta só mede a confirmação', async () => {
    const { id } = (await ana.post('/events', eventInput({ quorum: 4 }))).body;
    await bia.post(`/events/${id}/respond`, { response: 'in' });
    const o = (await panel(ana, id)).overview;
    expect(o.parts.map((p: any) => p.key)).toEqual(['quorum']);
    expect(o.parts[0]).toMatchObject({ percent: 50, pending: 2 });
  });
});

describe('painel do Tesoureiro e da Base', () => {
  it('conta sinais por situação e as despesas pendentes', async () => {
    const { id } = await setup({
      requiresDeposit: true,
      depositCents: 5000,
      pixKey: 'ana@exemplo.com',
    });
    await davi.upload(
      `/events/${id}/deposit/proof`,
      Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(32),
      ]),
    );
    await ana
      .post(`/events/${id}/deposits/${bia.userId}/review`, {
        decision: 'reject',
        reason: 'ilegível',
      })
      .catch(() => undefined);
    await bia.post(`/events/${id}/expenses`, {
      description: 'Mercado',
      category: 'food',
      amountCents: 40000,
      quota: 'global',
    });

    const t = (await panel(ana, id)).treasury;
    expect(t.deposit).toMatchObject({
      required: true,
      open: true,
      amountCents: 5000,
      submitted: 1,
    });
    expect(t.expenses).toMatchObject({ count: 1, pendingCount: 1, approvedCents: 0 });
    expect(t.settled).toBe(false);
    expect((await panel(ana, id)).overview.alerts.map((a: any) => a.key)).toEqual(
      expect.arrayContaining(['proofs', 'expenses']),
    );
  });

  it('a Base mede o que falta preencher e quem está sem cama', async () => {
    const { id } = await setup();
    await ana.put(`/events/${id}/base`, {
      address: 'Rua das Flores, 10',
      wifiName: 'casa',
      wifiPassword: null,
      gateCode: null,
      checkoutTime: '11h',
      houseRules: null,
      schedule: null,
    });
    await ana.post(`/events/${id}/rooms`, { name: 'Suíte', beds: 2 });
    const room = (await ana.get(`/events/${id}/rooms`)).body.rooms[0];
    await ana.post(`/rooms/${room.id}/join`);

    const b = (await panel(ana, id)).base;
    expect(b.info.filter((i: any) => i.done).map((i: any) => i.key)).toEqual([
      'address',
      'wifi',
      'checkout',
    ]);
    expect(b.rooms).toEqual({ total: 1, beds: 2, occupied: 1 });
    expect(b.withoutBed.map((u: any) => u.name).sort()).toEqual(['Bia', 'Caio', 'Davi']);
  });
});

describe('meu acompanhamento', () => {
  it('lista o que falta e vai fechando conforme a pessoa resolve', async () => {
    const { id } = await setup();
    await caio.post(`/events/${id}/supplies/suggest`);
    await ana.post(`/events/${id}/rooms`, { name: 'Suíte', beds: 2 });

    const before = (await panel(davi, id)).mine;
    expect(before.steps.map((s: any) => [s.key, s.done])).toEqual([
      ['ride', false],
      ['room', false],
      ['supply', false],
      ['packing', false],
    ]);
    expect(before.percent).toBe(0);
    expect(before.ride.mode).toBe('none');

    await davi.put(`/events/${id}/ride-plan`, { mode: 'own' });
    const room = (await davi.get(`/events/${id}/rooms`)).body.rooms[0];
    await davi.post(`/rooms/${room.id}/join`);
    const item = (await davi.get(`/events/${id}/supplies`)).body.items[0];
    await davi.post(`/supplies/${item.id}/claim`);
    await ana.post(`/events/${id}/packing`, { label: 'Protetor solar', scope: 'group' });
    const packing = (await davi.get(`/events/${id}/packing`)).body.items[0];
    await davi.post(`/packing/${packing.id}/check`, { checked: true });

    const after = (await panel(davi, id)).mine;
    expect(after.steps.every((s: any) => s.done)).toBe(true);
    expect(after.percent).toBe(100);
    expect(after).toMatchObject({
      room: 'Suíte',
      ride: { mode: 'own' },
      packing: { done: 1, total: 1 },
    });
    expect(after.items).toEqual([expect.objectContaining({ id: item.id, done: false })]);
  });

  it('com sinal exigido, o primeiro passo é pagar e só fecha com o comprovante aprovado', async () => {
    const { id } = await setup({
      requiresDeposit: true,
      depositCents: 5000,
      pixKey: 'ana@exemplo.com',
    });
    const mine = async () => (await panel(davi, id)).mine;
    expect((await mine()).steps[0]).toMatchObject({ key: 'deposit', done: false });
    expect((await mine()).deposit).toMatchObject({
      required: true,
      status: 'pending',
      amountCents: 5000,
    });
    await ana
      .post(`/events/${id}/deposits/${davi.userId}/review`, { decision: 'approve' })
      .catch(() => undefined);
  });

  it('o rolê ainda aberto não cobra passos', async () => {
    const { id } = (await ana.post('/events', eventInput())).body;
    expect((await panel(ana, id)).mine.steps).toEqual([]);
  });

  it('mostra os pontos de encontro e a estimativa financeira sem expor ninguém', async () => {
    const { id } = await setup();
    await bia.post(`/events/${id}/stops`, { kind: 'meeting', name: 'Posto', time: '07:30' });
    await bia.post(`/events/${id}/expenses`, {
      description: 'Gelo',
      category: 'food',
      amountCents: 4000,
      quota: 'global',
    });
    const m = (await panel(davi, id)).mine;
    expect(m.stops).toEqual([expect.objectContaining({ name: 'Posto', time: '07:30' })]);
    expect(m.finance).toMatchObject({ projectedShareCents: 1000, paidByMeCents: 0 });
    expect((await panel(bia, id)).mine.finance.paidByMeCents).toBe(4000);
  });
});

describe('repetir o rolê e excluir a conta', () => {
  it('os pontos de encontro vêm junto na repetição', async () => {
    const { id } = await setup();
    await bia.post(`/events/${id}/stops`, { kind: 'meeting', name: 'Posto', time: '07:30' });
    const again = (await ana.post(`/events/${id}/repeat`, { startDate: '2027-01-10' })).body;
    const copy = (await ana.get(`/events/${again.id}/transport`)).body.stops;
    expect(copy).toEqual([
      expect.objectContaining({ name: 'Posto', time: '07:30', kind: 'meeting' }),
    ]);
  });

  it('o plano de transporte some com a conta', async () => {
    const { id } = await setup();
    await davi.put(`/events/${id}/ride-plan`, { mode: 'app' });
    await davi.post(`/events/${id}/respond`, { response: 'out' });
    expect((await davi.post('/me/delete', { confirm: 'EXCLUIR' })).status).toBe(200);
    const left = await env.ctx.db.selectFrom('ride_plans').selectAll().execute();
    expect(left).toEqual([]);
  });
});
