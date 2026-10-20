// Teste de carga básico, sem dependências: npm run loadtest -- --url http://127.0.0.1:3333 --seconds 10 --concurrency 20
// Entra com um usuário do seed, descobre um rolê e um convite e martela as rotas mais usadas.
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (acc, cur, i, all) => (cur.startsWith('--') ? [...acc, [cur.slice(2), all[i + 1]]] : acc),
      [],
    ),
);
const base = (args.url ?? 'http://127.0.0.1:3333').replace(/\/$/, '');
const seconds = Number(args.seconds ?? 10);
const concurrency = Number(args.concurrency ?? 20);
const phone = args.phone ?? '11999990001';
const password = args.password ?? 'role-demo-2026';

async function login() {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  if (!res.ok)
    throw new Error(
      `login falhou (${res.status}). Rode "npm run db:seed" ou informe --phone e --password.`,
    );
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}

const cookie = await login();
const authed = { headers: { cookie } };
const events = await (await fetch(`${base}/api/events`, authed)).json();
const confirmed = events.find((e) => e.status === 'confirmed') ?? events[0];
if (!confirmed) throw new Error('Nenhum rolê encontrado para testar.');

const scenarios = [
  { name: 'GET /api/health', weight: 2, run: () => fetch(`${base}/api/health`) },
  { name: 'GET /api/events (feed)', weight: 3, run: () => fetch(`${base}/api/events`, authed) },
  {
    name: 'GET /api/events/:id (QG)',
    weight: 3,
    run: () => fetch(`${base}/api/events/${confirmed.id}`, authed),
  },
  {
    name: 'GET /api/invites/:code',
    weight: 2,
    run: () => fetch(`${base}/api/invites/${confirmed.code}`),
  },
  {
    name: 'GET /api/events/:id/supplies',
    weight: 1,
    run: () => fetch(`${base}/api/events/${confirmed.id}/supplies`, authed),
  },
  {
    name: 'GET /api/notifications',
    weight: 1,
    run: () => fetch(`${base}/api/notifications`, authed),
  },
];
const bag = scenarios.flatMap((s) => Array(s.weight).fill(s));
const stats = new Map(scenarios.map((s) => [s.name, { times: [], errors: 0 }]));

const stopAt = Date.now() + seconds * 1000;
async function worker() {
  while (Date.now() < stopAt) {
    const s = bag[Math.floor(Math.random() * bag.length)];
    const t0 = performance.now();
    try {
      const res = await s.run();
      await res.arrayBuffer();
      const entry = stats.get(s.name);
      entry.times.push(performance.now() - t0);
      if (res.status >= 400 && res.status !== 429) entry.errors++;
      if (res.status === 429) entry.errors++;
    } catch {
      stats.get(s.name).errors++;
    }
  }
}

console.log(`Carga: ${concurrency} conexões por ${seconds}s em ${base}`);
await Promise.all(Array.from({ length: concurrency }, worker));

const pct = (arr, p) =>
  arr.length ? arr[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))] : 0;
let total = 0;
let errors = 0;
console.log(
  '\nrota'.padEnd(34) +
    'req/s'.padStart(8) +
    'p50 ms'.padStart(9) +
    'p95 ms'.padStart(9) +
    'p99 ms'.padStart(9) +
    'erros'.padStart(8),
);
for (const [name, { times, errors: e }] of stats) {
  const sorted = [...times].sort((a, b) => a - b);
  total += times.length;
  errors += e;
  console.log(
    name.padEnd(34) +
      (times.length / seconds).toFixed(0).padStart(8) +
      pct(sorted, 50).toFixed(1).padStart(9) +
      pct(sorted, 95).toFixed(1).padStart(9) +
      pct(sorted, 99).toFixed(1).padStart(9) +
      String(e).padStart(8),
  );
}
console.log(
  `\nTotal: ${total} requisições (${(total / seconds).toFixed(0)}/s), ${errors} com erro.`,
);
console.log(
  'Obs.: o limite de 300 req/min por IP (rate limit) devolve 429 acima disso; em produção real o IP é de cada usuário.',
);
process.exit(errors > total * 0.01 ? 1 : 0);
