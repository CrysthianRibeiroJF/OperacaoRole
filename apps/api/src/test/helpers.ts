import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { loadConfig } from '../config';
import type { AppContext, Clock } from '../context';
import { createDb } from '../db/client';
import { migrateToLatest } from '../db/migrate';
import { MemoryStorage } from '../lib/storage';
import { ConsoleOtpSender } from '../modules/auth/otp-sender';

export class FakeClock implements Clock {
  constructor(private current: Date) {}
  now(): Date {
    return new Date(this.current);
  }
  advanceHours(hours: number) {
    this.current = new Date(this.current.getTime() + hours * 3_600_000);
  }
}

export async function makeApp() {
  const config = loadConfig({
    NODE_ENV: 'test',
    SESSION_SECRET: 'test-secret-with-more-than-32-characters!!',
    OTP_DEV_ECHO: 'true',
  } as NodeJS.ProcessEnv);
  const db = createDb(':memory:');
  await migrateToLatest(db);
  const clock = new FakeClock(new Date('2026-11-01T12:00:00Z'));
  const storage = new MemoryStorage();
  const ctx: AppContext = { db, config, clock, storage, otpSender: new ConsoleOtpSender(() => {}) };
  const app = await buildApp(ctx);
  return { app, ctx, clock, storage };
}

export interface Res<T = any> {
  status: number;
  body: T;
}

/** Cliente de teste com sessão por cookie, como o navegador. */
export class Client {
  private cookie = '';
  userId = '';

  constructor(
    private readonly app: FastifyInstance,
    readonly phone: string,
    readonly name: string,
  ) {}

  async login(): Promise<this> {
    const req = await this.app.inject({
      method: 'POST',
      url: '/api/auth/otp/request',
      payload: { phone: this.phone },
    });
    const { devCode } = req.json();
    const res = await this.app.inject({
      method: 'POST',
      url: '/api/auth/otp/verify',
      payload: { phone: this.phone, code: devCode, name: this.name },
    });
    const session = res.cookies.find((c) => c.name === 'role_session');
    if (!session) throw new Error(`login falhou: ${res.body}`);
    this.cookie = `role_session=${session.value}`;
    this.userId = res.json().id;
    return this;
  }

  async call<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    payload?: unknown,
  ): Promise<Res<T>> {
    const res = await this.app.inject({
      method,
      url: `/api${url}`,
      payload: payload as object | undefined,
      headers: this.cookie ? { cookie: this.cookie } : {},
    });
    return { status: res.statusCode, body: res.body ? safeJson(res.body) : null };
  }

  get = <T = any>(url: string) => this.call<T>('GET', url);
  post = <T = any>(url: string, body?: unknown) => this.call<T>('POST', url, body ?? {});
  put = <T = any>(url: string, body?: unknown) => this.call<T>('PUT', url, body ?? {});

  async upload<T = any>(url: string, file: Buffer): Promise<Res<T>> {
    const boundary = `----t${Math.random().toString(16).slice(2)}`;
    const head = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="f.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`,
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const res = await this.app.inject({
      method: 'POST',
      url: `/api${url}`,
      payload: Buffer.concat([head, file, tail]),
      headers: { cookie: this.cookie, 'content-type': `multipart/form-data; boundary=${boundary}` },
    });
    return { status: res.statusCode, body: res.body ? safeJson(res.body) : null };
  }
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
]);

export const eventInput = (over: Record<string, unknown> = {}) => ({
  title: 'Bate e volta Maresias',
  destination: 'Maresias, SP',
  startDate: '2026-11-14',
  costCapCents: 12000,
  quorum: 3,
  responseHours: 48,
  requiresDeposit: false,
  ...over,
});
