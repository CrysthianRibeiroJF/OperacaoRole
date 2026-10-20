import type { SessionDto } from '@role/contracts';
import { checkPassword, PASSWORD_PROBLEM_MESSAGES } from '@role/domain';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { PasswordField, RecoveryCodeBox } from '../../components/auth';
import { Badge, ErrorState, Field, Skeleton } from '../../components/misc';
import { Sheet } from '../../components/Sheet';
import { api } from '../../lib/api';
import { formatDateTime, timeAgo } from '../../lib/format';
import { keys, useAction, useSecurity } from '../../lib/queries';
import { AccountPage } from './AccountLayout';

export function SecuritySettings() {
  const { data, isPending, isError, refetch } = useSecurity();
  const [changing, setChanging] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const revoke = useAction((id: string) => api.post(`/me/sessions/${id}/revoke`), {
    invalidate: [keys.security],
    success: 'Aparelho desconectado',
  });
  const revokeOthers = useAction(() => api.post('/me/sessions/revoke-others'), {
    invalidate: [keys.security],
    success: 'Todos os outros aparelhos foram desconectados',
  });

  if (isPending) return <Skeleton rows={3} />;
  if (isError)
    return (
      <ErrorState
        message="Não consegui carregar a segurança da conta."
        onRetry={() => void refetch()}
      />
    );

  const others = data.sessions.filter((s) => !s.current);

  return (
    <AccountPage
      title="Segurança e acessos"
      intro="Você entra com celular e senha. Sem SMS, o código de recuperação é a sua rede de segurança."
    >
      <section className="card space-y-3 p-5">
        <div>
          <h2>Senha</h2>
          <p className="mt-1 text-sm text-muted">
            {data.passwordChangedAt
              ? 'Última troca: ' + formatDateTime(data.passwordChangedAt) + '.'
              : 'Defina uma senha forte.'}{' '}
            Ao trocar, os outros aparelhos saem da conta.
          </p>
        </div>
        <Button variant="soft" onClick={() => setChanging(true)}>
          Trocar senha
        </Button>
      </section>

      <section className="card space-y-3 p-5">
        <div>
          <h2>Código de recuperação</h2>
          <p className="mt-1 text-sm text-muted">
            {data.recoveryCodeCreatedAt
              ? 'Gerado em ' + formatDateTime(data.recoveryCodeCreatedAt) + '. '
              : 'Você ainda não tem um código. '}
            Se esquecer a senha, é ele que devolve o seu acesso. Perdeu? Gere outro (o antigo para
            de valer).
          </p>
        </div>
        <Button variant="soft" onClick={() => setRegenerating(true)}>
          Gerar novo código
        </Button>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2>Aparelhos conectados</h2>
          {others.length > 0 && (
            <Button
              size="sm"
              variant="danger"
              loading={revokeOthers.isPending}
              onClick={() => revokeOthers.mutate(undefined)}
            >
              Sair dos outros
            </Button>
          )}
        </div>
        <ul className="card divide-y divide-line">
          {data.sessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              loading={revoke.isPending && revoke.variables === s.id}
              onRevoke={() => revoke.mutate(s.id)}
            />
          ))}
        </ul>
        <p className="px-1 text-xs text-muted">
          Não reconhece algum aparelho? Desconecte e troque a senha.
        </p>
      </section>

      <Sheet open={changing} title="Trocar senha" onClose={() => setChanging(false)}>
        {changing && <ChangePasswordForm onDone={() => setChanging(false)} />}
      </Sheet>
      <Sheet open={regenerating} title="Gerar novo código" onClose={() => setRegenerating(false)}>
        {regenerating && <RegenerateForm onClose={() => setRegenerating(false)} />}
      </Sheet>
    </AccountPage>
  );
}

function SessionRow({
  session,
  loading,
  onRevoke,
}: {
  session: SessionDto;
  loading: boolean;
  onRevoke: () => void;
}) {
  return (
    <li className="flex items-center gap-3 p-3.5">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-bold">
          {session.device}
          {session.current && <Badge tone="ok">Este aparelho</Badge>}
        </p>
        <p className="text-sm text-muted">
          Ativo {timeAgo(session.lastSeenAt)} · entrou em {formatDateTime(session.createdAt)}
        </p>
      </div>
      {!session.current && (
        <Button size="sm" variant="ghost" loading={loading} onClick={onRevoke}>
          Desconectar
        </Button>
      )}
    </li>
  );
}

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const problem = next ? checkPassword(next) : null;

  const save = useAction(
    () => api.post('/me/password', { currentPassword: current, newPassword: next }),
    {
      invalidate: [keys.security],
      success: 'Senha alterada. Os outros aparelhos saíram da conta.',
      onSuccess: onDone,
    },
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate(undefined);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Senha atual">
        <PasswordField
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
          autoFocus
        />
      </Field>
      <Field label="Nova senha">
        <PasswordField value={next} onChange={setNext} autoComplete="new-password" showStrength />
      </Field>
      {problem && (
        <p className="-mt-2 text-sm font-bold text-warn">{PASSWORD_PROBLEM_MESSAGES[problem]}</p>
      )}
      <Button
        type="submit"
        block
        loading={save.isPending}
        disabled={!current || !next || !!problem}
      >
        Salvar nova senha
      </Button>
    </form>
  );
}

function RegenerateForm({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState<string | null>(null);

  const generate = useAction(
    () => api.post<{ recoveryCode: string }>('/me/recovery-code', { password }),
    {
      invalidate: [keys.security],
      onSuccess: (res) => setCode(res.recoveryCode),
    },
  );

  if (code) return <RecoveryCodeBox code={code} confirmLabel="Pronto" onConfirm={onClose} />;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        generate.mutate(undefined);
      }}
    >
      <p className="text-sm text-muted">
        Por segurança, confirme sua senha. O código anterior deixa de valer.
      </p>
      <Field label="Sua senha">
        <PasswordField
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          autoFocus
        />
      </Field>
      <Button type="submit" block loading={generate.isPending} disabled={!password}>
        Gerar código
      </Button>
    </form>
  );
}
