import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client, eventInput, makeApp, PNG } from './helpers';

type Env = Awaited<ReturnType<typeof makeApp>>;
let env: Env;
let ana: Client; // Idealizadora (Tesoureira, Base e Frota enquanto vagos)
let bia: Client;
let caio: Client;
let davi: Client;

beforeEach(async () => {
  env = await makeApp();
  const login = (phone: string, name: string) => new Client(env.app, phone, name).login();
  [ana, bia, caio, davi] = await Promise.all([
    login('11911111111', 'Ana'),
    login('11922222222', 'Bia'),
    login('11933333333', 'Caio'),
    login('11944444444', 'Davi'),
  ]);
});

afterEach(async () => {
  await env.app.close();
  await env.ctx.db.destroy();
});

const adult = (over: Record<string, unknown> = {}) => ({ name: 'Par', kind: 'adult', ...over });
const child = (name = 'Criança') => ({ name, kind: 'child' });

/** Rolê confirmado com Ana, Bia, Caio e Davi (quórum 3). */
async function setup(overrides: Record<string, unknown> = {}) {
  const { id } = (await ana.post('/events', eventInput({ endDate: '2026-11-15', ...overrides })))
    .body;
  for (const c of [bia, caio, davi]) await c.post(`/events/${id}/respond`, { response: 'in' });
  return id as string;
}
const setCompanions = (who: Client, id: string, companions: unknown[]) =>
  who.put(`/events/${id}/companions`, { companions });
const card = async (id: string) => (await ana.get(`/events/${id}`)).body.event;
const rules = (over: Record<string, unknown> = {}) => ({
  allowCompanions: true,
  maxChildren: 2,
  capacity: null,
  ...over,
});

describe('quórum e cabeças', () => {
  it('o acompanhante não confirma o rolê: o quórum conta só o responsável', async () => {
    const { id } = (await ana.post('/events', eventInput())).body; // quórum 3
    await bia.post(`/events/${id}/respond`, { response: 'in' });
    expect((await setCompanions(bia, id, [adult(), child()])).status).toBe(200);

    // Ana + Bia + 2 acompanhantes são 4 cabeças, mas só 2 andorinhas: segue aberto.
    expect(await card(id)).toMatchObject({
      status: 'open',
      confirmedCount: 2,
      peopleCount: 4,
      payingCount: 3,
      missing: 1,
    });

    await caio.post(`/events/${id}/respond`, { response: 'in' });
    expect(await card(id)).toMatchObject({
      status: 'confirmed',
      confirmedCount: 3,
      peopleCount: 5,
    });
  });

  it('o responsável vê a própria turma e quantas cotas paga; sair do rolê leva os acompanhantes', async () => {
    const id = await setup();
    await setCompanions(bia, id, [adult({ name: 'Bruno', drinksAlcohol: true }), child('Duda')]);

    const party = (await bia.get(`/events/${id}/party`)).body;
    expect(party).toMatchObject({ payingUnits: 2, heads: 3, canEdit: true, adultsLocked: false });
    expect(party.companions.map((c: any) => [c.name, c.kind])).toEqual([
      ['Bruno', 'adult'],
      ['Duda', 'child'],
    ]);
    expect(party.companions[0].drinksAlcohol).toBe(true);

    const roster = (await ana.get(`/events/${id}`)).body.roster;
    expect(roster.find((r: any) => r.user.name === 'Bia').companions).toHaveLength(2);
    expect((await bia.get(`/events/${id}`)).body.me.payingUnits).toBe(2);

    await bia.post(`/events/${id}/respond`, { response: 'out' });
    expect(await card(id)).toMatchObject({ confirmedCount: 3, peopleCount: 3 });
    expect(await env.ctx.db.selectFrom('companions').selectAll().execute()).toEqual([]);
  });

  it('criança não bebe, ainda que a escolha venha marcada', async () => {
    const id = await setup();
    await setCompanions(bia, id, [{ name: 'Duda', kind: 'child', drinksAlcohol: true }]);
    expect((await bia.get(`/events/${id}/party`)).body.companions[0].drinksAlcohol).toBe(false);
  });
});

