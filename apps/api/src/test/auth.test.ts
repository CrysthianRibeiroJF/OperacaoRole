import { TERMS_VERSION } from '@role/domain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { describeDevice } from '../lib/device';
import { Client, eventInput, makeApp, PASSWORD } from './helpers';

type Env = Awaited<ReturnType<typeof makeApp>>;
let env: Env;

const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

beforeEach(async () => {
  env = await makeApp();
});

afterEach(async () => {
  await env.app.close();
  await env.ctx.db.destroy();
});

const post = (url: string, payload: unknown, headers: Record<string, string> = {}) =>
  env.app.inject({ method: 'POST', url: `/api${url}`, payload: payload as object, headers });

describe('cadastro', () => {
  it('cria a conta, guarda a senha só como hash e entrega o código de recuperação uma vez', async () => {
    const res = await post('/auth/register', {
      phone: '(11) 98888-7777',
      name: 'Lia',
      password: PASSWORD,
      acceptTerms: true,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.profile).toMatchObject({ name: 'Lia', phone: '5511988887777' });
    expect(body.recoveryCode).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    expect(res.cookies.some((c) => c.name === 'role_session')).toBe(true);

    const row = await env.ctx.db
      .selectFrom('users')
      .selectAll()
      .where('phone', '=', '5511988887777')
      .executeTakeFirstOrThrow();
    expect(row.password_hash).toMatch(/^scrypt\$/);
    expect(row.password_hash).not.toContain(PASSWORD);
    expect(row.recovery_hash).not.toContain(body.recoveryCode.replace(/-/g, ''));
  });

  it('exige o aceite dos termos e grava a versão aceita', async () => {
    const without = await post('/auth/register', {
      phone: '11988887777',
      name: 'Lia',
      password: PASSWORD,
    });
    expect(without.statusCode).toBe(400);
    expect(without.json().error.message).toMatch(/Aceite os termos/);

    await post('/auth/register', {
      phone: '11988887777',
      name: 'Lia',
      password: PASSWORD,
      acceptTerms: true,
    });
    const row = await env.ctx.db
      .selectFrom('users')
      .selectAll()
      .where('phone', '=', '5511988887777')
      .executeTakeFirstOrThrow();
    expect(row.terms_version).toBe(TERMS_VERSION);
    expect(row.terms_accepted_at).not.toBeNull();
  });

  it('recusa senha fraca com o motivo e celular repetido', async () => {
    const weak = await post('/auth/register', {
      phone: '11988887777',
      name: 'Lia',
      password: '12345678',
      acceptTerms: true,
    });
    expect(weak.statusCode).toBe(400);
    expect(weak.json().error.message).toMatch(/muito comum/);

    const short = await post('/auth/register', {
      phone: '11988887777',
      name: 'Lia',
      password: 'abc',
      acceptTerms: true,
    });
    expect(short.json().error.message).toMatch(/pelo menos 8/);

    const phoneAsPassword = await post('/auth/register', {
      phone: '11988887777',
      name: 'Lia',
      password: '11988887777',
      acceptTerms: true,
    });
    expect(phoneAsPassword.json().error.message).toMatch(/celular/);

    expect(
      (
        await post('/auth/register', {
          phone: '11988887777',
          name: 'Lia',
          password: PASSWORD,
          acceptTerms: true,
        })
      ).statusCode,
    ).toBe(201);
    const dup = await post('/auth/register', {
      phone: '11988887777',
      name: 'Outra',
      password: PASSWORD,
      acceptTerms: true,
    });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe('PHONE_TAKEN');
  });
});

describe('entrada e bloqueio', () => {
  it('não revela se o celular existe e entra com a senha certa', async () => {
    await new Client(env.app, '11977776666', 'Teo').login();
    const wrong = await post('/auth/login', { phone: '11977776666', password: 'senha-errada-1' });
    const unknown = await post('/auth/login', { phone: '11900000000', password: 'senha-errada-1' });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json().error.message).toBe(unknown.json().error.message);

    const ok = await post('/auth/login', { phone: '11977776666', password: PASSWORD });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().profile.name).toBe('Teo');
    expect(ok.json().recoveryCode).toBeUndefined();
  });

  it('bloqueia por 15 minutos depois de 5 erros, mesmo com a senha certa, e libera depois', async () => {
    await new Client(env.app, '11977776666', 'Teo').login();
    for (let i = 0; i < 5; i++) {
      expect(
        (await post('/auth/login', { phone: '11977776666', password: 'errada-123456' })).statusCode,
      ).toBe(401);
    }
    const locked = await post('/auth/login', { phone: '11977776666', password: PASSWORD });
    expect(locked.statusCode).toBe(429);
    expect(locked.json().error.code).toBe('LOGIN_LOCKED');

    env.clock.advanceHours(0.3); // 18 minutos
    expect(
      (await post('/auth/login', { phone: '11977776666', password: PASSWORD })).statusCode,
    ).toBe(200);
  });

  it('exige sessão válida: cookie adulterado não entra', async () => {
    const res = await env.app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { cookie: 'role_session=falso' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('dispositivos', () => {
  it('lista os acessos com o rótulo do aparelho e encerra um por um', async () => {
    const phone = new Client(env.app, '11977776666', 'Teo');
    await phone.login();
    const second = new Client(env.app, '11977776666', 'Teo');
    await second.signIn(PASSWORD, CHROME_ANDROID);
    const third = new Client(env.app, '11977776666', 'Teo');
    await third.signIn(PASSWORD, SAFARI_IPHONE);

    const overview = (await second.get('/me/security')).body;
    expect(overview.sessions).toHaveLength(3);
    expect(overview.sessions.filter((s: any) => s.current)).toHaveLength(1);
    const devices = overview.sessions.map((s: any) => s.device);
    expect(devices).toContain('Chrome no Android');
    expect(devices).toContain('Safari no iPhone');

    const iphone = overview.sessions.find((s: any) => s.device === 'Safari no iPhone');
    expect((await second.post(`/me/sessions/${iphone.id}/revoke`)).status).toBe(200);
    expect((await third.get('/me')).status).toBe(401); // o iPhone caiu
    expect((await second.get('/me')).status).toBe(200);

    expect((await second.post('/me/sessions/revoke-others')).status).toBe(200);
    expect((await phone.get('/me')).status).toBe(401);
    expect((await second.get('/me')).status).toBe(200);
  });

  it('sair da conta encerra a sessão no servidor (repetir o cookie não vale)', async () => {
    const teo = await new Client(env.app, '11977776666', 'Teo').login();
    const stolen = teo.sessionCookie;
    expect((await teo.post('/auth/logout')).status).toBe(200);
    const replay = await env.app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { cookie: stolen },
    });
    expect(replay.statusCode).toBe(401);
  });

  it('não encerra sessão de outra pessoa', async () => {
    const teo = await new Client(env.app, '11977776666', 'Teo').login();
    const lia = await new Client(env.app, '11988887777', 'Lia').login();
    const liaSession = (await lia.get('/me/security')).body.sessions[0];
    expect((await teo.post(`/me/sessions/${liaSession.id}/revoke`)).status).toBe(404);
    expect((await lia.get('/me')).status).toBe(200);
  });

  it('rotula navegadores conhecidos', () => {
    expect(describeDevice(CHROME_ANDROID)).toBe('Chrome no Android');
    expect(describeDevice(SAFARI_IPHONE)).toBe('Safari no iPhone');
    expect(
      describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Gecko/20100101 Firefox/127.0'),
    ).toBe('Firefox no Windows');
    expect(describeDevice(undefined)).toBe('Dispositivo desconhecido');
  });
});

describe('trocar a senha', () => {
  it('exige a senha atual, derruba os outros aparelhos e vale para o próximo login', async () => {
    const teo = await new Client(env.app, '11977776666', 'Teo').login();
    const other = new Client(env.app, '11977776666', 'Teo');
    await other.signIn();

    expect(
      (
        await teo.post('/me/password', {
          currentPassword: 'errada-123456',
          newPassword: 'cachorro-azul-88',
        })
      ).status,
    ).toBe(403);
    const weak = await teo.post('/me/password', { currentPassword: PASSWORD, newPassword: 'abc' });
    expect(weak.status).toBe(400);

    expect(
      (
        await teo.post('/me/password', {
          currentPassword: PASSWORD,
          newPassword: 'cachorro-azul-88',
        })
      ).status,
    ).toBe(200);
    expect((await teo.get('/me')).status).toBe(200); // este aparelho continua
    expect((await other.get('/me')).status).toBe(401); // o outro precisa entrar de novo

    expect(
      (await post('/auth/login', { phone: '11977776666', password: PASSWORD })).statusCode,
    ).toBe(401);
    expect(
      (await post('/auth/login', { phone: '11977776666', password: 'cachorro-azul-88' }))
        .statusCode,
    ).toBe(200);
  });
});

describe('recuperar o acesso sem canal externo', () => {
  it('o código de recuperação redefine a senha, derruba todos os acessos e é trocado por um novo', async () => {
    const teo = await new Client(env.app, '11977776666', 'Teo').login();
    const oldCode = teo.recoveryCode;

    const wrong = await post('/auth/recover', {
      phone: '11977776666',
      recoveryCode: 'AAAA-BBBB-CCCC-DDDD',
      newPassword: 'cachorro-azul-88',
    });
    expect(wrong.statusCode).toBe(401);

    const ok = await post('/auth/recover', {
      phone: '11977776666',
      recoveryCode: oldCode.toLowerCase(),
      newPassword: 'cachorro-azul-88',
    });
    expect(ok.statusCode).toBe(200);
    const body = ok.json();
    expect(body.recoveryCode).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    expect(body.recoveryCode).not.toBe(oldCode);

    expect((await teo.get('/me')).status).toBe(401); // o acesso antigo caiu
    expect(
      (await post('/auth/login', { phone: '11977776666', password: PASSWORD })).statusCode,
    ).toBe(401);
    expect(
      (await post('/auth/login', { phone: '11977776666', password: 'cachorro-azul-88' }))
        .statusCode,
    ).toBe(200);

    // O código usado queimou.
    const reuse = await post('/auth/recover', {
      phone: '11977776666',
      recoveryCode: oldCode,
      newPassword: 'outra-senha-forte-1',
    });
    expect(reuse.statusCode).toBe(401);
  });

  it('erros no código também contam para o bloqueio', async () => {
    await new Client(env.app, '11977776666', 'Teo').login();
    for (let i = 0; i < 5; i++) {
      await post('/auth/recover', {
        phone: '11977776666',
        recoveryCode: 'AAAA-BBBB-CCCC-DDDD',
        newPassword: 'cachorro-azul-88',
      });
    }
    const locked = await post('/auth/recover', {
      phone: '11977776666',
      recoveryCode: 'AAAA-BBBB-CCCC-DDDD',
      newPassword: 'cachorro-azul-88',
    });
    expect(locked.statusCode).toBe(429);
  });

  it('gerar um novo código exige a senha e invalida o anterior', async () => {
    const teo = await new Client(env.app, '11977776666', 'Teo').login();
    const oldCode = teo.recoveryCode;

    expect((await teo.post('/me/recovery-code', { password: 'errada-123456' })).status).toBe(403);
    const fresh = (await teo.post('/me/recovery-code', { password: PASSWORD })).body
      .recoveryCode as string;
    expect(fresh).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);

    const withOld = await post('/auth/recover', {
      phone: '11977776666',
      recoveryCode: oldCode,
      newPassword: 'cachorro-azul-88',
    });
    expect(withOld.statusCode).toBe(401);
    const withNew = await post('/auth/recover', {
      phone: '11977776666',
      recoveryCode: fresh,
      newPassword: 'cachorro-azul-88',
    });
    expect(withNew.statusCode).toBe(200);
  });
});

describe('preferências de aviso', () => {
  it('liga tudo por padrão e respeita a categoria desligada, sem afetar os outros', async () => {
    const ana = await new Client(env.app, '11911111111', 'Ana').login();
    const bia = await new Client(env.app, '11922222222', 'Bia').login();
    const caio = await new Client(env.app, '11933333333', 'Caio').login();

    const defaults = (await bia.get('/me/notification-prefs')).body.categories;
    expect(Object.values(defaults).every((v) => v === true)).toBe(true);

    const updated = await bia.put('/me/notification-prefs', { categories: { quorum: false } });
    expect(updated.body.categories.quorum).toBe(false);
    expect(updated.body.categories.deposit).toBe(true);

    const { id } = (await ana.post('/events', eventInput())).body;
    await bia.post(`/events/${id}/respond`, { response: 'in' });
    await caio.post(`/events/${id}/respond`, { response: 'in' }); // confirma o rolê

    const kinds = async (c: Client) =>
      ((await c.get('/notifications')).body.items as { kind: string }[]).map((n) => n.kind);
    expect(await kinds(bia)).not.toContain('event.confirmed');
    expect(await kinds(ana)).toContain('event.confirmed');
    expect(await kinds(caio)).toContain('event.confirmed');
  });

  it('lista os rolês silenciados para reativar', async () => {
    const ana = await new Client(env.app, '11911111111', 'Ana').login();
    const { id } = (await ana.post('/events', eventInput({ title: 'Rolê silenciado' }))).body;
    await ana.put(`/events/${id}/mute`, { muted: true });
    expect((await ana.get('/me/muted-events')).body).toEqual([
      expect.objectContaining({ id, title: 'Rolê silenciado' }),
    ]);
    await ana.put(`/events/${id}/mute`, { muted: false });
    expect((await ana.get('/me/muted-events')).body).toEqual([]);
  });
});
