import { loadConfig } from '../config';
import { systemClock, type AppContext } from '../context';
import { newId } from '../ids';
import { LocalDiskStorage } from '../lib/storage';
import { ConsoleOtpSender } from '../modules/auth/otp-sender';
import { createEvent, respond } from '../modules/events/event.service';
import { createExpense } from '../modules/expenses/expenses.service';
import { claimRole } from '../modules/roles/roles.service';
import { createDb } from './client';
import { migrateToLatest } from './migrate';

/** Dados de demonstração para desenvolver e apresentar. Telefones fictícios; login por código OTP. */
const config = loadConfig();
if (config.NODE_ENV === 'production') throw new Error('O seed não roda em produção');

const db = createDb(config.DATABASE_PATH);
await migrateToLatest(db);
const ctx: AppContext = {
  db,
  config,
  clock: systemClock,
  storage: new LocalDiskStorage(config.UPLOAD_DIR),
  otpSender: new ConsoleOtpSender(),
};

const people = [
  { name: 'Ana', phone: '5511999990001' },
  { name: 'Bia', phone: '5511999990002' },
  { name: 'Caio', phone: '5511999990003' },
  { name: 'Davi', phone: '5511999990004' },
  { name: 'Eva', phone: '5511999990005' },
];

const already = await db
  .selectFrom('users')
  .select('id')
  .where('phone', '=', people[0]!.phone)
  .executeTakeFirst();
if (already) {
  console.log('Seed já aplicado. Apague apps/api/data/role.db para recomeçar.');
  await db.destroy();
  process.exit(0);
}

const ids: Record<string, string> = {};
for (const p of people) {
  const id = newId();
  ids[p.name] = id;
  await db
    .insertInto('users')
    .values({
      id,
      phone: p.phone,
      name: p.name,
      pix_key: `${p.name.toLowerCase()}@pix.com`,
      created_at: new Date().toISOString(),
    })
    .execute();
}
const [ana, bia, caio, davi] = [ids.Ana!, ids.Bia!, ids.Caio!, ids.Davi!];

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

// 1) Proposta aberta, faltando 1 andorinha.
const open = await createEvent(ctx, ana, {
  title: 'Bate e volta Maresias',
  destination: 'Maresias, SP',
  startDate: daysFromNow(6),
  costCapCents: 12000,
  quorum: 3,
  responseHours: 48,
  requiresDeposit: false,
});
await respond(ctx, bia, open.id, { response: 'in' });

// 2) Rolê confirmado, com sinal, cargos e despesas.
const trip = await createEvent(ctx, ana, {
  title: 'Fim de semana em Ubatuba',
  destination: 'Ubatuba, SP',
  startDate: daysFromNow(12),
  endDate: daysFromNow(14),
  costCapCents: 45000,
  quorum: 3,
  responseHours: 72,
  requiresDeposit: true,
  depositCents: 10000,
  pixKey: 'ana@pix.com',
});
await respond(ctx, bia, trip.id, { response: 'in', drinksAlcohol: true });
await respond(ctx, caio, trip.id, { response: 'in', drinksAlcohol: true });
await respond(ctx, davi, trip.id, { response: 'in', diet: 'vegetarian' });
await claimRole(ctx, ana, trip.id, 'treasury');
await claimRole(ctx, bia, trip.id, 'base');
await db
  .updateTable('participations')
  .set({ deposit_status: 'approved' })
  .where('event_id', '=', trip.id)
  .where('user_id', '=', bia)
  .execute();
await createExpense(ctx, bia, trip.id, {
  description: 'Carvão, gelo e temperos',
  category: 'food',
  amountCents: 8400,
  quota: 'global',
});
await createExpense(ctx, caio, trip.id, {
  description: 'Cervejas',
  category: 'drinks',
  amountCents: 14000,
  quota: 'alcohol',
});

console.log(
  'Seed aplicado. Entre com qualquer telefone abaixo (o código aparece no console da API):',
);
for (const p of people)
  console.log(`  ${p.name}: (${p.phone.slice(2, 4)}) ${p.phone.slice(4, 9)}-${p.phone.slice(9)}`);
await db.destroy();
