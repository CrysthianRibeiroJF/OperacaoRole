import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runDueJobs } from '../modules/jobs/runner';
import { Client, eventInput, makeApp, PNG } from './helpers';

type Env = Awaited<ReturnType<typeof makeApp>>;
let env: Env;
let ana: Client; // Idealizadora e Tesoureira
let bia: Client;
let caio: Client;
let davi: Client;
let eva: Client; // só observa

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

const notificationsOf = async (c: Client) =>
  (await c.get('/notifications')).body.items as { kind: string; body: string }[];

describe('autenticação', () => {
  it('rejeita código errado e bloqueia depois de 5 tentativas (RN de OTP)', async () => {
    const phone = '11999990000';
    await env.app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone } });
    for (let i = 0; i < 5; i++) {
      const r = await env.app.inject({
        method: 'POST',
        url: '/api/auth/otp/verify',
        payload: { phone, code: '000000', name: 'Zé' },
      });
      expect(r.statusCode).toBe(401);
    }
    const locked = await env.app.inject({
      method: 'POST',
      url: '/api/auth/otp/verify',
      payload: { phone, code: '000000', name: 'Zé' },
    });
    expect(locked.statusCode).toBe(429);
  });

  it('pede o nome de quem é novo sem queimar o código', async () => {
    const phone = '11988887777';
    const { devCode } = (
      await env.app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone } })
    ).json();
    const first = await env.app.inject({
      method: 'POST',
      url: '/api/auth/otp/verify',
      payload: { phone, code: devCode },
    });
    expect(first.statusCode).toBe(422);
    expect(first.json().error.code).toBe('NAME_REQUIRED');
    const second = await env.app.inject({
      method: 'POST',
      url: '/api/auth/otp/verify',
      payload: { phone, code: devCode, name: 'Novo' },
    });
    expect(second.statusCode).toBe(200);
  });

  it('exige sessão para rotas privadas', async () => {
    const anon = new Client(env.app, '0', 'x');
    expect((await anon.get('/events')).status).toBe(401);
  });
});

