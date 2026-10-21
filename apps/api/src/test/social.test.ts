import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client, eventInput, makeApp, PNG } from './helpers';

type Env = Awaited<ReturnType<typeof makeApp>>;
let env: Env;
let ana: Client; // Idealizadora e, com o cargo vago, Tesoureira
let bia: Client;
let caio: Client;
let davi: Client; // fora de tudo
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

/** Rolê confirmado: Ana (Idealizadora), Bia e Caio. */
async function confirmedEvent(overrides: Record<string, unknown> = {}) {
  const { id, code } = (
    await ana.post('/events', eventInput({ endDate: '2026-11-15', ...overrides }))
  ).body;
  await bia.post(`/events/${id}/respond`, { response: 'in' });
  await caio.post(`/events/${id}/respond`, { response: 'in' });
  return { id: id as string, code: code as string };
}

const notices = async (who: Client) => (await who.get('/notifications')).body.items as any[];
const expense = (over: Record<string, unknown> = {}) => ({
  description: 'Carvão e gelo',
  category: 'food',
  amountCents: 9000,
  quota: 'global',
  ...over,
});

describe('enquete de data e local', () => {
  const create = () =>
    ana.post('/polls', {
      title: 'Onde vai ser?',
      options: [
        { label: 'Maresias', destination: 'Maresias, São Paulo', startDate: '2026-11-14' },
        { label: 'Ubatuba', destination: 'Ubatuba, São Paulo', startDate: '2026-11-21' },
      ],
    });

  it('o link abre sem login, votar exige conta e quem vota pode aprovar várias opções', async () => {
    const poll = (await create()).body;
    expect(poll).toMatchObject({ status: 'open', isOrganizer: true, totalVoters: 0 });

    const open = await env.app.inject({ method: 'GET', url: `/api/polls/${poll.code}` });
    expect(open.statusCode).toBe(200);
    expect(open.json()).toMatchObject({ loggedIn: false, title: 'Onde vai ser?' });
    expect(open.json().options.every((o: any) => o.voters.length === 0)).toBe(true);

    const [m, u] = poll.options.map((o: any) => o.id);
    const voted = await bia.put(`/polls/${poll.id}/votes`, { optionIds: [m, u] });
    expect(voted.body.options.map((o: any) => o.votes)).toEqual([1, 1]);
    expect(voted.body.options[0].votedByMe).toBe(true);
    // Refazer o voto troca, não soma.
    const redo = await bia.put(`/polls/${poll.id}/votes`, { optionIds: [u] });
    expect(redo.body.options.map((o: any) => o.votes)).toEqual([0, 1]);
    expect((await bia.put(`/polls/${poll.id}/votes`, { optionIds: ['x'] })).status).toBe(422);
    expect(
      (await ana.post('/polls', { title: 'Sem opções', options: [{ label: 'Só uma' }] })).status,
    ).toBe(400);
  });

  it('empate exige escolha do Idealizador, só ele encerra e os votantes são avisados', async () => {
    const poll = (await create()).body;
    const [m, u] = poll.options.map((o: any) => o.id);
    await bia.put(`/polls/${poll.id}/votes`, { optionIds: [m] });
    await caio.put(`/polls/${poll.id}/votes`, { optionIds: [u] });

    expect((await bia.post(`/polls/${poll.id}/close`, { optionId: m })).status).toBe(403);
    const tie = await ana.post(`/polls/${poll.id}/close`, {});
    expect(tie.status).toBe(422);
    expect(tie.body.error.code).toBe('CHOICE_REQUIRED');

    const closed = await ana.post(`/polls/${poll.id}/close`, { optionId: m });
    expect(closed.body).toMatchObject({ status: 'closed', winnerOptionId: m });
    expect((await bia.put(`/polls/${poll.id}/votes`, { optionIds: [m] })).status).toBe(409);
    expect((await ana.post(`/polls/${poll.id}/close`, { optionId: m })).status).toBe(409);

    const biaNotice = (await notices(bia)).find((n) => n.kind === 'poll.closed');
    expect(biaNotice).toMatchObject({ link: `/enquete/${poll.code}`, eventId: null });
    expect((await notices(ana)).some((n) => n.kind === 'poll.closed')).toBe(false);
  });

  it('maioria clara vence sem escolha e não dá para contrariá-la', async () => {
    const poll = (await create()).body;
    const [m, u] = poll.options.map((o: any) => o.id);
    await bia.put(`/polls/${poll.id}/votes`, { optionIds: [m] });
    await caio.put(`/polls/${poll.id}/votes`, { optionIds: [m] });
    expect((await ana.post(`/polls/${poll.id}/close`, { optionId: u })).status).toBe(422);
    expect((await ana.post(`/polls/${poll.id}/close`, {})).body.winnerOptionId).toBe(m);
  });

  it('a proposta criada a partir da enquete liga as duas e avisa quem votou', async () => {
    const poll = (await create()).body;
    const [m] = poll.options.map((o: any) => o.id);
    await bia.put(`/polls/${poll.id}/votes`, { optionIds: [m] });

    // Enquete ainda aberta: o rolê nasce normalmente, mas sem ligação nem aviso.
    const early = await ana.post('/events', eventInput({ pollId: poll.id }));
    expect(early.status).toBe(201);
    expect((await ana.get(`/polls/${poll.code}`)).body.event).toBeNull();

    await ana.post(`/polls/${poll.id}/close`, {});
    // Quem não criou a enquete não consegue ligá-la a um rolê.
    await bia.post('/events', eventInput({ pollId: poll.id }));
    expect((await ana.get(`/polls/${poll.code}`)).body.event).toBeNull();

    const card = (await ana.post('/events', eventInput({ pollId: poll.id }))).body;
    expect((await ana.get(`/polls/${poll.code}`)).body.event).toEqual({
      id: card.id,
      code: card.code,
    });
    const notice = (await notices(bia)).find((n) => n.kind === 'poll.proposal');
    expect(notice).toMatchObject({ link: `/c/${card.code}` });

    // Fora da lista de pendências depois que virou proposta.
    expect((await ana.get('/polls')).body).toEqual([]);
  });
});

