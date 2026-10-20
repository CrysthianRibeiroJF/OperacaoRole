import type { Kysely } from 'kysely';
import type { Config } from './config';
import type { Database } from './db/types';
import type { FileStorage } from './lib/storage';
import type { OtpSender } from './modules/auth/otp-sender';

/** Relógio injetável: permite testar prazos, expirações e lembretes sem esperar. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export interface AppContext {
  db: Kysely<Database>;
  config: Config;
  clock: Clock;
  storage: FileStorage;
  otpSender: OtpSender;
}

/** Aceita o banco ou uma transação nas funções de serviço. */
export type Db = Kysely<Database>;