describe('massa crítica (as 3 andorinhas)', () => {
  it('confirma o rolê quando o quórum é atingido e avisa a turma', async () => {
    const created = await ana.post('/events', eventInput());
    expect(created.status).toBe(201);
    const { id, code } = created.body;
    expect(created.body).toMatchObject({ status: 'open', confirmedCount: 1, missing: 2 });

    // Convite público, sem login (modo Observador).
    const anon = new Client(env.app, '0', 'x');
    const invite = await anon.get(`/invites/${code}`);
    expect(invite.status).toBe(200);
    expect(invite.body.me).toBeNull();

    const r1 = await bia.post(`/events/${id}/respond`, { response: 'in' });
    expect(r1.body.event).toMatchObject({ status: 'open', missing: 1 });
    expect((await notificationsOf(ana)).some((n) => n.kind === 'quorum.almost')).toBe(true);

    // Resposta repetida é idempotente.
    const again = await bia.post(`/events/${id}/respond`, { response: 'in' });
    expect(again.body.event.confirmedCount).toBe(2);

    const r2 = await caio.post(`/events/${id}/respond`, { response: 'in' });
    expect(r2.body.event).toMatchObject({ status: 'confirmed', confirmedCount: 3, missing: 0 });
    expect((await notificationsOf(bia)).some((n) => n.kind === 'event.confirmed')).toBe(true);
  });

  it('confirmações simultâneas no limite do quórum confirmam uma única vez', async () => {
    const { id } = (await ana.post('/events', eventInput({ quorum: 3 }))).body;
    const results = await Promise.all([
      bia.post(`/events/${id}/respond`, { response: 'in' }),
      caio.post(`/events/${id}/respond`, { response: 'in' }),
      davi.post(`/events/${id}/respond`, { response: 'in' }),
      bia.post(`/events/${id}/respond`, { response: 'in' }),
    ]);
    expect(results.every((r) => r.status === 200)).toBe(true);

    const card = (await ana.get('/events')).body.find((e: any) => e.id === id);
    expect(card).toMatchObject({ status: 'confirmed', confirmedCount: 4 });
    const confirmedNotices = (await notificationsOf(ana)).filter(
      (n) => n.kind === 'event.confirmed',
    );
    expect(confirmedNotices).toHaveLength(1);
  });

  it('arquiva a proposta quando o prazo vence sem quórum (job)', async () => {
    const { id } = (await ana.post('/events', eventInput({ responseHours: 24 }))).body;
    await bia.post(`/events/${id}/respond`, { response: 'in' });
    env.clock.advanceHours(25);
    await runDueJobs(env.ctx);

    const feed = (await ana.get('/events')).body as { id: string; status: string }[];
    expect(feed.find((e) => e.id === id)?.status).toBe('archived');
    expect((await davi.post(`/events/${id}/respond`, { response: 'in' })).status).toBe(409);
    expect((await notificationsOf(bia)).some((n) => n.kind === 'event.archived')).toBe(true);
  });

  it('o rolê confirmado continua confirmado se alguém sai, e avisa o Idealizador (RN-07)', async () => {
    const { id } = (await ana.post('/events', eventInput())).body;
    await bia.post(`/events/${id}/respond`, { response: 'in' });
    await caio.post(`/events/${id}/respond`, { response: 'in' });
    const out = await caio.post(`/events/${id}/respond`, { response: 'out' });
    expect(out.body.event).toMatchObject({
      status: 'confirmed',
      belowQuorum: true,
      confirmedCount: 2,
    });
    expect((await notificationsOf(ana)).some((n) => n.kind === 'quorum.below')).toBe(true);
  });

  it('o Idealizador não pode ficar de fora do próprio rolê', async () => {
    const { id } = (await ana.post('/events', eventInput())).body;
    const res = await ana.post(`/events/${id}/respond`, { response: 'out' });
    expect(res.status).toBe(422);
  });

  it('valida o cartão fechado', async () => {
    expect((await ana.post('/events', eventInput({ title: '' }))).status).toBe(400);
    expect((await ana.post('/events', eventInput({ quorum: 1 }))).status).toBe(400);
    expect((await ana.post('/events', eventInput({ quorum: 7 }))).status).toBe(400);
    expect((await ana.post('/events', eventInput({ requiresDeposit: true }))).status).toBe(400);
  });
});

/** Cria um rolê confirmado com Ana (Idealizadora), Bia e Caio. */
async function confirmedEvent(overrides: Record<string, unknown> = {}) {
  const { id } = (await ana.post('/events', eventInput(overrides))).body;
  await bia.post(`/events/${id}/respond`, { response: 'in' });
  await caio.post(`/events/${id}/respond`, { response: 'in' });
  return id as string;
}