describe('tropa', () => {
  async function crewWithBiaAndCaio() {
    const crew = (await ana.post('/crews', { name: 'Os Fiéis' })).body;
    await bia.post(`/crews/code/${crew.code}/join`);
    await caio.post(`/crews/code/${crew.code}/join`);
    return crew;
  }

  it('entra quem abre o link; a prévia pública mostra só o essencial', async () => {
    const crew = await crewWithBiaAndCaio();
    const preview = await env.app.inject({ method: 'GET', url: `/api/crews/code/${crew.code}` });
    expect(preview.json()).toEqual({
      code: crew.code,
      name: 'Os Fiéis',
      owner: { id: ana.userId, name: 'Ana' },
      memberCount: 3,
      joined: null,
    });
    expect((await bia.get(`/crews/code/${crew.code}`)).body.joined).toBe(true);
    expect((await davi.get(`/crews/code/${crew.code}`)).body.joined).toBe(false);

    const mine = (await bia.get('/crews')).body;
    expect(mine).toHaveLength(1);
    // Com o relógio fixo os três entram no mesmo instante: compara sem depender da ordem.
    expect(mine[0].members.map((m: any) => m.name).sort()).toEqual(['Ana', 'Bia', 'Caio']);
    expect((await davi.get('/crews')).body).toEqual([]);
  });

  it('o dono não sai, só ele tira gente ou exclui', async () => {
    const crew = await crewWithBiaAndCaio();
    expect((await ana.post(`/crews/${crew.id}/leave`)).status).toBe(409);
    expect((await bia.post(`/crews/${crew.id}/remove`, { userId: caio.userId })).status).toBe(403);
    expect((await bia.call('DELETE', `/crews/${crew.id}`)).status).toBe(403);
    expect((await ana.post(`/crews/${crew.id}/remove`, { userId: caio.userId })).status).toBe(200);
    expect((await bia.post(`/crews/${crew.id}/leave`)).status).toBe(200);
    expect((await ana.call('DELETE', `/crews/${crew.id}`)).status).toBe(200);
    expect((await ana.get(`/crews/code/${crew.code}`)).status).toBe(404);
  });

  it('chamar a tropa avisa só quem ainda não respondeu, uma vez, com o link do convite', async () => {
    const crew = await crewWithBiaAndCaio();
    const { id, code } = (await ana.post('/events', eventInput())).body;
    await bia.post(`/events/${id}/respond`, { response: 'out' });

    expect((await bia.post(`/events/${id}/invite-crew`, { crewId: crew.id })).status).toBe(403);
    expect((await davi.post(`/events/${id}/invite-crew`, { crewId: crew.id })).status).toBe(403);
    expect((await ana.post(`/events/${id}/invite-crew`, { crewId: crew.id })).body).toEqual({
      invited: 1,
    });
    await ana.post(`/events/${id}/invite-crew`, { crewId: crew.id });

    const caioNotices = (await notices(caio)).filter((n) => n.kind === 'crew.invited');
    expect(caioNotices).toHaveLength(1);
    expect(caioNotices[0].link).toBe(`/c/${code}`);
    expect((await notices(bia)).some((n) => n.kind === 'crew.invited')).toBe(false);
  });
});