describe('limites: nada de creche', () => {
  it('um adulto e até duas crianças por padrão', async () => {
    const id = await setup();
    expect((await setCompanions(bia, id, [adult(), child(), child()])).status).toBe(200);
    const kids = await setCompanions(caio, id, [child(), child(), child()]);
    expect(kids.status).toBe(422);
    expect(kids.body.error.code).toBe('TOO_MANY_CHILDREN');
    const two = await setCompanions(davi, id, [adult(), adult({ name: 'Outro' })]);
    expect(two.status).toBe(422);
    expect(two.body.error.code).toBe('TOO_MANY_ADULTS');
    expect((await setCompanions(davi, id, Array(6).fill(child()))).status).toBe(400);
  });

  it('só o Idealizador define as regras; liberar, teto de crianças e capacidade', async () => {
    const id = await setup();
    expect((await davi.put(`/events/${id}/party-rules`, rules())).status).toBe(403);

    expect((await ana.put(`/events/${id}/party-rules`, rules({ maxChildren: 0 }))).status).toBe(
      200,
    );
    expect((await setCompanions(bia, id, [child()])).body.error.code).toBe('TOO_MANY_CHILDREN');
    expect((await setCompanions(bia, id, [adult()])).status).toBe(200);

    expect((await ana.put(`/events/${id}/party-rules`, rules({ maxChildren: 9 }))).status).toBe(
      400,
    );
    expect((await ana.put(`/events/${id}/party-rules`, rules({ capacity: 0 }))).status).toBe(400);
    expect((await ana.get(`/events/${id}`)).body.event.capacity).toBeNull();
  });

  it('não dá para desligar nem apertar o limite com gente já dentro', async () => {
    const id = await setup();
    await setCompanions(bia, id, [adult(), child(), child()]);
    const off = await ana.put(`/events/${id}/party-rules`, rules({ allowCompanions: false }));
    expect(off.body.error.code).toBe('COMPANIONS_IN_USE');
    const tight = await ana.put(`/events/${id}/party-rules`, rules({ maxChildren: 1 }));
    expect(tight.body.error.code).toBe('CHILDREN_IN_USE');

    await setCompanions(bia, id, []);
    expect(
      (await ana.put(`/events/${id}/party-rules`, rules({ allowCompanions: false }))).status,
    ).toBe(200);
    expect((await setCompanions(bia, id, [adult()])).body.error.code).toBe('COMPANIONS_OFF');
  });
});

describe('capacidade da casa', () => {
  it('conta cabeças: bloqueia o acompanhante que estoura a casa', async () => {
    const id = await setup(); // 4 confirmados
    expect((await ana.put(`/events/${id}/party-rules`, rules({ capacity: 5 }))).status).toBe(200);
    expect((await setCompanions(bia, id, [adult()])).status).toBe(200); // 5 cabeças
    const full = await setCompanions(caio, id, [child()]);
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe('HOUSE_FULL');

    expect((await bia.get(`/events/${id}/party`)).body).toMatchObject({
      totalHeads: 5,
      capacityLeft: 0,
    });
    expect(
      (await ana.put(`/events/${id}/party-rules`, rules({ capacity: 4 }))).body.error.code,
    ).toBe('CAPACITY_BELOW');
    // Trocar o próprio acompanhante por outro não estoura a casa.
    expect((await setCompanions(bia, id, [adult({ name: 'Outro' })])).status).toBe(200);
  });

  it('o painel do Idealizador avisa quando a casa está quase cheia', async () => {
    const id = await setup();
    await ana.put(`/events/${id}/party-rules`, rules({ capacity: 5 }));
    await setCompanions(bia, id, [adult()]);
    const alerts = (await ana.get(`/events/${id}/panel`)).body.overview.alerts;
    expect(alerts.find((a: any) => a.key === 'capacity')).toMatchObject({ tone: 'info' });
  });
});

