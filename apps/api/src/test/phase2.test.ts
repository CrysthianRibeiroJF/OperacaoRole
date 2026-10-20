import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client, eventInput, makeApp, PNG } from './helpers';

type Env = Awaited<ReturnType<typeof makeApp>>;
let env: Env;
let ana: Client; // Idealizadora (cobre cargos vagos)
let bia: Client;
let caio: Client;
let davi: Client; // fora do rolê
let eva: Client;

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

async function confirmedEvent(overrides: Record<string, unknown> = {}) {
  const { id, code } = (
    await ana.post('/events', eventInput({ endDate: '2026-11-15', ...overrides }))
  ).body;
  await bia.post(`/events/${id}/respond`, { response: 'in', drinksAlcohol: true });
  await caio.post(`/events/${id}/respond`, { response: 'in', diet: 'vegetarian' });
  return { id: id as string, code: code as string };
}

describe('Mercado & Itens', () => {
  it('sugere a lista, divide microtarefas e transforma compra em despesa com a cota certa', async () => {
    const { id } = await confirmedEvent();

    expect((await bia.post(`/events/${id}/supplies/suggest`)).status).toBe(403); // só o General (ou o Idealizador, se vago)
    const suggested = await ana.post(`/events/${id}/supplies/suggest`);
    expect(suggested.status).toBe(200);
    expect(suggested.body.created).toBeGreaterThan(8);
    expect((await ana.post(`/events/${id}/supplies/suggest`)).status).toBe(409); // lista já existe

    const list = (await caio.get(`/events/${id}/supplies`)).body;
    expect(list.estimatedCents).toBeGreaterThan(0);
    const beer = list.items.find((i: any) => i.name.startsWith('Cerveja'));
    expect(beer.category).toBe('drinks_alc');

    // "Eu levo": só uma pessoa por item.
    expect((await bia.post(`/supplies/${beer.id}/claim`)).status).toBe(200);
    expect((await caio.post(`/supplies/${beer.id}/claim`)).status).toBe(409);
    expect((await eva.post(`/supplies/${beer.id}/claim`)).status).toBe(403); // fora do rolê

    // Quem não assumiu não dá baixa.
    expect(
      (await caio.post(`/supplies/${beer.id}/done`, { priceCents: 9000, createExpense: true }))
        .status,
    ).toBe(403);
    expect((await bia.post(`/supplies/${beer.id}/done`, { createExpense: true })).status).toBe(409); // preço obrigatório
    expect(
      (await bia.post(`/supplies/${beer.id}/done`, { priceCents: 9000, createExpense: true }))
        .status,
    ).toBe(200);
    expect(
      (await bia.post(`/supplies/${beer.id}/done`, { priceCents: 9000, createExpense: true }))
        .status,
    ).toBe(409); // sem despesa dupla

    const expenses = (await bia.get(`/events/${id}/expenses`)).body;
    const fromItem = expenses.filter((e: any) => e.description.startsWith('Cerveja'));
    expect(fromItem).toHaveLength(1);
    expect(fromItem[0]).toMatchObject({
      amountCents: 9000,
      quota: 'alcohol',
      paidBy: { name: 'Bia' },
      status: 'approved',
    });

    // Item que virou despesa não volta atrás nem some.
    expect((await bia.post(`/supplies/${beer.id}/undo`)).status).toBe(409);
    expect((await ana.call('DELETE', `/supplies/${beer.id}`)).status).toBe(409);

    const after = (await ana.get(`/events/${id}/supplies`)).body;
    expect(after.doneCount).toBe(1);
    expect(after.realCents).toBe(9000);
  });

  it('só o General edita a lista; baixa sem despesa pode ser desfeita', async () => {
    const { id } = await confirmedEvent();
    const item = { name: 'Farofa', category: 'other', quantityLabel: '1 kg', estPriceCents: 1500 };
    expect((await caio.post(`/events/${id}/supplies`, item)).status).toBe(403);
    expect((await ana.post(`/events/${id}/supplies`, item)).status).toBe(201);

    const farofa = (await ana.get(`/events/${id}/supplies`)).body.items[0];
    expect(
      (await caio.call('PATCH', `/supplies/${farofa.id}`, { name: 'Farofa top' })).status,
    ).toBe(403);
    expect((await ana.call('PATCH', `/supplies/${farofa.id}`, { name: 'Farofa top' })).status).toBe(
      200,
    );

    await caio.post(`/supplies/${farofa.id}/claim`);
    expect((await caio.post(`/supplies/${farofa.id}/done`, { priceCents: 1800 })).status).toBe(200);
    expect((await ana.call('PATCH', `/supplies/${farofa.id}`, { name: 'x' + 'y' })).status).toBe(
      409,
    ); // já comprado
    expect((await caio.post(`/supplies/${farofa.id}/undo`)).status).toBe(200);
    expect((await ana.get(`/events/${id}/supplies`)).body.items[0]).toMatchObject({
      done: false,
      realPriceCents: null,
    });
  });
});