describe('repetir o rolê', () => {
  it('só o Idealizador repete; nasce aberto, com lista, quartos e Base, sem respostas nem cargos', async () => {
    const { id } = await confirmedEvent({ costCapCents: 15000 });
    await ana.post(`/events/${id}/supplies/suggest`);
    await ana.post(`/events/${id}/rooms`, { name: 'Suíte', beds: 2 });
    await ana.put(`/events/${id}/base`, {
      address: 'Rua das Flores, 10',
      wifiName: 'casa',
      wifiPassword: null,
      gateCode: null,
      checkoutTime: '11h',
      houseRules: null,
      schedule: null,
    });
    const source = (await ana.get(`/events/${id}/supplies`)).body;

    const body = { startDate: '2027-01-10', endDate: '2027-01-12' };
    expect((await bia.post(`/events/${id}/repeat`, body)).status).toBe(403);
    const again = await ana.post(`/events/${id}/repeat`, body);
    expect(again.status).toBe(201);
    expect(again.body).toMatchObject({
      status: 'open',
      title: 'Bate e volta Maresias',
      costCapCents: 15000,
      confirmedCount: 1,
      startDate: '2027-01-10',
    });
    expect(again.body.id).not.toBe(id);

    const copy = (await ana.get(`/events/${again.body.id}/supplies`)).body;
    expect(copy.items).toHaveLength(source.items.length);
    expect(copy.items.every((i: any) => !i.done && i.assignee === null)).toBe(true);
    expect((await ana.get(`/events/${again.body.id}`)).body.base).toMatchObject({
      address: 'Rua das Flores, 10',
      checkoutTime: '11h',
    });
    expect((await ana.get(`/events/${again.body.id}`)).body.roster).toHaveLength(1);
    expect(
      (await ana.get(`/events/${again.body.id}`)).body.roles.every((r: any) => r.user === null),
    ).toBe(true);
  });

  it('pode chamar a tropa na mesma hora', async () => {
    const { id } = await confirmedEvent();
    const crew = (await ana.post('/crews', { name: 'Fiéis' })).body;
    await caio.post(`/crews/code/${crew.code}/join`);
    const again = await ana.post(`/events/${id}/repeat`, {
      startDate: '2027-02-01',
      title: 'Edição 2',
      crewId: crew.id,
    });
    expect(again.body.title).toBe('Edição 2');
    const notice = (await notices(caio)).find((n) => n.kind === 'crew.invited');
    expect(notice.link).toBe(`/c/${again.body.code}`);
  });
});

