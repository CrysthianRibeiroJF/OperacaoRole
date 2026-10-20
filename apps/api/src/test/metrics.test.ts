import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeMetrics, formatMetrics } from '../metrics/metrics';
import { Client, eventInput, makeApp, PNG } from './helpers';

type Env = Awaited<ReturnType<typeof makeApp>>;
let env: Env;

beforeEach(async () => {
  env = await makeApp();
});

afterEach(async () => {
  await env.app.close();
  await env.ctx.db.destroy();
});

describe('métricas do PRD', () => {
  it('sem dados devolve null em vez de inventar números', async () => {
    const m = await computeMetrics(env.ctx.db, env.clock.now());
    expect(m.totals.events).toBe(0);
    expect(m.conversionRate).toBeNull();
    expect(m.medianHoursToConfirm).toBeNull();
    expect(m.settlementPaidIn7DaysRate).toBeNull();
    expect(formatMetrics(m)).toContain('sem dados');
  });

  it('calcula conversão, tempo até confirmar, sinal, cargos e acerto a partir do uso real', async () => {
    const login = (phone: string, name: string) => new Client(env.app, phone, name).login();
    const [ana, bia, caio, davi] = await Promise.all([
      login('11911111111', 'Ana'),
      login('11922222222', 'Bia'),
      login('11933333333', 'Caio'),
      login('11944444444', 'Davi'),
    ]);

    // Rolê 1: confirma em 6 horas, tem sinal, dois cargos com pessoas diferentes e conta fechada.
    const one = (
      await ana.post(
        '/events',
        eventInput({ requiresDeposit: true, depositCents: 5000, pixKey: 'a@b.com' }),
      )
    ).body.id;
    await bia.post(`/events/${one}/respond`, { response: 'in' });
    env.clock.advanceHours(6);
    await caio.post(`/events/${one}/respond`, { response: 'in' });
    await bia.post(`/events/${one}/roles/claim`, { role: 'base' });
    await caio.post(`/events/${one}/roles/claim`, { role: 'fleet' });
    await bia.upload(`/events/${one}/deposit/proof`, PNG);
    await ana.post(`/events/${one}/deposits/${bia.userId}/review`, { decision: 'approve' }); // 1 de 2 pagantes
    await caio.upload(`/events/${one}/deposit/proof`, PNG);
    await ana.post(`/events/${one}/deposits/${caio.userId}/review`, { decision: 'approve' });
    await bia.post(`/events/${one}/expenses`, {
      description: 'Gelo',
      category: 'drinks',
      amountCents: 6000,
      quota: 'global',
    });
    await ana.post(`/events/${one}/settlement/close`);

    // Rolê 2: não chega ao quórum e é arquivado.
    const two = (await davi.post('/events', eventInput({ responseHours: 24 }))).body.id;
    env.clock.advanceHours(25);
    await ana.get('/events'); // expira sob demanda
    await bia.get(
      `/invites/${(await env.ctx.db.selectFrom('events').select('code').where('id', '=', two).executeTakeFirstOrThrow()).code}`,
    );

    // Um dos acertos é pago dentro de 7 dias; o outro não.
    const transfers = await env.ctx.db.selectFrom('settlement_transfers').select(['id']).execute();
    expect(transfers.length).toBeGreaterThan(0);
    const settlement = await env.ctx.db
      .selectFrom('settlements')
      .selectAll()
      .executeTakeFirstOrThrow();
    await env.ctx.db
      .updateTable('settlement_transfers')
      .set({
        paid_at: new Date(new Date(settlement.closed_at).getTime() + 2 * 86_400_000).toISOString(),
      })
      .where('id', '=', transfers[0]!.id)
      .execute();
    env.clock.advanceHours(24 * 10);

    const m = await computeMetrics(env.ctx.db, env.clock.now());
    expect(m.totals).toMatchObject({ events: 2, closed: 1, archived: 1 });
    expect(m.conversionRate).toBe(0.5); // 1 virou rolê, 1 arquivou
    expect(m.medianHoursToConfirm).toBe(6);
    expect(m.depositApprovedRate).toBe(1); // Bia e Caio, os dois com sinal aprovado
    expect(m.rolesSharedRate).toBe(1); // Bia (Base) e Caio (Frota)
    expect(m.guestsPerConfirmedEvent).toBe(2); // Bia e Caio, além de quem criou
    const paid = m.settlementPaidIn7DaysRate;
    expect(paid).not.toBeNull();
    expect(paid!).toBeGreaterThan(0);
    expect(paid!).toBeLessThanOrEqual(1);
    expect(formatMetrics(m)).toContain('G2  Conversão de propostas        : 50%');
  });
});
