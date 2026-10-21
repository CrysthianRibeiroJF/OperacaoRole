import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeMetrics, formatMetrics } from '../metrics/metrics';
import { Client, eventInput, makeApp, PNG } from './helpers';

type Env = Awaited<ReturnType<typeof makeApp>>;
let env: Env;
let ana: Client;
let bia: Client;
let caio: Client;

beforeEach(async () => {
  env = await makeApp();
  const login = (phone: string, name: string) => new Client(env.app, phone, name).login();
  [ana, bia, caio] = await Promise.all([
    login('11911111111', 'Ana'),
    login('11922222222', 'Bia'),
    login('11933333333', 'Caio'),
  ]);
});

afterEach(async () => {
  await env.app.close();
  await env.ctx.db.destroy();
});

/**
 * Rotas que precisam responder sem sessão (convite, enquete e prévia da tropa em modo leitura,
 * entrada, telemetria, saúde). Votar, entrar na tropa e criar continuam exigindo conta.
 */
const PUBLIC = new Set([
  'GET /api/health',
  'GET /api/session',
  'GET /api/invites/:code',
  'GET /api/polls/:code',
  'GET /api/crews/code/:code',
  'POST /api/auth/register',
  'POST /api/auth/login',
  'POST /api/auth/recover',
  'POST /api/auth/logout',
  'POST /api/telemetry/error',
  'POST /api/telemetry/track',
  'GET /share/:code',
]);

describe('guarda de autorização', () => {
  it('toda rota privada recusa quem não tem sessão (nada ficou aberto por esquecimento)', async () => {
    const routes = env.app.routeTable
      .filter((r) => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method))
      .filter((r) => r.url.startsWith('/api') || r.url.startsWith('/share'));
    expect(routes.length).toBeGreaterThan(60); // garante que a tabela está de fato populada

    const open: string[] = [];
    for (const r of routes) {
      const key = `${r.method} ${r.url}`;
      if (PUBLIC.has(key)) continue;
      const url = r.url.replace(/:\w+/g, 'x');
      const res = await env.app.inject({
        method: r.method as 'GET',
        url,
        payload: ['POST', 'PUT', 'PATCH'].includes(r.method) ? {} : undefined,
      });
      if (res.statusCode !== 401) open.push(`${key} -> ${res.statusCode}`);
    }
    expect(open).toEqual([]);
  });
});

describe('transferência de Idealizador', () => {
  it('passa o comando a um confirmado; só quem comanda passa; o novo cobre os cargos vagos', async () => {
    const { id } = (await ana.post('/events', eventInput())).body;
    await bia.post(`/events/${id}/respond`, { response: 'in' });

    expect(
      (await bia.post(`/events/${id}/transfer-organizer`, { userId: caio.userId })).status,
    ).toBe(403);
    expect(
      (await ana.post(`/events/${id}/transfer-organizer`, { userId: caio.userId })).status,
    ).toBe(422); // não confirmou
    expect(
      (await ana.post(`/events/${id}/transfer-organizer`, { userId: ana.userId })).status,
    ).toBe(422);

    expect(
      (await ana.post(`/events/${id}/transfer-organizer`, { userId: bia.userId })).status,
    ).toBe(200);
    const detail = (await bia.get(`/events/${id}`)).body;
    expect(detail.me.isOrganizer).toBe(true);
    expect(detail.event.organizer.name).toBe('Bia');
    expect((await ana.get(`/events/${id}`)).body.me.isOrganizer).toBe(false);
    expect(
      (await bia.get('/notifications')).body.items.some(
        (n: any) => n.kind === 'event.organizer_transferred',
      ),
    ).toBe(true);

    // Quem era Idealizadora deixa de poder cancelar; a nova comanda.
    expect((await ana.post(`/events/${id}/cancel`)).status).toBe(403);
    expect((await bia.post(`/events/${id}/cancel`)).status).toBe(200);
  });
});

