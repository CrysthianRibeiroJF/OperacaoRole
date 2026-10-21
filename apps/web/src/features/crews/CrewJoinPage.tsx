import type { CrewDto } from '@role/contracts';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ErrorState, Spinner } from '../../components/misc';
import { api, ApiError } from '../../lib/api';
import { keys, useAction, useCrewPreview } from '../../lib/queries';

/** Link da tropa: mostra só o nome, o dono e quantos já entraram. Entrar é um gesto da própria pessoa. */
export function CrewJoinPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { data, isPending, error, refetch } = useCrewPreview(code);

  const join = useAction(() => api.post<CrewDto>(`/crews/code/${code}/join`), {
    invalidate: [keys.crews, keys.crewPreview(code)],
    success: 'Você entrou na tropa',
    onSuccess: () => navigate('/tropas', { replace: true }),
  });

  if (isPending) return <Spinner />;
  if (error || !data) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <ErrorState
        message={missing ? 'Essa tropa não existe mais.' : 'Não consegui abrir o convite da tropa.'}
        {...(missing ? {} : { onRetry: () => void refetch() })}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-5 text-center">
      <p className="eyebrow">Convite de tropa</p>
      <h1 className="text-[2.6rem]">{data.name}</h1>
      <p className="text-muted">
        {data.owner.name} chamou você para a tropa. Hoje ela tem{' '}
        <strong className="text-ink">
          {data.memberCount} {data.memberCount === 1 ? 'pessoa' : 'pessoas'}
        </strong>
        . Entrando, você recebe um aviso sempre que um rolê novo for lançado para o grupo. Você sai
        quando quiser.
      </p>

      {data.joined === null ? (
        <Link
          to={`/entrar?next=${encodeURIComponent(`/tropa/${data.code}`)}`}
          className="key flex min-h-12 items-center justify-center rounded-[10px] bg-sol px-5 font-bold text-on-sol [--key-edge:var(--color-sol-dark)]"
        >
          Entrar para fazer parte
        </Link>
      ) : data.joined ? (
        <Link to="/tropas" className="block font-bold text-navy-dark">
          Você já está na tropa. Ver minhas tropas
        </Link>
      ) : (
        <Button size="lg" block loading={join.isPending} onClick={() => join.mutate(undefined)}>
          Entrar na tropa
        </Button>
      )}
    </div>
  );
}
