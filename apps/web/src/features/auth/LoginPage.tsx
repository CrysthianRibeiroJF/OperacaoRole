import { useQueryClient } from '@tanstack/react-query';
import type { OtpRequestResponse, ProfileDto } from '@role/contracts';
import { useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Swallow } from '../../components/icons';
import { Field } from '../../components/misc';
import { api, ApiError, errorMessage } from '../../lib/api';
import { keys } from '../../lib/queries';
import { Stamp, Ticket } from '../events/shared';

function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Só aceita caminhos internos em `next`, para o login não virar redirecionamento aberto. */
function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

/**
 * A tese do produto em 4 segundos: três andorinhas pousam e o carimbo cai.
 * Roda uma vez; com movimento reduzido aparece pronto.
 */
function ThesisDemo() {
  return (
    <Ticket
      night
      top={
        <div className="px-5 pb-5 pt-4">
          <p className="eyebrow !text-white/55">Ordem nº 7K2M9QXA</p>
          <p className="font-display mt-2 text-[2rem] font-extrabold uppercase leading-[0.95]">
            Bate e volta
            <br />
            Maresias
          </p>
          <p className="mt-2 text-sm text-white/70">Sáb, 14 nov · R$ 120 por pessoa</p>
        </div>
      }
      bottom={
        <div className="relative flex items-center justify-between gap-3 px-5 pb-4 pt-5">
          <div className="flex items-center gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{ '--i': 0, animationDelay: `${700 + i * 750}ms` } as CSSProperties}
                className="slot-in grid size-9 place-items-center rounded-full bg-sol text-on-sol ring-2 ring-night/10"
              >
                <Swallow size={22} />
              </span>
            ))}
          </div>
          <Stamp slam size="md" delayMs={3200}>
            Confirmado
          </Stamp>
        </div>
      }
    />
  );
}

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [needsName, setNeedsName] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<OtpRequestResponse>('/auth/otp/request', { phone });
      setDevCode(res.devCode ?? null);
      setStep('code');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const profile = await api.post<ProfileDto>('/auth/otp/verify', {
        phone,
        code,
        ...(needsName ? { name } : {}),
      });
      qc.clear();
      qc.setQueryData(keys.session, { profile });
      navigate(safeNext(params.get('next')), { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NAME_REQUIRED') {
        setNeedsName(true);
        setError(null);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-7 px-5 py-10">
      <header>
        <p className="eyebrow flex items-center gap-2 !text-ink">
          <span className="grid size-6 place-items-center rounded-full bg-sol text-on-sol">
            <Swallow size={14} />
          </span>
          Operação Rolê
        </p>
        <h1 className="mt-4 text-[3.5rem]">
          Do “bora?”
          <br />
          ao confirmado.
        </h1>
        <p className="mt-3 max-w-[30ch] text-muted">
          Lance o rolê, junte as primeiras andorinhas e deixe o app cobrar quem precisa.
        </p>
      </header>

      <ThesisDemo />

      <div className="card p-5">
        {step === 'phone' ? (
          <form onSubmit={requestCode} className="space-y-4">
            <Field
              label="Seu celular"
              hint="Enviamos um código de 6 dígitos. Sem senha para decorar."
            >
              <input
                className="field"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="(11) 99999-0000"
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                required
              />
            </Field>
            {error && (
              <p className="text-sm font-bold text-danger" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              block
              size="lg"
              loading={busy}
              disabled={phone.replace(/\D/g, '').length < 10}
            >
              Receber código
            </Button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <Field label="Código de 6 dígitos" hint={`Enviado para ${phone}`}>
              <input
                className="field mono text-center text-2xl font-semibold tracking-[0.45em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
                autoFocus
              />
            </Field>
            {devCode && (
              <button
                type="button"
                onClick={() => setCode(devCode)}
                className="w-full rounded-[10px] bg-sol-soft px-3 py-2 text-left text-sm text-sol-ink"
              >
                <strong>Modo desenvolvimento:</strong> seu código é{' '}
                <strong className="mono">{devCode}</strong>. Toque para preencher.
              </button>
            )}
            {needsName && (
              <Field label="Como podemos te chamar?" hint="É assim que seus amigos vão te ver.">
                <input
                  className="field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={60}
                  autoFocus
                />
              </Field>
            )}
            {error && (
              <p className="text-sm font-bold text-danger" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              block
              size="lg"
              loading={busy}
              disabled={code.length !== 6 || (needsName && name.trim().length < 2)}
            >
              Entrar
            </Button>
            <div className="flex justify-between text-sm">
              <button
                type="button"
                className="font-bold text-navy-dark"
                onClick={() => {
                  setStep('phone');
                  setCode('');
                  setNeedsName(false);
                }}
              >
                Trocar número
              </button>
              <button
                type="button"
                className="font-bold text-navy-dark"
                onClick={() => void requestCode()}
              >
                Reenviar código
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
