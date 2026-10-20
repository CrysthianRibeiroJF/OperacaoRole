import { existsSync } from 'node:fs';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3333),
  HOST: z.string().default('127.0.0.1'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET precisa ter ao menos 32 caracteres'),
  DATABASE_PATH: z.string().default('./data/role.db'),
  UPLOAD_DIR: z.string().default('./uploads'),
  PUBLIC_WEB_URL: z.string().url().default('http://localhost:5173'),
  /** Pasta do app compilado (apps/web/dist). Em produção, a API serve o app: um processo, uma origem. */
  WEB_DIST_DIR: z.string().optional(),
  /** Tentativas por minuto e por IP nas rotas de acesso (cadastro, login, recuperação). */
  AUTH_RATE_LIMIT_PER_MIN: z.coerce.number().int().min(1).default(10),
  /** Despesas acima disso (por quem não é Tesoureiro) exigem aprovação. Em centavos. */
  EXPENSE_APPROVAL_THRESHOLD_CENTS: z.coerce.number().int().default(30_000),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  // Carrega apps/api/.env quando existir (Node >= 20.12). Variáveis já definidas têm prioridade.
  if (source === process.env && existsSync('.env')) process.loadEnvFile('.env');

  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Configuração inválida:\n${problems.join('\n')}`);
  }
  const config = parsed.data;
  if (config.NODE_ENV === 'production' && config.SESSION_SECRET.startsWith('dev-only')) {
    throw new Error('Troque o SESSION_SECRET de desenvolvimento antes de ir para produção');
  }
  return config;
}
