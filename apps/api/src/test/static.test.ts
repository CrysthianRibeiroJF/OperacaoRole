import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeApp } from './helpers';

type Env = Awaited<ReturnType<typeof makeApp>>;
let env: Env;
let dist: string;

beforeEach(async () => {
  dist = mkdtempSync(join(tmpdir(), 'role-web-'));
  mkdirSync(join(dist, 'assets'));
  writeFileSync(
    join(dist, 'index.html'),
    '<!doctype html><title>Operação Rolê</title><div id="root"></div>',
  );
  writeFileSync(join(dist, 'assets', 'app-abc123.js'), 'console.log("ok")');
  writeFileSync(join(dist, 'sw.js'), '// service worker');
  env = await makeApp({ WEB_DIST_DIR: dist });
});

afterEach(async () => {
  await env.app.close();
  await env.ctx.db.destroy();
  rmSync(dist, { recursive: true, force: true });
});

const get = (url: string, accept = 'text/html') =>
  env.app.inject({ method: 'GET', url, headers: { accept } });

describe('app servido pela API (um processo, uma origem)', () => {
  it('entrega o index na raiz e nas rotas do React Router (fallback de SPA)', async () => {
    for (const url of ['/', '/entrar', '/c/ABC12345', '/role/algum-id?aba=cofre']) {
      const res = await get(url);
      expect(res.statusCode, url).toBe(200);
      expect(res.body).toContain('<div id="root">');
      expect(res.headers['cache-control']).toBe('no-cache');
    }
  });

  it('arquivos com hash são imutáveis; service worker sempre revalida', async () => {
    const asset = await get('/assets/app-abc123.js', '*/*');
    expect(asset.statusCode).toBe(200);
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    const sw = await get('/sw.js', '*/*');
    expect(sw.headers['cache-control']).toBe('no-cache');
  });

  it('não engole a API: rota de API inexistente continua sendo 404 em JSON', async () => {
    const res = await get('/api/nao-existe');
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
    expect((await get('/api/health', 'application/json')).json()).toEqual({ ok: true });
  });

  it('não devolve o index para quem não pediu uma página (arquivo ausente vira 404)', async () => {
    const res = await get('/assets/sumiu.js', '*/*');
    expect(res.statusCode).toBe(404);
  });

  it('a política de segurança libera só a previsão do tempo além da própria origem', async () => {
    const csp = String((await get('/')).headers['content-security-policy']);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('https://api.open-meteo.com');
    expect(csp).toContain('https://geocoding-api.open-meteo.com');
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });
});