describe('dinheiro: o responsável paga por cada cota', () => {
  const deposit = { requiresDeposit: true, depositCents: 5000, pixKey: 'ana@exemplo.com' };

  async function approved(id: string, who: Client) {
    expect((await who.upload(`/events/${id}/deposit/proof`, PNG)).status).toBe(201);
    expect(
      (await ana.post(`/events/${id}/deposits/${who.userId}/review`, { decision: 'approve' }))
        .status,
    ).toBe(200);
  }

  it('cota global: casal paga por dois, criança é isenta, e a soma dos saldos é zero', async () => {
    const id = await setup();
    await setCompanions(bia, id, [adult(), child()]); // 2 cotas
    // 5 cotas: Ana 1, Bia 2, Caio 1, Davi 1.
    await caio.post(`/events/${id}/expenses`, {
      description: 'Casa',
      category: 'lodging',
      amountCents: 10000,
      quota: 'global',
    });
    const s = (await ana.get(`/events/${id}/settlement`)).body;
    const cost = (name: string) => s.balances.find((b: any) => b.user.name === name).costCents;
    expect([cost('Ana'), cost('Bia'), cost('Caio'), cost('Davi')]).toEqual([
      2000, 4000, 2000, 2000,
    ]);
    expect(s.balances.reduce((sum: number, b: any) => sum + b.netCents, 0)).toBe(0);
  });

  it('bebida vale por pessoa: só quem bebe paga, mesmo dentro do casal', async () => {
    const id = await setup();
    await bia.put(`/events/${id}/preferences`, { drinksAlcohol: false, diet: 'omnivore' });
    await setCompanions(bia, id, [adult({ drinksAlcohol: true })]); // só o par bebe
    await caio.put(`/events/${id}/preferences`, { drinksAlcohol: true, diet: 'omnivore' });
    await caio.post(`/events/${id}/expenses`, {
      description: 'Cerveja',
      category: 'drinks',
      amountCents: 6000,
      quota: 'alcohol',
    });
    const s = (await ana.get(`/events/${id}/settlement`)).body;
    const cost = (name: string) => s.balances.find((b: any) => b.user.name === name).costCents;
    expect([cost('Bia'), cost('Caio')]).toEqual([3000, 3000]);
  });

  it('sinal por cota: o casal paga em dobro no Pix, no aviso e no acerto', async () => {
    const id = await setup(deposit);
    await setCompanions(bia, id, [adult(), child()]);

    // Janela aberta só na confirmação: aqui já está (quórum atingido no setup).
    const biaPix = (await bia.get(`/events/${id}/deposit/pix`)).body;
    const caioPix = (await caio.get(`/events/${id}/deposit/pix`)).body;
    expect([biaPix.amountCents, caioPix.amountCents]).toEqual([10000, 5000]);
    expect(biaPix.payload).toContain('5406100.00');

    await approved(id, bia);
    await approved(id, caio);
    await approved(id, davi);
    await caio.post(`/events/${id}/expenses`, {
      description: 'Casa',
      category: 'lodging',
      amountCents: 8000,
      quota: 'global',
    }); // 5 cotas: 1.600 cada
    const s = (await ana.get(`/events/${id}/settlement`)).body;
    const row = (name: string) => s.balances.find((b: any) => b.user.name === name);
    expect(row('Bia')).toMatchObject({ depositCents: 10000, costCents: 3200 });
    expect(row('Caio')).toMatchObject({ depositCents: 5000, costCents: 1600, paidCents: 8000 });
    expect(row('Ana').heldDepositsCents).toBe(20000);
    expect(s.balances.reduce((sum: number, b: any) => sum + b.netCents, 0)).toBe(0);
  });

  it('o aviso da janela do sinal já traz o valor certo de cada um', async () => {
    const { id } = (await ana.post('/events', eventInput(deposit))).body;
    await bia.post(`/events/${id}/respond`, { response: 'in' });
    await setCompanions(bia, id, [adult()]);
    await caio.post(`/events/${id}/respond`, { response: 'in' }); // confirma e abre a janela
    const body = async (who: Client) =>
      (await who.get('/notifications')).body.items.find(
        (n: any) => n.kind === 'deposit.window_opened',
      ).body;
    expect(await body(bia)).toContain('R$');
    expect(await body(bia)).toContain('100,00');
    expect(await body(bia)).toContain('2 pessoas');
    expect(await body(caio)).toContain('50,00');
    expect(await body(caio)).not.toContain('pessoas');
  });

  it('com o sinal pago, o número de cotas trava; criança continua livre', async () => {
    const id = await setup(deposit);
    await setCompanions(bia, id, [adult()]);
    await approved(id, bia);

    const party = (await bia.get(`/events/${id}/party`)).body;
    expect(party.adultsLocked).toBe(true);
    const drop = await setCompanions(bia, id, []);
    expect(drop.status).toBe(409);
    expect(drop.body.error.code).toBe('DEPOSIT_LOCKED');
    expect((await setCompanions(bia, id, [adult(), child()])).status).toBe(200);
    // Quem ainda não pagou muda à vontade.
    expect((await setCompanions(caio, id, [adult()])).status).toBe(200);
  });

  it('devolução de sinal em rolê cancelado acompanha as cotas', async () => {
    const id = await setup(deposit);
    await setCompanions(bia, id, [adult()]);
    await approved(id, bia);
    await ana.post(`/events/${id}/cancel`);
    const refunds = (await ana.get(`/events/${id}/refunds`)).body;
    expect(refunds.items.find((i: any) => i.user.name === 'Bia').amountCents).toBe(10000);
  });

  it('o orçamento por cabeça do painel divide pelas cotas que pagam', async () => {
    const id = await setup();
    await setCompanions(bia, id, [adult(), child()]);
    await ana.post(`/events/${id}/supplies/suggest`);
    const p = (await ana.get(`/events/${id}/panel`)).body;
    expect(p.supplies.perHeadEstCents).toBe(Math.ceil(p.supplies.estCents / 5));
    // O relatório mostra cabeças, mas divide o custo pelas cotas.
    await caio.post(`/events/${id}/expenses`, {
      description: 'Casa',
      category: 'lodging',
      amountCents: 10000,
      quota: 'global',
    });
    const report = (await ana.get(`/events/${id}/report`)).body;
    expect(report).toMatchObject({ headcount: 6, payingCount: 5, perHeadCents: 2000 });
  });

  it('a lista de compras sugerida leva em conta todas as cabeças', async () => {
    const id = await setup();
    await ana.post(`/events/${id}/supplies/suggest`);
    const water = (name: string, list: any[]) => list.find((i) => i.name === name).quantityLabel;
    const base = water('Água', (await ana.get(`/events/${id}/supplies`)).body.items);
    expect(base).toBe('16 L'); // 4 pessoas x 2 dias x 2 L

    const id2 = await setup();
    await setCompanions(bia, id2, [adult(), child()]);
    await ana.post(`/events/${id2}/supplies/suggest`);
    expect(water('Água', (await ana.get(`/events/${id2}/supplies`)).body.items)).toBe('24 L'); // 6 pessoas
  });
});