describe('papéis e permissões', () => {
  it('Observador não entra no QG nem assume cargo', async () => {
    const id = await confirmedEvent();
    expect((await eva.get(`/events/${id}`)).status).toBe(403);
    expect((await eva.post(`/events/${id}/roles/claim`, { role: 'base' })).status).toBe(403);
    expect(
      (
        await eva.post(`/events/${id}/expenses`, {
          description: 'Gelo',
          category: 'food',
          amountCents: 100,
          quota: 'global',
        })
      ).status,
    ).toBe(403);
  });

  it('cada cargo tem um ocupante e cada pessoa um teto de cargos', async () => {
    const id = await confirmedEvent();
    expect((await bia.post(`/events/${id}/roles/claim`, { role: 'base' })).status).toBe(200);
    expect((await caio.post(`/events/${id}/roles/claim`, { role: 'base' })).status).toBe(409);
    expect((await bia.post(`/events/${id}/roles/claim`, { role: 'fleet' })).status).toBe(200);
    const third = await bia.post(`/events/${id}/roles/claim`, { role: 'supplies' });
    expect(third.status).toBe(409);
    expect(third.body.error.code).toBe('ROLE_LIMIT');
  });

  it('só o General da Base edita a Base; o Idealizador cobre enquanto o cargo está vago (RN-25)', async () => {
    const id = await confirmedEvent();
    const base = {
      address: 'Rua das Palmeiras, 10',
      wifiName: 'Casa',
      wifiPassword: 'senha123',
      gateCode: '4321',
      checkoutTime: '11h',
      houseRules: 'Sem som após 22h',
      schedule: null,
    };
    expect((await caio.put(`/events/${id}/base`, base)).status).toBe(403);
    expect((await ana.put(`/events/${id}/base`, base)).status).toBe(200); // vago: Idealizador cobre

    await bia.post(`/events/${id}/roles/claim`, { role: 'base' });
    expect((await ana.put(`/events/${id}/base`, base)).status).toBe(403); // agora é da Bia
    expect((await bia.put(`/events/${id}/base`, base)).status).toBe(200);

    const detail = await caio.get(`/events/${id}`);
    expect(detail.body.base.wifiPassword).toBe('senha123');
    expect(detail.body.me.can['base.edit']).toBe(false);
  });

  it('sorteio distribui cargos vagos e quem recusa não é sorteado de novo (RN-21)', async () => {
    const id = await confirmedEvent();
    expect((await bia.post(`/events/${id}/roles/draw`)).status).toBe(403);
    const draw = await ana.post(`/events/${id}/roles/draw`);
    expect(draw.status).toBe(200);
    expect(draw.body.assigned).toHaveLength(4);

    const detail = (await ana.get(`/events/${id}`)).body;
    const drawnToBia = detail.roles.find((r: any) => r.user?.name === 'Bia');
    if (drawnToBia) {
      await bia.post(`/events/${id}/roles/release`, { role: drawnToBia.role });
      const redraw = await ana.post(`/events/${id}/roles/draw`);
      const after = (await ana.get(`/events/${id}`)).body.roles.find(
        (r: any) => r.role === drawnToBia.role,
      );
      expect(redraw.status).toBe(200);
      expect(after.user?.name).not.toBe('Bia');
    }
  });
});

