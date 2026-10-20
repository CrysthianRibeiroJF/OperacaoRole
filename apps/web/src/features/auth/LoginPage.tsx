import { useQueryClient } from '@tanstack/react-query';
import type { AuthResult, ProfileDto } from '@role/contracts';
import {
  checkPassword,
  formatRecoveryCode,
  normalizeRecoveryCode,
  PASSWORD_PROBLEM_MESSAGES,
} from '@role/domain';
import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { PasswordField, RecoveryCodeBox } from '../../components/auth';
import { IconPin, Swallow } from '../../components/icons';
import { Field } from '../../components/misc';
import { api, ApiError, errorMessage } from '../../lib/api';
import { formatBRL, formatEventDates, maskPhone } from '../../lib/format';
import { keys, useInvite } from '../../lib/queries';
import { Stamp, Ticket } from '../events/shared';

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

/** Quem chegou por um convite vê o rolê de verdade antes de criar a conta. */
function InviteContext({ code }: { code: string }) {
  const { data } = useInvite(code);
  if (!data) return <ThesisDemo />;
  const { event } = data;
  return (
    <Ticket
      night
      top={
        <div className="px-5 pb-5 pt-4">
          <p className="eyebrow !text-white/55">Você foi chamado · ordem nº {event.code}</p>
          <p className="font-display mt-2 text-[2rem] font-extrabold uppercase leading-[0.95]">
            {event.title}
          </p>
          <p className="mt-2 flex items-center gap-1.5 font-bold text-sol">
            <IconPin size={16} /> {event.destination}
          </p>
          <p className="text-sm text-white/70">
            {formatEventDates(event.startDate, event.endDate)} · {formatBRL(event.costCapCents)} por
            pessoa
          </p>
        </div>
      }
      bottom={
        <p className="px-5 pb-4 pt-5 text-sm text-muted">
          {event.confirmedCount} de {event.quorum} andorinhas já confirmaram. Entre ou crie sua
          conta para responder.
        </p>
      }
    />
  );
}

type Mode = 'login' | 'register' | 'recover' | 'code';

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const next = safeNext(params.get('next'));
  const inviteCode = /^\/c\/([A-Za-z0-9]+)/.exec(next)?.[1];

  const [mode, setMode] = useState<Mode>(inviteCode ? 'register' : 'login');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const phoneOk = phone.replace(/\D/g, '').length >= 10;
  const passwordProblem = password ? checkPassword(password, phone) : null;

  function enter(profile: ProfileDto) {
    qc.clear();
    qc.setQueryData(keys.session, { profile });
    navigate(next, { replace: true });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') {
        const res = await api.post<AuthResult>('/auth/login', { phone, password });
        enter(res.profile);
      } else if (mode === 'register') {
        const res = await api.post<AuthResult>('/auth/register', { phone, name, password });
        // A sessão já existe; segura a navegação até a pessoa guardar o código de recuperação.
        qc.clear();
        qc.setQueryData(keys.session, { profile: res.profile });
        setIssuedCode(res.recoveryCode ?? null);
        setMode('code');
      } else if (mode === 'recover') {
        const res = await api.post<AuthResult>('/auth/recover', {
          phone,
          recoveryCode: recoveryInput,
          newPassword: password,
        });
        qc.clear();
        qc.setQueryData(keys.session, { profile: res.profile });
        setIssuedCode(res.recoveryCode ?? null);
        setMode('code');
      }
    } catch (err) {
      setError(errorMessage(err));
      if (err instanceof ApiError && err.code === 'PHONE_TAKEN') setMode('login');
    } finally {
      setBusy(false);
    }
  }

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setPassword('');
  };

  const canSubmit =
    mode === 'login'
      ? phoneOk && password.length > 0
      : mode === 'register'
        ? phoneOk && name.trim().length >= 2 && password.length > 0 && !passwordProblem
        : phoneOk &&
          normalizeRecoveryCode(recoveryInput).length === 16 &&
          password.length > 0 &&
          !passwordProblem;

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

      {mode !== 'code' && (inviteCode ? <InviteContext code={inviteCode} /> : <ThesisDemo />)}

      <div className="card p-5">
        {mode === 'code' && issuedCode ? (
          <div className="space-y-4">
            <h2>Guarde seu código</h2>
            <RecoveryCodeBox
              code={issuedCode}
              confirmLabel="Entrar no app"
              onConfirm={() => navigate(next, { replace: true })}
            />
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            {mode !== 'recover' ? (
              <div
                role="tablist"
                aria-label="Acesso"
                className="grid grid-cols-2 gap-1 rounded-[10px] bg-desk-deep p-1"
              >
                {(
                  [
                    ['login', 'Já tenho conta'],
                    ['register', 'Criar conta'],
                  ] as const
                ).map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => switchMode(m)}
                    className={`min-h-10 rounded-lg text-sm font-extrabold transition-colors ${
                      mode === m ? 'bg-surface text-ink shadow-sm' : 'text-muted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <h2>Recuperar acesso</h2>
                <p className="mt-1 text-sm text-muted">
                  Use o código de recuperação que você guardou no cadastro e escolha uma senha nova.
                </p>
              </div>
            )}

            {mode === 'register' && (
              <Field label="Como podemos te chamar?" hint="É assim que seus amigos vão te ver.">
                <input
                  className="field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  maxLength={60}
                />
              </Field>
            )}

            <Field
              label="Seu celular"
              hint={
                mode === 'register' ? 'Só serve para você entrar: não enviamos SMS.' : undefined
              }
            >
              <input
                className="field"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="(11) 99999-0000"
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
              />
            </Field>

            {mode === 'recover' && (
              <Field label="Código de recuperação">
                <input
                  className="field mono tracking-[0.1em]"
                  value={recoveryInput}
                  onChange={(e) =>
                    setRecoveryInput(
                      formatRecoveryCode(normalizeRecoveryCode(e.target.value).slice(0, 16)),
                    )
                  }
                  placeholder="K7M2-9QXA-PD4T-ZW8R"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                />
              </Field>
            )}

            <Field label={mode === 'recover' ? 'Nova senha' : 'Senha'}>
              <PasswordField
                value={password}
                onChange={setPassword}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                showStrength={mode !== 'login'}
              />
            </Field>
            {mode !== 'login' && passwordProblem && (
              <p className="-mt-2 text-sm font-bold text-warn">
                {PASSWORD_PROBLEM_MESSAGES[passwordProblem]}
              </p>
            )}

            {error && (
              <p
                className="rounded-[10px] bg-danger-soft px-3 py-2 text-sm font-bold text-danger"
                role="alert"
              >
                {error}
              </p>
            )}

            <Button type="submit" block size="lg" loading={busy} disabled={!canSubmit}>
              {mode === 'login'
                ? 'Entrar'
                : mode === 'register'
                  ? 'Criar minha conta'
                  : 'Redefinir senha e entrar'}
            </Button>

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              {mode === 'login' && (
                <LinkButton onClick={() => switchMode('recover')}>Esqueci minha senha</LinkButton>
              )}
              {mode === 'register' && (
                <span className="text-muted">
                  Você vai receber um código de recuperação. Guarde-o.
                </span>
              )}
              {mode === 'recover' && (
                <LinkButton onClick={() => switchMode('login')}>Voltar para entrar</LinkButton>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className="font-bold text-navy-dark underline-offset-2 hover:underline"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
