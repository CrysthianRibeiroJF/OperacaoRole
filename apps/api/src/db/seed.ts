import { loadConfig } from '../config';
import { systemClock, type AppContext } from '../context';
import { newId } from '../ids';
import { LocalDiskStorage } from '../lib/storage';
import { TERMS_VERSION } from '@role/domain';
import { hashPassword } from '../lib/credentials';
import { createEvent, respond } from '../modules/events/event.service';
import { createExpense } from '../modules/expenses/expenses.service';
import { claimRole } from '../modules/roles/roles.service';
import { createRoom, joinRoom } from '../modules/rooms/rooms.service';
import { createVehicle, joinVehicle } from '../modules/fleet/fleet.service';
import { suggestSupplyList } from '../modules/supplies/supplies.service';
import { updateBudget } from '../modules/events/event.service';
import { createDb } from './client';
import { migrateToLatest } from './migrate';

/** Dados de demonstração para desenvolver e apresentar. Telefones fictícios; todos entram com a senha DEMO_PASSWORD. */
const config = loadConfig();
if (config.NODE_ENV === 'production') throw new Error('O seed não roda em produção');

const db = createDb(config.DATABASE_PATH);
await migrateToLatest(db);
const ctx: AppContext = {
  db,
  config,
  clock: systemClock,
  storage: new LocalDiskStorage(config.UPLOAD_DIR),
};

const DEMO_PASSWORD = 'role-demo-2026';

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
      deleted_at: null,
      password_hash: await hashPassword(DEMO_PASSWORD),
      password_changed_at: new Date().toISOString(),
      recovery_hash: null,
      recovery_created_at: null,
      terms_accepted_at: new Date().toISOString(),
      terms_version: TERMS_VERSION,
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

// Fase 2: custos fixos, lista de mercado sugerida e dois carros.
await updateBudget(ctx, bia, trip.id, 180000);
await suggestSupplyList(ctx, ana, trip.id);
await createVehicle(ctx, bia, trip.id, {
  label: 'Gol da Bia',
  seats: 3,
  cargoCapacity: 2,
  departurePlace: 'Pinheiros',
  departureTime: '07:30',
  cargoNote: '1 cooler grande e 4 mochilas',
});
await createVehicle(ctx, caio, trip.id, {
  label: 'Onix do Caio',
  seats: 2,
  cargoCapacity: 1,
  departurePlace: 'Vila Madalena',
  departureTime: '08:00',
});
const cars = await db
  .selectFrom('vehicles')
  .select(['id', 'driver_id'])
  .where('event_id', '=', trip.id)
  .execute();
const biaCar = cars.find((c) => c.driver_id === bia);
if (biaCar) await joinVehicle(ctx, ana, biaCar.id);

// Quartos da Base (a Bia é a General da Base).
await createRoom(ctx, bia, trip.id, { name: 'Suíte', beds: 2, doubleBeds: 0 });
await createRoom(ctx, bia, trip.id, { name: 'Quarto do beliche', beds: 4, doubleBeds: 0 });
const suite = await db
  .selectFrom('rooms')
  .select('id')
  .where('event_id', '=', trip.id)
  .where('name', '=', 'Suíte')
  .executeTakeFirst();
if (suite) await joinRoom(ctx, bia, suite.id);

console.log('Seed aplicado. Entre com qualquer telefone abaixo, senha ' + DEMO_PASSWORD + ':');
for (const p of people)
  console.log(`  ${p.name}: (${p.phone.slice(2, 4)}) ${p.phone.slice(4, 9)}-${p.phone.slice(9)}`);
await db.destroy();