describe('devolução de sinal em rolê cancelado', () => {
  async function paidEvent() {
    const { id } = (
      await ana.post(
        '/events',
        eventInput({ requiresDeposit: true, depositCents: 5000, pixKey: 'ana@pix.com' }),
      )
    ).body;
    await bia.post(`/events/${id}/respond`, { response: 'in' });
    await caio.post(`/events/${id}/respond`, { response: 'in' });
    await bia.upload(`/events/${id}/deposit/proof`, PNG);
    await ana.post(`/events/${id}/deposits/${bia.userId}/review`, { decision: 'approve' });
    return id as string;
  }

  it('o Tesoureiro vê quem pagou, marca as devoluções e a pessoa é avisada', async () => {
    const id = await paidEvent();
    expect((await ana.get(`/events/${id}/refunds`)).body.items).toEqual([]); // não está cancelado

    await ana.post(`/events/${id}/cancel`);
    const view = (await ana.get(`/events/${id}/refunds`)).body;
    expect(view.canManage).toBe(true);
    expect(view.items).toHaveLength(1); // só a Bia tem sinal aprovado
    expect(view.items[0]).toMatchObject({
      amountCents: 5000,
      refundedAt: null,
      user: { name: 'Bia' },
    });

    // Cada um vê só a própria linha; quem não pagou não tem nada a receber.
    expect((await bia.get(`/events/${id}/refunds`)).body.items).toHaveLength(1);
    expect((await caio.get(`/events/${id}/refunds`)).body.items).toEqual([]);

    expect((await bia.post(`/events/${id}/refunds/${bia.userId}`)).status).toBe(403);
    expect((await ana.post(`/events/${id}/refunds/${caio.userId}`)).status).toBe(404);
    expect((await ana.post(`/events/${id}/refunds/${bia.userId}`)).status).toBe(200);
    expect((await ana.post(`/events/${id}/refunds/${bia.userId}`)).status).toBe(200); // idempotente

    expect((await bia.get(`/events/${id}/refunds`)).body.items[0].refundedAt).not.toBeNull();
    expect(
      (await bia.get('/notifications')).body.items.filter(
        (n: any) => n.kind === 'deposit.refunded',
      ),
    ).toHaveLength(1);
  });

  it('só rolê cancelado tem devolução', async () => {
    const id = await paidEvent();
    expect((await ana.post(`/events/${id}/refunds/${bia.userId}`)).status).toBe(409);
  });
});

describe('monitoramento interno', () => {
  it('guarda erros do app e eventos de uso, recusa nomes fora da lista e limita o tamanho', async () => {
    const anon = new Client(env.app, '0', 'x');
    expect(
      (await anon.post('/telemetry/error', { message: 'TypeError: x', path: '/c/ABC' })).status,
    ).toBe(204);
    expect((await anon.post('/telemetry/error', { message: 'a'.repeat(301) })).status).toBe(400);
    expect(
      (await anon.post('/telemetry/track', { name: 'invite_viewed', path: '/c/ABC' })).status,
    ).toBe(204);
    expect((await bia.post('/telemetry/track', { name: 'share_clicked' })).status).toBe(204);
    expect((await anon.post('/telemetry/track', { name: 'coisa_aleatoria' })).status).toBe(400);

    const errors = await env.ctx.db.selectFrom('error_events').selectAll().execute();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ source: 'client', route: '/c/ABC' });
    const tracked = await env.ctx.db.selectFrom('analytics_events').selectAll().execute();
    expect(tracked.map((t) => t.name).sort()).toEqual(['invite_viewed', 'share_clicked']);
    expect(tracked.find((t) => t.name === 'share_clicked')?.user_id).toBe(bia.userId);
  });

  it('um erro 500 real vira registro no servidor sem vazar detalhes para quem chamou', async () => {
    await env.ctx.db.schema.dropTable('notifications').execute(); // força uma falha inesperada
    const res = await ana.get('/notifications');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/notifications|SQL|no such table/i);

    await new Promise((r) => setTimeout(r, 50));
    const rows = await env.ctx.db.selectFrom('error_events').selectAll().execute();
    expect(rows.some((r) => r.source === 'server' && /GET/.test(r.route ?? ''))).toBe(true);
  });

  it('as métricas mostram o funil e os erros das últimas 24 horas', async () => {
    const anon = new Client(env.app, '0', 'x');
    await anon.post('/telemetry/track', { name: 'invite_viewed' });
    await anon.post('/telemetry/track', { name: 'signup_started' });
    await anon.post('/telemetry/error', { message: 'falha no app' });

    const m = await computeMetrics(env.ctx.db, env.clock.now());
    expect(m.funnel).toMatchObject({ invitesViewed: 1, signupsStarted: 1, accountsCreated: 3 });
    expect(m.errorsLast24h).toEqual({ server: 0, client: 1 });
    expect(formatMetrics(m)).toContain('Funil: 1 convites abertos');

    env.clock.advanceHours(25);
    expect((await computeMetrics(env.ctx.db, env.clock.now())).errorsLast24h.client).toBe(0);
  });
});