describe('Frotas & Caronas', () => {
  const car = (over: Record<string, unknown> = {}) => ({
    label: 'Gol da Bia',
    seats: 2,
    cargoCapacity: 1,
    departurePlace: 'Pinheiros',
    departureTime: '08:00',
    ...over,
  });

  it('cadastra carro, reserva lugar, respeita lotação e troca de carro', async () => {
    const { id } = await confirmedEvent();
    await davi.post(`/events/${id}/respond`, { response: 'in' });

    expect((await eva.post(`/events/${id}/vehicles`, car())).status).toBe(403); // fora do rolê
    expect((await bia.post(`/events/${id}/vehicles`, car())).status).toBe(201);
    expect((await bia.post(`/events/${id}/vehicles`, car())).status).toBe(409); // um carro por motorista
    expect(
      (await ana.post(`/events/${id}/vehicles`, car({ label: 'Onix da Ana', seats: 1 }))).status,
    ).toBe(201);

    let fleet = (await caio.get(`/events/${id}/fleet`)).body;
    // O relógio dos testes é fixo, então a ordem de criação não é garantida: busca pelo nome.
    const biaCar = fleet.vehicles.find((v: any) => v.label === 'Gol da Bia');
    const anaCar = fleet.vehicles.find((v: any) => v.label === 'Onix da Ana');
    expect(fleet.seatless.map((u: any) => u.name).sort()).toEqual(['Caio', 'Davi']);

    expect((await caio.post(`/vehicles/${biaCar.id}/join`)).status).toBe(200);
    expect((await caio.post(`/vehicles/${biaCar.id}/join`)).status).toBe(200); // idempotente
    expect((await davi.post(`/vehicles/${biaCar.id}/join`)).status).toBe(200);
    expect((await bia.post(`/vehicles/${anaCar.id}/join`)).status).toBe(409); // motorista não é passageiro

    // Lotado (2 lugares).
    await ana.post(`/events/${id}/respond`, { response: 'in' });
    // Ana dirige, então não pode ocupar lugar; Eva entra no rolê só para testar a lotação.
    await eva.post(`/events/${id}/respond`, { response: 'in' });
    expect((await eva.post(`/vehicles/${biaCar.id}/join`)).status).toBe(409);

    // Troca: Caio vai para o carro da Ana e libera o lugar no da Bia.
    expect((await caio.post(`/vehicles/${anaCar.id}/join`)).status).toBe(200);
    fleet = (await caio.get(`/events/${id}/fleet`)).body;
    expect(fleet.vehicles.find((v: any) => v.id === biaCar.id)).toMatchObject({ freeSeats: 1 });
    expect(fleet.vehicles.find((v: any) => v.id === anaCar.id)).toMatchObject({ freeSeats: 0 });
    expect(fleet.myVehicleId).toBe(anaCar.id);

    // Não dá para reduzir os lugares abaixo dos passageiros.
    expect((await bia.call('PATCH', `/vehicles/${biaCar.id}`, { seats: 0 })).status).toBe(409);
    expect((await caio.call('PATCH', `/vehicles/${biaCar.id}`, { seats: 4 })).status).toBe(403);
    expect((await bia.call('PATCH', `/vehicles/${biaCar.id}`, { seats: 3 })).status).toBe(200);

    // Motorista tira passageiro; apagar o carro devolve todos para "sem lugar".
    expect((await bia.post(`/vehicles/${biaCar.id}/remove`, { userId: davi.userId })).status).toBe(
      200,
    );
    expect((await bia.call('DELETE', `/vehicles/${biaCar.id}`)).status).toBe(200);
    fleet = (await bia.get(`/events/${id}/fleet`)).body;
    expect(fleet.vehicles).toHaveLength(1);
    expect(fleet.seatless.some((u: any) => u.name === 'Davi')).toBe(true);
  });

  it('bagagem: só o General da Frota aloca e avisa quando passa da capacidade', async () => {
    const { id } = await confirmedEvent();
    await bia.post(`/events/${id}/vehicles`, car({ cargoCapacity: 1 }));
    const vehicleId = (await bia.get(`/events/${id}/fleet`)).body.vehicles[0].id;

    expect((await caio.post(`/events/${id}/cargo`, { name: 'Cooler', vehicleId })).status).toBe(
      403,
    );
    expect(
      (await ana.post(`/events/${id}/cargo`, { name: 'Cooler grande', vehicleId })).status,
    ).toBe(201);
    expect((await ana.post(`/events/${id}/cargo`, { name: 'Guarda-sol' })).status).toBe(201);

    let fleet = (await ana.get(`/events/${id}/fleet`)).body;
    expect(fleet.vehicles[0]).toMatchObject({ overloaded: false });
    expect(fleet.unassignedCargo.map((c: any) => c.name)).toEqual(['Guarda-sol']);

    const umbrella = fleet.unassignedCargo[0];
    expect((await ana.call('PATCH', `/cargo/${umbrella.id}`, { vehicleId })).status).toBe(200);
    fleet = (await ana.get(`/events/${id}/fleet`)).body;
    expect(fleet.vehicles[0]).toMatchObject({ overloaded: true });
  });

  it('com sinal exigido, só quem está com o sinal aprovado escolhe lugar (RN-14)', async () => {
    const { id } = await confirmedEvent({
      requiresDeposit: true,
      depositCents: 5000,
      pixKey: 'ana@pix.com',
    });
    await ana.post(`/events/${id}/vehicles`, car({ label: 'Onix da Ana', seats: 3 }));
    const vehicleId = (await ana.get(`/events/${id}/fleet`)).body.vehicles[0].id;

    const blocked = await bia.post(`/vehicles/${vehicleId}/join`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('DEPOSIT_REQUIRED');

    await bia.upload(`/events/${id}/deposit/proof`, PNG);
    await ana.post(`/events/${id}/deposits/${bia.userId}/review`, { decision: 'approve' });
    expect((await bia.post(`/vehicles/${vehicleId}/join`)).status).toBe(200);
  });
});

describe('Orçamento, prévia de link e conta', () => {
  it('só o General da Base (ou o Idealizador, se vago) define os custos fixos', async () => {
    const { id } = await confirmedEvent();
    expect((await caio.put(`/events/${id}/budget`, { fixedCostsCents: 150000 })).status).toBe(403);
    expect((await ana.put(`/events/${id}/budget`, { fixedCostsCents: 150000 })).status).toBe(200);
    expect((await caio.get(`/events/${id}`)).body.budget).toEqual({ fixedCostsCents: 150000 });
    expect((await ana.put(`/events/${id}/budget`, { fixedCostsCents: -1 })).status).toBe(400);
  });

  it('a página de compartilhamento expõe Open Graph sem exigir login e escapa o conteúdo', async () => {
    const { code } = (
      await ana.post(
        '/events',
        eventInput({ title: 'Rolê <script>alert(1)</script>', destination: 'Praia "X"' }),
      )
    ).body;
    const res = await env.app.inject({ method: 'GET', url: `/share/${code}` });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('property="og:title"');
    expect(res.body).toContain('Falta');
    expect(res.body).not.toContain('<script>alert');
    expect(res.body).toContain('&lt;script&gt;');
    expect(res.body).toContain(`url=/c/${code}`);

    expect((await env.app.inject({ method: 'GET', url: '/share/NAOEXISTE' })).statusCode).toBe(404);
  });

  it('exporta os dados da pessoa e só exclui a conta quando não há obrigações', async () => {
    const { id } = await confirmedEvent();

    const exported = await bia.get('/me/export');
    expect(exported.status).toBe(200);
    expect(exported.body.profile.name).toBe('Bia');
    expect(exported.body.events.some((e: any) => e.id === id)).toBe(true);

    // Organizadora com rolê ativo, e confirmada em rolê em andamento: não pode sair.
    expect((await ana.post('/me/delete', { confirm: 'EXCLUIR' })).body.error.code).toBe(
      'ACCOUNT_HAS_ACTIVE_EVENTS',
    );
    expect((await bia.post('/me/delete', { confirm: 'EXCLUIR' })).body.error.code).toBe(
      'ACCOUNT_HAS_OBLIGATIONS',
    );
    expect((await bia.post('/me/delete', { confirm: 'sim' })).status).toBe(400); // exige a confirmação literal

    // Sem rolês: a conta é anonimizada e a sessão deixa de valer.
    expect((await eva.post('/me/delete', { confirm: 'EXCLUIR' })).status).toBe(200);
    expect((await eva.get('/me')).status).toBe(401);
    const row = await env.ctx.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', eva.userId)
      .executeTakeFirstOrThrow();
    expect(row).toMatchObject({ name: 'Participante removido', pix_key: null });
    expect(row.phone).toBe(`deleted:${eva.userId}`);
    expect(row.deleted_at).not.toBeNull();
  });
});
