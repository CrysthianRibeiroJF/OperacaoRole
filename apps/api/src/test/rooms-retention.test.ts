import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runDueJobs } from '../modules/jobs/runner';
import { Client, eventInput, makeApp, PNG } from './helpers';

type Env = Awaited<ReturnType<typeof makeApp>>;
let env: Env;
let ana: Client; // Idealizadora, Tesoureira e Base (cargos vagos)
let bia: Client;
let caio: Client;
let davi: Client; // fora do rolê

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

async function confirmedEvent(overrides: Record<string, unknown> = {}) {
  const { id } = (await ana.post('/events', eventInput(overrides))).body;
  await bia.post(`/events/${id}/respond`, { response: 'in' });
  await caio.post(`/events/${id}/respond`, { response: 'in' });
  return id as string;
}

describe('quartos', () => {
  it('o General da Base monta os quartos e cada um pega a própria cama, respeitando a lotação', async () => {
    const id = await confirmedEvent();

    expect((await bia.post(`/events/${id}/rooms`, { name: 'Suíte', beds: 2 })).status).toBe(403);
    expect((await ana.post(`/events/${id}/rooms`, { name: 'Suíte', beds: 1 })).status).toBe(201);
    expect(
      (await ana.post(`/events/${id}/rooms`, { name: 'Quarto das camas', beds: 2 })).status,
    ).toBe(201);
    expect((await ana.post(`/events/${id}/rooms`, { name: 'x', beds: 2 })).status).toBe(400);

    let view = (await bia.get(`/events/${id}/rooms`)).body;
    const suite = view.rooms.find((r: any) => r.name === 'Suíte');
    const camas = view.rooms.find((r: any) => r.name === 'Quarto das camas');
    expect(view.unassigned.map((u: any) => u.name).sort()).toEqual(['Ana', 'Bia', 'Caio']);

    expect((await davi.post(`/rooms/${suite.id}/join`)).status).toBe(403); // fora do rolê
    expect((await bia.post(`/rooms/${suite.id}/join`)).status).toBe(200);
    expect((await bia.post(`/rooms/${suite.id}/join`)).status).toBe(200); // idempotente
    expect((await caio.post(`/rooms/${suite.id}/join`)).status).toBe(409); // lotado

    // Troca de quarto libera a cama anterior.
    expect((await bia.post(`/rooms/${camas.id}/join`)).status).toBe(200);
    expect((await caio.post(`/rooms/${suite.id}/join`)).status).toBe(200);
    view = (await bia.get(`/events/${id}/rooms`)).body;
    expect(view.myRoomId).toBe(camas.id);
    expect(view.rooms.find((r: any) => r.id === camas.id)).toMatchObject({ freeBeds: 1 });
    expect(view.rooms.find((r: any) => r.id === suite.id)).toMatchObject({ freeBeds: 0 });

    // Não dá para reduzir camas abaixo de quem já está; remover o quarto libera e avisa.
    expect((await ana.call('PATCH', `/rooms/${suite.id}`, { beds: 1 })).status).toBe(200);
    expect((await ana.call('PATCH', `/rooms/${camas.id}`, { beds: 0 })).status).toBe(400); // mínimo de 1 cama
    expect((await ana.call('DELETE', `/rooms/${suite.id}`)).status).toBe(200);
    const kinds = ((await caio.get('/notifications')).body.items as { kind: string }[]).map(
      (n) => n.kind,
    );
    expect(kinds).toContain('rooms.room_removed');
  });

  it('o General aloca e retira pessoas, e quem sai do rolê ocupa lugar nenhum', async () => {
    const id = await confirmedEvent();
    await ana.post(`/events/${id}/rooms`, { name: 'Suíte', beds: 2 });
    const roomId = (await ana.get(`/events/${id}/rooms`)).body.rooms[0].id;

    expect((await bia.post(`/rooms/${roomId}/assign`, { userId: caio.userId })).status).toBe(403);
    expect((await ana.post(`/rooms/${roomId}/assign`, { userId: caio.userId })).status).toBe(200);
    expect((await ana.post(`/rooms/${roomId}/assign`, { userId: davi.userId })).status).toBe(403); // não confirmou
    expect(
      (await caio.get('/notifications')).body.items.some((n: any) => n.kind === 'rooms.assigned'),
    ).toBe(true);

    expect((await ana.post(`/rooms/${roomId}/remove`, { userId: caio.userId })).status).toBe(200);
    expect((await ana.get(`/events/${id}/rooms`)).body.rooms[0].occupants).toEqual([]);
  });

  it('com sinal exigido, só quem está com o sinal aprovado escolhe cama (RN-14)', async () => {
    const id = await confirmedEvent({
      requiresDeposit: true,
      depositCents: 5000,
      pixKey: 'ana@pix.com',
    });
    await ana.post(`/events/${id}/rooms`, { name: 'Suíte', beds: 2 });
    const roomId = (await ana.get(`/events/${id}/rooms`)).body.rooms[0].id;

    const blocked = await bia.post(`/rooms/${roomId}/join`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('DEPOSIT_REQUIRED');

    await bia.upload(`/events/${id}/deposit/proof`, PNG);
    await ana.post(`/events/${id}/deposits/${bia.userId}/review`, { decision: 'approve' });
    expect((await bia.post(`/rooms/${roomId}/join`)).status).toBe(200);
  });
});

describe('retenção de comprovantes e notas (LGPD)', () => {
  it('apaga as imagens 90 dias depois de fechar a conta e mantém os valores', async () => {
    const id = await confirmedEvent({
      requiresDeposit: true,
      depositCents: 5000,
      pixKey: 'ana@pix.com',
    });
    await bia.upload(`/events/${id}/deposit/proof`, PNG);
    await ana.post(`/events/${id}/deposits/${bia.userId}/review`, { decision: 'approve' });
    const expense = (
      await bia.post(`/events/${id}/expenses`, {
        description: 'Gelo',
        category: 'drinks',
        amountCents: 2000,
        quota: 'global',
      })
    ).body;
    await bia.upload(`/expenses/${expense.id}/receipt`, PNG);
    await caio.upload(`/events/${id}/deposit/proof`, PNG);
    await ana.post(`/events/${id}/deposits/${caio.userId}/review`, { decision: 'approve' });

    expect((await ana.post(`/events/${id}/settlement/close`)).status).toBe(200);
    expect(env.storage.files.size).toBe(3);

    // Antes do prazo nada some.
    env.clock.advanceHours(24 * 30);
    await runDueJobs(env.ctx);
    expect(env.storage.files.size).toBe(3);

    env.clock.advanceHours(24 * 61); // passa dos 90 dias
    await runDueJobs(env.ctx);
    expect(env.storage.files.size).toBe(0);

    const proofs = await env.ctx.db
      .selectFrom('deposit_proofs')
      .select('id')
      .where('event_id', '=', id)
      .execute();
    expect(proofs).toHaveLength(0);
    const kept = await env.ctx.db
      .selectFrom('expenses')
      .selectAll()
      .where('id', '=', expense.id)
      .executeTakeFirstOrThrow();
    expect(kept.receipt_key).toBeNull();
    expect(kept.amount_cents).toBe(2000); // o valor fica; só a imagem some
    expect((await bia.get(`/expenses/${expense.id}/receipt`)).status).toBe(404);
    expect((await ana.get(`/events/${id}/settlement`)).body.closed).toBe(true);
  });

  it('rolê cancelado também tem os comprovantes apagados no prazo', async () => {
    const id = await confirmedEvent({
      requiresDeposit: true,
      depositCents: 5000,
      pixKey: 'ana@pix.com',
    });
    await bia.upload(`/events/${id}/deposit/proof`, PNG);
    await ana.post(`/events/${id}/cancel`);
    expect(env.storage.files.size).toBe(1);
    env.clock.advanceHours(24 * 91);
    await runDueJobs(env.ctx);
    expect(env.storage.files.size).toBe(0);
  });
});