describe('sinal anti-pipoca', () => {
  const withDeposit = { requiresDeposit: true, depositCents: 5000, pixKey: 'ana@pix.com' };

  it('abre a janela ao confirmar, aprova/recusa comprovantes e manda quem atrasa para a fila', async () => {
    const id = await confirmedEvent(withDeposit);
    const detail = (await bia.get(`/events/${id}`)).body;
    expect(detail.deposit).toMatchObject({
      required: true,
      amountCents: 5000,
      pixKey: 'ana@pix.com',
    });
    expect(detail.deposit.openedAt).not.toBeNull();
    expect(detail.me.depositStatus).toBe('pending');
    expect((await ana.get(`/events/${id}`)).body.me.depositStatus).toBe('approved'); // Tesoureira segura o dinheiro
    expect((await notificationsOf(bia)).some((n) => n.kind === 'deposit.window_opened')).toBe(true);

    // Arquivo que não é imagem/PDF é recusado.
    expect(
      (await bia.upload(`/events/${id}/deposit/proof`, Buffer.from('não sou imagem'))).status,
    ).toBe(415);
    expect((await bia.upload(`/events/${id}/deposit/proof`, PNG)).status).toBe(201);
    expect((await bia.upload(`/events/${id}/deposit/proof`, PNG)).status).toBe(409); // já em análise

    // Só quem opera o Tesouro vê a fila e aprova.
    expect((await caio.get(`/events/${id}/deposits`)).status).toBe(403);
    expect(
      (await bia.post(`/events/${id}/deposits/${bia.userId}/review`, { decision: 'approve' }))
        .status,
    ).toBe(403);
    const queue = await ana.get(`/events/${id}/deposits`);
    expect(queue.body.find((q: any) => q.user.name === 'Bia').status).toBe('submitted');

    expect(
      (await ana.post(`/events/${id}/deposits/${bia.userId}/review`, { decision: 'approve' }))
        .status,
    ).toBe(200);
    expect((await bia.get(`/events/${id}`)).body.me.depositStatus).toBe('approved');

    // Comprovante visível só para o dono e o Tesoureiro.
    expect((await bia.get(`/events/${id}/deposits/${bia.userId}/proof`)).status).toBe(200);
    expect((await caio.get(`/events/${id}/deposits/${bia.userId}/proof`)).status).toBe(403);

    // Caio manda comprovante e é recusado; recusa exige motivo.
    await caio.upload(`/events/${id}/deposit/proof`, PNG);
    expect(
      (await ana.post(`/events/${id}/deposits/${caio.userId}/review`, { decision: 'reject' }))
        .status,
    ).toBe(400);
    await ana.post(`/events/${id}/deposits/${caio.userId}/review`, {
      decision: 'reject',
      reason: 'valor errado',
    });
    expect((await caio.get(`/events/${id}`)).body.me.depositStatus).toBe('rejected');

    // Prazo vence: quem não está quite vai para a fila de espera; quem pagou continua.
    env.clock.advanceHours(49);
    await runDueJobs(env.ctx);
    expect((await caio.get(`/events/${id}`)).body.me.depositStatus).toBe('waitlisted');
    expect((await bia.get(`/events/${id}`)).body.me.depositStatus).toBe('approved');
    expect((await notificationsOf(caio)).some((n) => n.kind === 'deposit.waitlisted')).toBe(true);
  });

  it('quem entra depois da janela aberta nasce pendente, e atrasado vai direto para a fila', async () => {
    const id = await confirmedEvent(withDeposit);
    await davi.post(`/events/${id}/respond`, { response: 'in' });
    expect((await davi.get(`/events/${id}`)).body.me.depositStatus).toBe('pending');
    env.clock.advanceHours(49);
    await runDueJobs(env.ctx);
    await eva.post(`/events/${id}/respond`, { response: 'in' });
    expect((await eva.get(`/events/${id}`)).body.me.depositStatus).toBe('waitlisted');
  });

  it('não deixa mexer no valor depois que a janela abriu', async () => {
    const id = await confirmedEvent(withDeposit);
    const res = await ana.put(`/events/${id}/deposit`, {
      required: true,
      amountCents: 9000,
      pixKey: 'ana@pix.com',
    });
    expect(res.status).toBe(409);
    expect((await ana.put(`/events/${id}/deposit`, { required: false })).status).toBe(409);
  });

  it('o Tesoureiro configura o sinal depois, e a janela abre ao salvar', async () => {
    const id = await confirmedEvent();
    expect(
      (
        await bia.put(`/events/${id}/deposit`, {
          required: true,
          amountCents: 3000,
          pixKey: 'x@y.com',
        })
      ).status,
    ).toBe(403);
    const res = await ana.put(`/events/${id}/deposit`, {
      required: true,
      amountCents: 3000,
      pixKey: 'x@y.com',
    });
    expect(res.status).toBe(200);
    expect(res.body.openedAt).not.toBeNull();
    expect((await bia.get(`/events/${id}`)).body.me.depositStatus).toBe('pending');
  });
});