describe('Pix pronto com o valor certo', () => {
  async function closedWithTransfers() {
    const { id } = await confirmedEvent();
    await bia.post(`/events/${id}/expenses`, expense());
    await ana.post(`/events/${id}/settlement/close`);
    return id;
  }

  it('só quem paga recebe o código, e ele só sai se o credor cadastrou a chave', async () => {
    const id = await closedWithTransfers();
    const transfer = (await caio.get(`/events/${id}/settlement`)).body.transfers[0];

    const missing = await caio.get(`/transfers/${transfer.id}/pix`);
    expect(missing.status).toBe(409);
    expect(missing.body.error.code).toBe('NO_PIX_KEY');

    await bia.call('PATCH', '/me', { pixKey: '(11) 92222-2222' });
    const pix = await caio.get(`/transfers/${transfer.id}/pix`);
    expect(pix.status).toBe(200);
    expect(pix.body).toMatchObject({ amountCents: 3000, payee: { name: 'Bia' } });
    expect(pix.body.payload).toContain('+5511922222222');
    expect(pix.body.payload).toContain('540530.00');
    expect(pix.body.payload).toContain('5903BIA');
    expect(pix.body.payload).toContain('6008MARESIAS');

    expect((await bia.get(`/transfers/${transfer.id}/pix`)).status).toBe(403);
    expect((await davi.get(`/transfers/${transfer.id}/pix`)).status).toBe(403);
    // Depois de pago não há mais o que pagar.
    await bia.post(`/transfers/${transfer.id}/confirm`);
    expect((await caio.get(`/transfers/${transfer.id}/pix`)).status).toBe(409);
  });

  it('o sinal também sai com o valor combinado e a chave do Tesoureiro', async () => {
    const { id } = await confirmedEvent({
      requiresDeposit: true,
      depositCents: 5000,
      pixKey: 'ana@exemplo.com',
    });
    const pix = await bia.get(`/events/${id}/deposit/pix`);
    expect(pix.status).toBe(200);
    expect(pix.body).toMatchObject({ amountCents: 5000, key: 'ana@exemplo.com' });
    expect(pix.body.payload).toContain('540550.00');
    expect(pix.body.payload).toContain('ana@exemplo.com');
    expect((await davi.get(`/events/${id}/deposit/pix`)).status).toBe(403);

    const free = await confirmedEvent();
    expect((await bia.get(`/events/${free.id}/deposit/pix`)).status).toBe(409);
  });
});