describe('carros: cada acompanhante ocupa um lugar', () => {
  async function car(id: string) {
    await bia.post(`/events/${id}/vehicles`, { label: 'Gol da Bia', seats: 2, cargoCapacity: 1 });
    return (await ana.get(`/events/${id}/fleet`)).body.vehicles[0];
  }

  it('o acompanhante do motorista consome lugares; passageiro com turma ocupa um por cabeça', async () => {
    const id = await setup();
    await setCompanions(bia, id, [adult()]); // vai no carro dela
    const v = await car(id);
    expect(v).toMatchObject({ seats: 2, freeSeats: 1, driverCompanions: 1 });

    await setCompanions(caio, id, [child()]); // 2 cabeças
    expect((await caio.post(`/vehicles/${v.id}/join`)).body.error.code).toBe('NO_SEATS');
    expect((await davi.post(`/vehicles/${v.id}/join`)).status).toBe(200);
    const after = (await ana.get(`/events/${id}/fleet`)).body.vehicles[0];
    expect(after.freeSeats).toBe(0);
    expect(after.passengers).toEqual([expect.objectContaining({ name: 'Davi', companions: 0 })]);
  });

  it('não cadastra carro com menos lugares que a própria turma, nem reduz abaixo do ocupado', async () => {
    const id = await setup();
    await setCompanions(bia, id, [adult(), child()]);
    const few = await bia.post(`/events/${id}/vehicles`, {
      label: 'Moto',
      seats: 1,
      cargoCapacity: 0,
    });
    expect(few.body.error.code).toBe('SEATS_TOO_FEW');
    await bia.post(`/events/${id}/vehicles`, { label: 'Gol', seats: 2, cargoCapacity: 0 });
    const v = (await ana.get(`/events/${id}/fleet`)).body.vehicles[0];
    expect((await bia.call('PATCH', `/vehicles/${v.id}`, { seats: 1 })).body.error.code).toBe(
      'SEATS_TOO_FEW',
    );
  });

  it('mudar os acompanhantes não estoura o carro em que a pessoa já está', async () => {
    const id = await setup();
    const v = await car(id);
    await davi.post(`/vehicles/${v.id}/join`);
    await caio.post(`/vehicles/${v.id}/join`);
    const full = await setCompanions(davi, id, [child()]);
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe('CAR_FULL');
  });

  it('no painel da Frota cada cabeça conta como uma pessoa a levar', async () => {
    const id = await setup();
    await setCompanions(caio, id, [adult(), child()]);
    const f = (await ana.get(`/events/${id}/panel`)).body.fleet;
    expect(f.headcount).toBe(6);
    expect(f.undecided).toBe(6);
    await caio.put(`/events/${id}/ride-plan`, { mode: 'app' });
    expect((await ana.get(`/events/${id}/panel`)).body.fleet).toMatchObject({
      appRiders: 3,
      undecided: 3,
    });
  });
});

