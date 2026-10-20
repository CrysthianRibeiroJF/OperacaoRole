import type { Config } from '../../config';
import { AppError } from '../../errors';

/** Ponto de extensão para SMS/WhatsApp (Twilio, Zenvia, etc.). */
export interface OtpSender {
  send(phone: string, code: string): Promise<void>;
}

/** Desenvolvimento e testes: imprime o código no console do servidor. */
export class ConsoleOtpSender implements OtpSender {
  constructor(private readonly log: (msg: string) => void = console.log) {}

  async send(phone: string, code: string): Promise<void> {
    this.log(`[otp] código para ${phone}: ${code}`);
  }
}

/** Produção sem provedor configurado: falha de forma explícita em vez de vazar o código em log. */
export class UnconfiguredOtpSender implements OtpSender {
  async send(): Promise<void> {
    throw new AppError(
      503,
      'OTP_PROVIDER_MISSING',
      'Envio de código não configurado. Implemente um OtpSender de produção.',
    );
  }
}

export function createOtpSender(config: Config): OtpSender {
  return config.NODE_ENV === 'production' ? new UnconfiguredOtpSender() : new ConsoleOtpSender();
}