describe('Relatório de Missão e agenda', () => {
  it('agrega a conta sem expor saldo e vira definitivo quando a conta fecha', async () => {
    const { id } = await confirmedEvent();
    await bia.post(`/events/${id}/expenses`, expense());
    await caio.post(
      `/events/${id}/expenses`,
      expense({ description: 'Gasolina', category: 'fuel', amountCents: 3000 }),
    );

    const r = (await bia.get(`/events/${id}/report`)).body;
    expect(r).toMatchObject({
      final: false,
      days: 2,
      headcount: 3,
      totalCents: 12000,
      perHeadCents: 4000,
      expenseCount: 2,
      topPayer: { user: { name: 'Bia' }, amountCents: 9000 },
      biggestExpense: { description: 'Carvão e gelo', amountCents: 9000 },
      topCategory: { category: 'food', cents: 9000 },
    });
    expect(JSON.stringify(r)).not.toContain('netCents');
    expect((await davi.get(`/events/${id}/report`)).status).toBe(403);

    await ana.post(`/events/${id}/settlement/close`);
    expect((await bia.get(`/events/${id}/report`)).body.final).toBe(true);
  });

  it('não existe relatório para proposta ainda aberta', async () => {
    const { id } = (await ana.post('/events', eventInput())).body;
    expect((await ana.get(`/events/${id}/report`)).status).toBe(409);
  });

  it('entrega o .ics só para quem está no rolê', async () => {
    const { id, code } = await confirmedEvent();
    const res = await env.app.inject({
      method: 'GET',
      url: `/api/events/${id}/calendar.ics`,
      headers: { cookie: bia.sessionCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/calendar');
    expect(res.headers['content-disposition']).toContain(`role-${code}.ics`);
    expect(res.body).toContain('DTSTART;VALUE=DATE:20261114');
    expect(res.body).toContain('DTEND;VALUE=DATE:20261116');
    expect(res.body).toContain('SUMMARY:Bate e volta Maresias');
    expect((await davi.get(`/events/${id}/calendar.ics`)).status).toBe(403);
  });
});

describe('selo "Andorinha confiável"', () => {
  it('só o Idealizador recebe o selo; quem está começando aparece como primeira vez', async () => {
    const { id } = await confirmedEvent();
    const organizerView = (await ana.get(`/events/${id}`)).body.roster;
    const badge = (name: string) =>
      organizerView.find((r: any) => r.user.name === name).reliability;
    expect(badge('Bia')).toBe('newcomer');
    expect(badge('Caio')).toBe('newcomer');
    expect(badge('Ana')).toBeNull();

    const biaView = (await bia.get(`/events/${id}`)).body.roster;
    expect(biaView.every((r: any) => r.reliability === null)).toBe(true);
  });

  it('com rolês encerrados sem pendência, vira confiável; com sinal perdido, volta a neutro', async () => {
    // Dois rolês encerrados em que Bia estava confirmada e pagou o acerto no prazo.
    for (let i = 0; i < 2; i++) {
      const { id } = await confirmedEvent();
      await bia.post(`/events/${id}/expenses`, expense());
      await ana.post(`/events/${id}/settlement/close`);
    }
    const { id } = await confirmedEvent();
    const badge = async () =>
      (await ana.get(`/events/${id}`)).body.roster.find((r: any) => r.user.name === 'Bia')
        .reliability;
    expect(await badge()).toBe('trusted');

    await env.ctx.db
      .updateTable('participations')
      .set({ deposit_status: 'waitlisted' })
      .where('user_id', '=', bia.userId)
      .execute();
    expect(await badge()).toBeNull();
  });
});

describe('mural de fotos', () => {
  it('só confirmados postam, só imagem entra e só o autor (ou o Idealizador) apaga', async () => {
    const { id } = await confirmedEvent();
    expect((await bia.upload(`/events/${id}/photos`, PNG)).status).toBe(201);
    expect((await davi.upload(`/events/${id}/photos`, PNG)).status).toBe(403);
    expect((await bia.upload(`/events/${id}/photos`, Buffer.from('%PDF-1.4 teste'))).status).toBe(
      422,
    );
    expect((await bia.upload(`/events/${id}/photos`, Buffer.from('texto qualquer'))).status).toBe(
      422,
    );

    const list = (await caio.get(`/events/${id}/photos`)).body;
    expect(list.photos).toHaveLength(1);
    expect(list).toMatchObject({ canAdd: true });
    expect(list.photos[0]).toMatchObject({ by: { name: 'Bia' }, mine: false, canDelete: false });
    expect((await bia.get(`/events/${id}/photos`)).body.photos[0].canDelete).toBe(true);
    expect((await ana.get(`/events/${id}/photos`)).body.photos[0].canDelete).toBe(true);

    const photoId = list.photos[0].id;
    expect((await caio.get(`/photos/${photoId}`)).status).toBe(200);
    expect((await davi.get(`/photos/${photoId}`)).status).toBe(403);
    expect((await caio.call('DELETE', `/photos/${photoId}`)).status).toBe(403);
    expect(env.storage.files.size).toBe(1);
    expect((await ana.call('DELETE', `/photos/${photoId}`)).status).toBe(200);
    expect(env.storage.files.size).toBe(0);
  });

  it('o mural só abre depois que o rolê é confirmado e respeita o limite', async () => {
    const open = (await ana.post('/events', eventInput())).body;
    expect((await ana.upload(`/events/${open.id}/photos`, PNG)).status).toBe(409);

    const { id } = await confirmedEvent();
    await env.ctx.db
      .insertInto('event_photos')
      .values(
        Array.from({ length: 40 }, (_, i) => ({
          id: `p${i}`,
          event_id: id,
          user_id: bia.userId,
          file_key: `photos/${id}/p${i}.png`,
          mime: 'image/png',
          created_at: new Date().toISOString(),
        })),
      )
      .execute();
    const full = await bia.upload(`/events/${id}/photos`, PNG);
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe('PHOTO_LIMIT');
  });
});

describe('bagagem', () => {
  it('itens do grupo vêm do General da Base; os pessoais só o dono vê; cada um marca o seu', async () => {
    const { id } = await confirmedEvent();
    expect(
      (await bia.post(`/events/${id}/packing`, { label: 'Protetor solar', scope: 'group' })).status,
    ).toBe(403);
    expect(
      (await ana.post(`/events/${id}/packing`, { label: 'Protetor solar', scope: 'group' })).status,
    ).toBe(201);
    expect(
      (await bia.post(`/events/${id}/packing`, { label: 'Meu travesseiro', scope: 'mine' })).status,
    ).toBe(201);
    expect((await davi.get(`/events/${id}/packing`)).status).toBe(403);

    const biaList = (await bia.get(`/events/${id}/packing`)).body;
    expect(biaList.items.map((i: any) => i.label)).toEqual(['Protetor solar', 'Meu travesseiro']);
    const caioList = (await caio.get(`/events/${id}/packing`)).body;
    expect(caioList.items.map((i: any) => i.label)).toEqual(['Protetor solar']);
    expect((await caio.get(`/events/${id}/packing`)).body.canSuggest).toBe(false);

    const [group, mine] = biaList.items;
    await bia.post(`/packing/${group.id}/check`, { checked: true });
    expect((await bia.get(`/events/${id}/packing`)).body).toMatchObject({ doneCount: 1 });
    expect((await caio.get(`/events/${id}/packing`)).body).toMatchObject({ doneCount: 0 });
    await bia.post(`/packing/${group.id}/check`, { checked: false });
    expect((await bia.get(`/events/${id}/packing`)).body.doneCount).toBe(0);

    // Item pessoal alheio simplesmente não existe para os outros.
    expect((await caio.post(`/packing/${mine.id}/check`, { checked: true })).status).toBe(404);
    expect((await ana.call('DELETE', `/packing/${mine.id}`)).status).toBe(404);
    expect((await caio.call('DELETE', `/packing/${group.id}`)).status).toBe(403);
    expect((await bia.call('DELETE', `/packing/${mine.id}`)).status).toBe(200);
    expect((await ana.call('DELETE', `/packing/${group.id}`)).status).toBe(200);
  });
});

describe('trilha do rolê', () => {
  it('sugestão com voto, ordem por votos, link só http(s) e playlist definida pela Base', async () => {
    const { id } = await confirmedEvent();
    expect((await davi.post(`/events/${id}/tracks`, { title: 'Penetra' })).status).toBe(403);
    expect(
      (await bia.post(`/events/${id}/tracks`, { title: 'Evidências', url: 'javascript:alert(1)' }))
        .status,
    ).toBe(400);
    await bia.post(`/events/${id}/tracks`, { title: 'Evidências', url: 'https://youtu.be/abc' });
    await caio.post(`/events/${id}/tracks`, { title: 'Faroeste Caboclo' });

    let tracks = (await ana.get(`/events/${id}/tracks`)).body.tracks;
    expect(tracks.map((t: any) => [t.title, t.votes])).toEqual([
      ['Evidências', 1],
      ['Faroeste Caboclo', 1],
    ]);
    const second = tracks[1];
    await ana.post(`/tracks/${second.id}/vote`);
    tracks = (await ana.get(`/events/${id}/tracks`)).body.tracks;
    expect(tracks[0]).toMatchObject({ title: 'Faroeste Caboclo', votes: 2, votedByMe: true });
    await ana.post(`/tracks/${second.id}/vote`); // tira o voto
    expect((await ana.get(`/events/${id}/tracks`)).body.tracks[0].title).toBe('Evidências');

    expect((await caio.call('DELETE', `/tracks/${tracks[1].id}`)).status).toBe(403);
    expect((await ana.call('DELETE', `/tracks/${tracks[1].id}`)).status).toBe(200);

    expect((await bia.put(`/events/${id}/playlist`, { url: 'https://spotify.com/x' })).status).toBe(
      403,
    );
    expect((await ana.put(`/events/${id}/playlist`, { url: 'ftp://x' })).status).toBe(400);
    expect((await ana.put(`/events/${id}/playlist`, { url: 'https://spotify.com/x' })).status).toBe(
      200,
    );
    expect((await bia.get(`/events/${id}/tracks`)).body.playlistUrl).toBe('https://spotify.com/x');
    expect((await ana.put(`/events/${id}/playlist`, { url: null })).status).toBe(200);
  });
});

describe('conta por item', () => {
  async function byItem() {
    const { id } = await confirmedEvent();
    const created = await bia.post(`/events/${id}/expenses`, {
      description: 'Conta do bar',
      category: 'drinks',
      amountCents: 9000,
      quota: 'global',
      items: [
        { label: 'Picanha', amountCents: 6000, consumerIds: [bia.userId, caio.userId] },
        { label: 'Suco', amountCents: 2000, consumerIds: [ana.userId] },
      ],
    });
    return { id, expenseId: created.body.id as string, created };
  }
  const net = async (id: string) => {
    const s = (await ana.get(`/events/${id}/settlement`)).body;
    const by = (name: string) => s.balances.find((b: any) => b.user.name === name).netCents;
    expect(s.balances.reduce((sum: number, b: any) => sum + b.netCents, 0)).toBe(0);
    return { ana: by('Ana'), bia: by('Bia'), caio: by('Caio') };
  };

  it('divide cada item entre quem consumiu e rateia a sobra pelo consumo, sem perder centavo', async () => {
    const { id, created } = await byItem();
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ quota: 'custom', amountCents: 9000 });
    expect(
      created.body.items.map((i: any) => [i.label, i.amountCents, i.consumers.length]),
    ).toEqual([
      ['Picanha', 6000, 2],
      ['Suco', 2000, 1],
    ]);
    // Picanha: Bia e Caio 3000 cada; Suco: Ana 2000; sobra de 1000 proporcional: 375, 375 e 250.
    expect(await net(id)).toEqual({ ana: -2250, bia: 5625, caio: -3375 });
  });

  it('cada um marca o que consumiu; só o autor (ou o Tesoureiro) marca por outro', async () => {
    const { id, created } = await byItem();
    const picanha = created.body.items[0].id;

    // Caio desmarca a si mesmo: a picanha fica só com Bia (6000 + 750 de sobra), que pagou 9000.
    await caio.post(`/expense-items/${picanha}/consume`);
    expect(await net(id)).toEqual({ ana: -2250, bia: 2250, caio: 0 });

    expect(
      (await caio.post(`/expense-items/${picanha}/consume`, { userId: ana.userId })).status,
    ).toBe(403);
    expect((await davi.post(`/expense-items/${picanha}/consume`)).status).toBe(403);
    expect(
      (await bia.post(`/expense-items/${picanha}/consume`, { userId: davi.userId })).status,
    ).toBe(422);
    expect(
      (await bia.post(`/expense-items/${picanha}/consume`, { userId: caio.userId })).status,
    ).toBe(200);
    expect(await net(id)).toEqual({ ana: -2250, bia: 5625, caio: -3375 });
  });

  it('item sem consumidor vira pendência que bloqueia o fechamento', async () => {
    const { id, created } = await byItem();
    const [picanha, suco] = created.body.items.map((i: any) => i.id);
    await bia.post(`/expense-items/${picanha}/consume`);
    await caio.post(`/expense-items/${picanha}/consume`);
    await ana.post(`/expense-items/${suco}/consume`);
    const preview = (await ana.get(`/events/${id}/settlement`)).body;
    expect(preview.issues).toEqual([
      expect.objectContaining({ code: 'NO_BENEFICIARIES', description: 'Conta do bar' }),
    ]);
    expect((await ana.post(`/events/${id}/settlement/close`)).status).toBe(409);
  });

  it('recusa itens que passam do valor da despesa', async () => {
    const { id } = await confirmedEvent();
    const res = await bia.post(`/events/${id}/expenses`, {
      description: 'Conta',
      category: 'food',
      amountCents: 1000,
      quota: 'custom',
      items: [{ label: 'Prato', amountCents: 2000, consumerIds: [bia.userId] }],
    });
    expect(res.status).toBe(400);
  });
});

describe('exclusão de conta e vida social', () => {
  it('somem as enquetes, tropas, votos e fotos da pessoa; os valores dos grupos ficam', async () => {
    const { id } = await confirmedEvent();
    await caio.upload(`/events/${id}/photos`, PNG);
    const poll = (
      await eva.post('/polls', {
        title: 'Enquete da Eva',
        options: [{ label: 'Opção A' }, { label: 'Opção B' }],
      })
    ).body;
    const crew = (await eva.post('/crews', { name: 'Tropa da Eva' })).body;
    await caio.post(`/crews/code/${crew.code}/join`);
    await caio.put(`/polls/${poll.id}/votes`, { optionIds: [poll.options[0].id] });
    await caio.post(`/events/${id}/tracks`, { title: 'Música do Caio' });
    await bia.post(`/events/${id}/expenses`, expense());

    // Caio sai do rolê confirmado antes de excluir (regra existente de exclusão).
    await caio.post(`/events/${id}/respond`, { response: 'out' });
    expect((await eva.post('/me/delete', { confirm: 'EXCLUIR' })).status).toBe(200);
    expect((await ana.get(`/polls/${poll.code}`)).status).toBe(404);
    expect((await ana.get(`/crews/code/${crew.code}`)).status).toBe(404);

    expect((await caio.post('/me/delete', { confirm: 'EXCLUIR' })).status).toBe(200);
    expect(env.storage.files.size).toBe(0);
    expect((await ana.get(`/events/${id}/tracks`)).body.tracks).toEqual([]);
    expect((await ana.get(`/events/${id}/expenses`)).body).toHaveLength(1);
  });
});