describe('despesas, rateio e acerto de contas', () => {
  const expense = (over: Record<string, unknown> = {}) => ({
    description: 'Carvão e gelo',
    category: 'food',
    amountCents: 12000,
    quota: 'global',
    ...over,
  });

  it('fluxo completo: sinal → despesas → aprovação → fechamento → pagamento', async () => {
    const id = await confirmedEvent({
      requiresDeposit: true,
      depositCents: 5000,
      pixKey: 'ana@pix.com',
    });

    // Bia está quite; Caio teve o comprovante recusado, Davi nem enviou.
    await bia.upload(`/events/${id}/deposit/proof`, PNG);
    await ana.post(`/events/${id}/deposits/${bia.userId}/review`, { decision: 'approve' });
    await caio.upload(`/events/${id}/deposit/proof`, PNG);
    await ana.post(`/events/${id}/deposits/${caio.userId}/review`, {
      decision: 'reject',
      reason: 'ilegível',
    });

    // Despesa pequena entra direto; a grande aguarda o Tesoureiro (limite de R$ 300).
    const small = await bia.post(`/events/${id}/expenses`, expense());
    expect(small.body.status).toBe('approved');
    const big = await caio.post(
      `/events/${id}/expenses`,
      expense({ description: 'Mercado', amountCents: 40000 }),
    );
    expect(big.body.status).toBe('pending');
    expect((await caio.upload(`/expenses/${big.body.id}/receipt`, PNG)).status).toBe(201);
    expect((await bia.get(`/expenses/${big.body.id}/receipt`)).status).toBe(200);
    expect((await eva.get(`/expenses/${big.body.id}/receipt`)).status).toBe(403);

    // Fechar com despesa pendente é bloqueado, e só o Tesoureiro vê as pendências.
    const blocked = await ana.post(`/events/${id}/settlement/close`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('SETTLEMENT_BLOCKED');
    expect((await bia.post(`/events/${id}/settlement/close`)).status).toBe(403);
    expect(
      (await bia.post(`/expenses/${big.body.id}/review`, { decision: 'approve' })).status,
    ).toBe(403);

    // Contestação bloqueia até ser decidida.
    expect(
      (await bia.post(`/expenses/${big.body.id}/review`, { decision: 'approve' })).status,
    ).toBe(403);
    await ana.post(`/expenses/${big.body.id}/review`, { decision: 'approve' });
    await bia.post(`/expenses/${small.body.id}/contest`, { reason: 'valor parece alto' });
    expect((await ana.post(`/events/${id}/settlement/close`)).status).toBe(409);
    await ana.post(`/expenses/${small.body.id}/resolve-contest`, {
      decision: 'keep',
      note: 'nota confere',
    });

    // Prévia do Tesoureiro: 520,00 divididos entre Ana e Bia (únicas quites).
    const preview = (await ana.get(`/events/${id}/settlement`)).body;
    expect(preview.closed).toBe(false);
    const net = (name: string) => preview.balances.find((b: any) => b.user.name === name).netCents;
    expect(net('Ana')).toBe(-31000);
    expect(net('Bia')).toBe(-9000);
    expect(net('Caio')).toBe(40000);
    expect(preview.balances.reduce((s: number, b: any) => s + b.netCents, 0)).toBe(0);

    // Antes de fechar, o participante comum só enxerga a própria projeção.
    expect((await bia.get(`/events/${id}/settlement`)).body.balances).toEqual([]);
    const vault = (await bia.get(`/events/${id}/vault`)).body;
    expect(vault).toMatchObject({
      paidByMeCents: 12000,
      depositPaidCents: 5000,
      projectedNetCents: -9000,
      settled: false,
    });

    expect((await ana.post(`/events/${id}/settlement/close`)).status).toBe(200);
    expect((await ana.post(`/events/${id}/settlement/close`)).status).toBe(409);

    // Cobrança privada: Bia vê só o que é dela; Eva (de fora) nem entra.
    const biaView = (await bia.get(`/events/${id}/settlement`)).body;
    expect(biaView.closed).toBe(true);
    expect(biaView.balances).toHaveLength(1);
    expect(biaView.transfers).toHaveLength(1);
    expect(biaView.transfers[0]).toMatchObject({
      amountCents: 9000,
      from: { name: 'Bia' },
      to: { name: 'Caio' },
    });
    expect((await eva.get(`/events/${id}/settlement`)).status).toBe(403);
    expect((await notificationsOf(bia)).some((n) => n.kind === 'settlement.closed')).toBe(true);
    expect((await notificationsOf(davi)).some((n) => n.kind === 'settlement.closed')).toBe(false);

    // Depois do fechamento nada mais muda.
    expect((await bia.post(`/events/${id}/expenses`, expense())).status).toBe(409);

    // O credor dá baixa quando o Pix cai.
    const transferId = biaView.transfers[0].id;
    expect((await davi.post(`/transfers/${transferId}/confirm`)).status).toBe(403);
    expect((await caio.post(`/transfers/${transferId}/confirm`)).status).toBe(200);
    expect((await bia.get(`/events/${id}/settlement`)).body.transfers[0].paidAt).not.toBeNull();

    // Lembretes D+3/D+7 só cobram quem ainda deve.
    env.clock.advanceHours(24 * 8);
    await runDueJobs(env.ctx);
    const anaNotes = await notificationsOf(ana);
    expect(anaNotes.filter((n) => n.kind === 'settlement.reminder').length).toBeGreaterThan(0);
    const biaNotes = await notificationsOf(bia);
    expect(biaNotes.some((n) => n.kind === 'settlement.reminder')).toBe(false);
  });

  it('dividir só entre quem bebe, e despesa sem beneficiários bloqueia o fechamento', async () => {
    const id = await confirmedEvent();
    await ana.post(
      `/events/${id}/expenses`,
      expense({ description: 'Cerveja', quota: 'alcohol', amountCents: 9000 }),
    );
    const blocked = await ana.post(`/events/${id}/settlement/close`);
    expect(blocked.status).toBe(409); // ninguém marcou "bebo álcool"

    await bia.put(`/events/${id}/preferences`, { drinksAlcohol: true, diet: 'omnivore' });
    await caio.put(`/events/${id}/preferences`, { drinksAlcohol: true, diet: 'omnivore' });
    const ok = await ana.post(`/events/${id}/settlement/close`);
    expect(ok.status).toBe(200);
    const view = (await ana.get(`/events/${id}/settlement`)).body;
    const cost = (n: string) => view.balances.find((b: any) => b.user.name === n).costCents;
    expect(cost('Bia')).toBe(4500);
    expect(cost('Caio')).toBe(4500);
    expect(cost('Ana')).toBe(0);
  });

  it('rejeita participantes de fora na cota custom e contestação fora do prazo', async () => {
    const id = await confirmedEvent();
    const bad = await bia.post(
      `/events/${id}/expenses`,
      expense({ quota: 'custom', customParticipantIds: [eva.userId] }),
    );
    expect(bad.status).toBe(422);

    const ok = await bia.post(
      `/events/${id}/expenses`,
      expense({
        quota: 'custom',
        customParticipantIds: [bia.userId, caio.userId],
        description: 'Gasolina',
      }),
    );
    expect(ok.status).toBe(201);
    env.clock.advanceHours(73);
    expect(
      (await caio.post(`/expenses/${ok.body.id}/contest`, { reason: 'tarde demais' })).status,
    ).toBe(409);
  });
});

describe('cancelamento e notificações', () => {
  it('só o Idealizador cancela e a turma é avisada', async () => {
    const id = await confirmedEvent();
    expect((await bia.post(`/events/${id}/cancel`)).status).toBe(403);
    expect((await ana.post(`/events/${id}/cancel`)).status).toBe(200);
    expect((await notificationsOf(bia)).some((n) => n.kind === 'event.cancelled')).toBe(true);
    expect((await davi.post(`/events/${id}/respond`, { response: 'in' })).status).toBe(409);
  });

  it('silenciar um rolê corta as notificações dele (RN-51)', async () => {
    const { id } = (await ana.post('/events', eventInput())).body;
    await bia.post(`/events/${id}/respond`, { response: 'in' });
    await ana.put(`/events/${id}/mute`, { muted: true });
    await caio.post(`/events/${id}/respond`, { response: 'in' });
    expect((await notificationsOf(ana)).some((n) => n.kind === 'event.confirmed')).toBe(false);
    expect((await notificationsOf(bia)).some((n) => n.kind === 'event.confirmed')).toBe(true);
  });

  it('marca notificações como lidas', async () => {
    await confirmedEvent();
    const before = (await bia.get('/notifications')).body;
    expect(before.unread).toBeGreaterThan(0);
    await bia.post('/notifications/read', {});
    expect((await bia.get('/notifications')).body.unread).toBe(0);
  });
});