describe('quartos: cama de casal', () => {
  const room = (over: Record<string, unknown>) => ({
    name: 'Quarto',
    beds: 0,
    doubleBeds: 0,
    ...over,
  });

  it('casal ocupa a cama de casal; sozinho não; criança divide a cama', async () => {
    const id = await setup();
    await setCompanions(bia, id, [adult(), child()]);
    await ana.post(`/events/${id}/rooms`, room({ name: 'Suíte', doubleBeds: 1 }));
    const suite = (await ana.get(`/events/${id}/rooms`)).body.rooms[0];
    expect(suite).toMatchObject({ beds: 0, doubleBeds: 1, freeDoubleBeds: 1 });

    expect((await caio.post(`/rooms/${suite.id}/join`)).body.error.code).toBe('NO_BEDS');
    expect((await bia.post(`/rooms/${suite.id}/join`)).status).toBe(200);
    const after = (await ana.get(`/events/${id}/rooms`)).body.rooms[0];
    expect(after.freeDoubleBeds).toBe(0);
    expect(after.occupants).toEqual([expect.objectContaining({ name: 'Bia', companions: 2 })]);
  });

  it('sem cama de casal, o par ocupa duas de solteiro do mesmo quarto', async () => {
    const id = await setup();
    await setCompanions(bia, id, [adult()]);
    await ana.post(`/events/${id}/rooms`, room({ name: 'Beliche', beds: 3 }));
    const r = (await ana.get(`/events/${id}/rooms`)).body.rooms[0];
    await bia.post(`/rooms/${r.id}/join`);
    expect((await ana.get(`/events/${id}/rooms`)).body.rooms[0].freeBeds).toBe(1);
    expect((await caio.post(`/rooms/${r.id}/join`)).status).toBe(200);
    expect((await davi.post(`/rooms/${r.id}/join`)).body.error.code).toBe('NO_BEDS');
  });

  it('mais de um casal: cada um pega a sua cama de casal, até acabar', async () => {
    const id = await setup();
    for (const c of [bia, caio, davi]) await setCompanions(c, id, [adult()]);
    await ana.post(`/events/${id}/rooms`, room({ name: 'Chalé', doubleBeds: 2 }));
    const r = (await ana.get(`/events/${id}/rooms`)).body.rooms[0];
    expect((await bia.post(`/rooms/${r.id}/join`)).status).toBe(200);
    expect((await caio.post(`/rooms/${r.id}/join`)).status).toBe(200);
    expect((await davi.post(`/rooms/${r.id}/join`)).body.error.code).toBe('NO_BEDS');
  });

  it('não leva um acompanhante para um quarto sem cama para ele', async () => {
    const id = await setup();
    await ana.post(`/events/${id}/rooms`, room({ name: 'Solteiro', beds: 1 }));
    const r = (await ana.get(`/events/${id}/rooms`)).body.rooms[0];
    await caio.post(`/rooms/${r.id}/join`);
    const res = await setCompanions(caio, id, [adult()]);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ROOM_FULL');
    // Criança não precisa de cama: divide a do adulto.
    expect((await setCompanions(caio, id, [child()])).status).toBe(200);
  });

  it('valida o quarto: ao menos uma cama; não reduz com gente dentro', async () => {
    const id = await setup();
    expect((await ana.post(`/events/${id}/rooms`, room({}))).status).toBe(400);
    await ana.post(`/events/${id}/rooms`, room({ name: 'Suíte', doubleBeds: 1 }));
    const r = (await ana.get(`/events/${id}/rooms`)).body.rooms[0];
    await setCompanions(bia, id, [adult()]);
    await bia.post(`/rooms/${r.id}/join`);
    expect((await ana.call('PATCH', `/rooms/${r.id}`, { doubleBeds: 0 })).body.error.code).toBe(
      'BEDS_TOO_FEW',
    );
    expect((await ana.call('PATCH', `/rooms/${r.id}`, { doubleBeds: 2, beds: 1 })).status).toBe(
      200,
    );
  });
});

