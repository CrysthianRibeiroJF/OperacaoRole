// Sobe o app de verdade para os testes de ponta a ponta: banco temporário com dados de demonstração
// e a API compilada servindo o app compilado (rode `npm run build` antes).
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const apiDir = join(root, 'apps/api');
const tmp = mkdtempSync(join(tmpdir(), 'role-e2e-'));
const env = {
  ...process.env,
  NODE_ENV: 'development', // o seed recusa produção; o cookie Secure exigiria HTTPS
  HOST: '127.0.0.1',
  PORT: '4173',
  AUTH_RATE_LIMIT_PER_MIN: '1000', // os testes entram várias vezes do mesmo IP
  SESSION_SECRET: 'e2e-secret-with-more-than-32-characters!!',
  DATABASE_PATH: join(tmp, 'role.db'),
  UPLOAD_DIR: join(tmp, 'uploads'),
  PUBLIC_WEB_URL: 'http://127.0.0.1:4173',
  WEB_DIST_DIR: join(root, 'apps/web/dist'),
};

const seed = spawnSync(process.execPath, ['--import', 'tsx', 'src/db/seed.ts'], {
  cwd: apiDir,
  env,
  stdio: 'inherit',
});
if (seed.status !== 0) process.exit(seed.status ?? 1);

const server = spawn(process.execPath, ['dist/server.js'], { cwd: apiDir, env, stdio: 'inherit' });
const stop = () => server.kill();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('exit', (code) => process.exit(code ?? 0));
