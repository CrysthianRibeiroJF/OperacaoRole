import type { CrewDto } from '@role/contracts';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { IconArrowLeft, IconShare, IconTrash } from '../../components/icons';
import { Avatar, EmptyState, ErrorState, Field, Skeleton } from '../../components/misc';
import { api } from '../../lib/api';
import { keys, useAction, useCrews } from '../../lib/queries';

const crewUrl = (code: string) => `${window.location.origin}/tropa/${code}`;

async function shareCrew(crew: CrewDto) {
  const url = crewUrl(crew.code);
  const text = `Entra na tropa "${crew.name}" no Operação Rolê: assim a gente chama todo mundo de uma vez.`;
  if (navigator.share) {
    try {
      await navigator.share({ title: crew.name, text, url });
      return;
    } catch {
      /* cancelou: cai para o WhatsApp */
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener');
}

/** Tropa: o grupo fixo de amigos. Entra quem abre o link; o Idealizador chama todos de uma vez. */
export function CrewsPage() {
  const { data, isPending, isError, refetch } = useCrews();
  const [name, setName] = useState('');

  const create = useAction((n: string) => api.post<CrewDto>('/crews', { name: n }), {
    invalidate: [keys.crews],
    success: 'Tropa criada. Agora mande o link para a turma.',
    onSuccess: () => setName(''),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length >= 2) create.mutate(name.trim());
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-5">
      <header>
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-navy-dark">
          <IconArrowLeft size={16} /> Meus rolês
        </Link>
        <h1 className="mt-2 text-[3rem]">Tropas</h1>
        <p className="mt-2 text-muted">
          Monte o grupo fixo de amigos uma vez. A cada rolê novo, você chama a tropa inteira com um
          toque. Só entra quem abrir o link e aceitar.
        </p>
      </header>

      <form onSubmit={submit} className="card space-y-3 p-5">
        <Field label="Nome da nova tropa">
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Os de sempre"
            maxLength={40}
          />
        </Field>
        <Button type="submit" block loading={create.isPending} disabled={name.trim().length < 2}>
          Criar tropa
        </Button>
      </form>

      {isPending && <Skeleton rows={2} />}
      {isError && (
        <ErrorState message="Não consegui carregar suas tropas." onRetry={() => void refetch()} />
      )}
      {data && data.length === 0 && (
        <EmptyState emoji="🪺" title="Nenhuma tropa ainda">
          Crie a primeira e mande o link no grupo do WhatsApp.
        </EmptyState>
      )}
      {data?.map((crew) => (
        <CrewCard key={crew.id} crew={crew} />
      ))}
    </div>
  );
}

function CrewCard({ crew }: { crew: CrewDto }) {
  const invalidate = [keys.crews];
  const leave = useAction(() => api.post(`/crews/${crew.id}/leave`), {
    invalidate,
    success: 'Você saiu da tropa',
  });
  const drop = useAction(() => api.delete(`/crews/${crew.id}`), {
    invalidate,
    success: 'Tropa excluída',
  });
  const remove = useAction((userId: string) => api.post(`/crews/${crew.id}/remove`, { userId }), {
    invalidate,
  });

  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate">{crew.name}</h2>
          <p className="text-sm text-muted">
            {crew.members.length} {crew.members.length === 1 ? 'pessoa' : 'pessoas'} · criada por{' '}
            {crew.isOwner ? 'você' : crew.owner.name}
          </p>
        </div>
        <Button size="sm" variant="soft" onClick={() => void shareCrew(crew)}>
          <IconShare size={16} /> Convidar
        </Button>
      </div>

      <ul className="divide-y divide-line">
        {crew.members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2.5">
            <Avatar user={m} size={34} />
            <span className="min-w-0 flex-1 truncate font-bold">{m.name}</span>
            {crew.isOwner && m.id !== crew.owner.id && (
              <button
                type="button"
                aria-label={`Tirar ${m.name} da tropa`}
                className="grid size-9 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                onClick={() => remove.mutate(m.id)}
              >
                <IconTrash size={17} />
              </button>
            )}
          </li>
        ))}
      </ul>

      {crew.isOwner ? (
        <Button
          variant="danger"
          size="sm"
          loading={drop.isPending}
          onClick={() => drop.mutate(undefined)}
        >
          Excluir tropa
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          loading={leave.isPending}
          onClick={() => leave.mutate(undefined)}
        >
          Sair da tropa
        </Button>
      )}
    </section>
  );
}