describe('repetir o rolê e conta', () => {
  it('as regras e as camas de casal vêm junto; os acompanhantes não', async () => {
    const id = await setup();
    await ana.put(`/events/${id}/party-rules`, rules({ capacity: 12, maxChildren: 1 }));
    await ana.post(`/events/${id}/rooms`, { name: 'Suíte', beds: 1, doubleBeds: 1 });
    await setCompanions(bia, id, [adult()]);

    const again = (await ana.post(`/events/${id}/repeat`, { startDate: '2027-01-10' })).body;
    expect(again).toMatchObject({ capacity: 12, peopleCount: 1 });
    const copy = (await ana.get(`/events/${again.id}/rooms`)).body.rooms[0];
    expect(copy).toMatchObject({ beds: 1, doubleBeds: 1 });
    expect((await ana.get(`/events/${again.id}/party`)).body.rules).toMatchObject({
      maxChildren: 1,
    });
  });

  it('excluir a conta apaga os acompanhantes da pessoa', async () => {
    const id = await setup();
    await setCompanions(davi, id, [adult()]);
    await davi.post(`/events/${id}/respond`, { response: 'out' });
    await setCompanions(caio, id, [child()]);
    await caio.post(`/events/${id}/respond`, { response: 'out' });
    expect((await caio.post('/me/delete', { confirm: 'EXCLUIR' })).status).toBe(200);
    expect(await env.ctx.db.selectFrom('companions').selectAll().execute()).toEqual([]);
  });

  it('quem não confirmou não leva acompanhante, e rolê encerrado não aceita mudança', async () => {
    const { id } = (await ana.post('/events', eventInput())).body;
    expect((await setCompanions(bia, id, [adult()])).status).toBe(403);
    await ana.post(`/events/${id}/cancel`);
    expect((await setCompanions(ana, id, [adult()])).status).toBe(409);
  });
});
