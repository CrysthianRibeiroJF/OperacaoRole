import type { PollDto, PollOptionDto } from '@role/contracts';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ForecastStrip } from '../../components/ForecastStrip';
import { IconArrowLeft, IconCheck, IconPin, IconShare } from '../../components/icons';
import { AvatarStack, Badge, ErrorState, Spinner } from '../../components/misc';
import { Sheet } from '../../components/Sheet';
import { api, ApiError } from '../../lib/api';
import { formatEventDates } from '../../lib/format';
import { keys, useAction, usePoll } from '../../lib/queries';
import { Stamp } from '../events/shared';

const pollUrl = (code: string) => `${window.location.origin}/enquete/${code}`;

async function sharePoll(poll: PollDto) {
  const url = pollUrl(poll.code);
  const text = `Bora decidir? ${poll.title} Vota aí, é rapidinho:`;
  if (navigator.share) {
    try {
      await navigator.share({ title: poll.title, text, url });
      return;
    } catch {
      /* cancelou: cai para o WhatsApp */
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener');
}

/** Abre a criação do rolê já preenchida com a opção vencedora. */
function proposalLink(poll: PollDto, option: PollOptionDto): string {
  const q = new URLSearchParams({ enquete: poll.id, titulo: poll.title });
  if (option.destination) q.set('destino', option.destination);
  if (option.startDate) q.set('inicio', option.startDate);
  if (option.endDate) q.set('fim', option.endDate);
  return `/novo?${q.toString()}`;
}

export function PollPage() {
  const { code = '' } = useParams();
  const { data: poll, isPending, error, refetch } = usePoll(code);

  if (isPending) return <Spinner />;
  if (error || !poll) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <ErrorState
        message={missing ? 'Essa enquete não existe mais.' : 'Não consegui abrir a enquete.'}
        {...(missing ? {} : { onRetry: () => void refetch() })}
      />
    );
  }
  return <PollView poll={poll} />;
}

function PollView({ poll }: { poll: PollDto }) {
  const navigate = useNavigate();
  const [closing, setClosing] = useState(false);
  const open = poll.status === 'open';
  const maxVotes = Math.max(1, ...poll.options.map((o) => o.votes));
  const winner = poll.options.find((o) => o.id === poll.winnerOptionId) ?? null;
  const refresh = [keys.poll(poll.code), keys.polls];

  const vote = useAction(
    (optionIds: string[]) => api.put(`/polls/${poll.id}/votes`, { optionIds }),
    { invalidate: refresh },
  );
  const close = useAction(
    (optionId?: string) => api.post(`/polls/${poll.id}/close`, optionId ? { optionId } : {}),
    {
      invalidate: refresh,
      success: 'Enquete encerrada',
      onSuccess: () => setClosing(false),
    },
  );

  function toggle(option: PollOptionDto) {
    const mine = poll.options.filter((o) => o.votedByMe).map((o) => o.id);
    vote.mutate(option.votedByMe ? mine.filter((id) => id !== option.id) : [...mine, option.id]);
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-5">
      <header>
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-navy-dark">
          <IconArrowLeft size={16} /> Meus rolês
        </Link>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="eyebrow">Enquete nº {poll.code}</span>
          <Badge tone={open ? 'sun' : 'neutral'}>{open ? 'Votação aberta' : 'Encerrada'}</Badge>
        </div>
        <h1 className="mt-2 text-[2.4rem]">{poll.title}</h1>
        <p className="mt-2 text-sm text-muted">
          Criada por {poll.organizer.name} ·{' '}
          {poll.totalVoters === 0
            ? 'ninguém votou ainda'
            : `${poll.totalVoters} ${poll.totalVoters === 1 ? 'pessoa votou' : 'pessoas votaram'}`}
        </p>
      </header>

      {open && (
        <p className="rounded-xl bg-desk-deep p-3 text-sm">
          Pode marcar <strong>mais de uma opção</strong>: vale tudo que funciona para você. Quem
          tiver mais marcas vence.
        </p>
      )}

      <ul className="space-y-3">
        {poll.options.map((o) => {
          const isWinner = o.id === poll.winnerOptionId;
          const leading = open && poll.leaderOptionIds.includes(o.id);
          return (
            <li
              key={o.id}
              className={`card space-y-3 p-4 ${o.votedByMe ? 'ring-2 ring-navy' : ''} ${isWinner ? 'ring-2 ring-ok' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-[1.7rem] font-extrabold uppercase leading-none">
                    {o.label}
                  </p>
                  {o.destination && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-navy-dark">
                      <IconPin size={15} /> {o.destination}
                    </p>
                  )}
                  {o.startDate && (
                    <p className="text-sm text-muted">{formatEventDates(o.startDate, o.endDate)}</p>
                  )}
                </div>
                {isWinner && (
                  <Stamp tone="ok" size="sm">
                    Vencedora
                  </Stamp>
                )}
                {leading && !isWinner && (
                  <Badge tone="info">
                    {poll.leaderOptionIds.length > 1 ? 'Empate' : 'Na frente'}
                  </Badge>
                )}
              </div>

              {o.destination && o.startDate && (
                <ForecastStrip
                  destination={o.destination}
                  startDate={o.startDate}
                  endDate={o.endDate}
                />
              )}

              <div>
                <div className="h-2 overflow-hidden rounded-full bg-desk-deep" aria-hidden>
                  <div
                    className={`h-full rounded-full ${isWinner ? 'bg-ok' : 'bg-navy'}`}
                    style={{ width: `${(o.votes / maxVotes) * 100}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="mono text-sm font-semibold">
                    {o.votes} {o.votes === 1 ? 'voto' : 'votos'}
                  </span>
                  {o.voters.length > 0 && <AvatarStack users={o.voters} max={5} />}
                </div>
              </div>

              {open && poll.loggedIn && (
                <Button
                  variant={o.votedByMe ? 'secondary' : 'soft'}
                  block
                  loading={vote.isPending}
                  aria-pressed={o.votedByMe}
                  onClick={() => toggle(o)}
                >
                  {o.votedByMe ? (
                    <>
                      <IconCheck size={17} /> Voto marcado
                    </>
                  ) : (
                    'Essa funciona pra mim'
                  )}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {open && !poll.loggedIn && (
        <Link
          to={`/entrar?next=${encodeURIComponent(`/enquete/${poll.code}`)}`}
          className="key flex min-h-12 items-center justify-center rounded-[10px] bg-sol px-5 font-bold text-on-sol [--key-edge:var(--color-sol-dark)]"
        >
          Entrar para votar
        </Link>
      )}

      {open && (
        <Button variant="soft" block onClick={() => void sharePoll(poll)}>
          <IconShare size={18} /> Chamar a turma para votar
        </Button>
      )}

      {open && poll.isOrganizer && (
        <Button variant="secondary" block onClick={() => setClosing(true)}>
          Encerrar enquete
        </Button>
      )}

      {!open && winner && (
        <section className="card space-y-3 p-5">
          <h2>E agora?</h2>
          {poll.event ? (
            <>
              <p className="text-muted">A proposta já foi lançada. Responda se está dentro.</p>
              <Link
                to={poll.isOrganizer ? `/role/${poll.event.id}` : `/c/${poll.event.code}`}
                className="key flex min-h-12 items-center justify-center rounded-[10px] bg-sol px-5 font-bold text-on-sol [--key-edge:var(--color-sol-dark)]"
              >
                {poll.isOrganizer ? 'Abrir o rolê' : 'Responder à proposta'}
              </Link>
            </>
          ) : poll.isOrganizer ? (
            <>
              <p className="text-muted">
                Venceu <strong className="text-ink">{winner.label}</strong>. Lance a proposta com o
                cartão já preenchido: quem votou é avisado.
              </p>
              <Button block onClick={() => navigate(proposalLink(poll, winner))}>
                Criar a proposta com a vencedora
              </Button>
            </>
          ) : (
            <p className="text-muted">
              Venceu <strong className="text-ink">{winner.label}</strong>. {poll.organizer.name} vai
              lançar a proposta e você recebe o aviso aqui.
            </p>
          )}
        </section>
      )}

      <Sheet open={closing} title="Encerrar enquete" onClose={() => setClosing(false)}>
        <CloseForm
          poll={poll}
          loading={close.isPending}
          onClose={() => setClosing(false)}
          onSubmit={(optionId) => close.mutate(optionId)}
        />
      </Sheet>
    </div>
  );
}

function CloseForm({
  poll,
  loading,
  onClose,
  onSubmit,
}: {
  poll: PollDto;
  loading: boolean;
  onClose: () => void;
  onSubmit: (optionId?: string) => void;
}) {
  const leaders = poll.leaderOptionIds;
  const decided = leaders.length === 1;
  const candidates =
    leaders.length > 1 ? poll.options.filter((o) => leaders.includes(o.id)) : poll.options;
  const [picked, setPicked] = useState('');

  if (decided) {
    const lead = poll.options.find((o) => o.id === leaders[0])!;
    return (
      <div className="space-y-4">
        <p className="text-muted">
          Vence <strong className="text-ink">{lead.label}</strong> com {lead.votes}{' '}
          {lead.votes === 1 ? 'voto' : 'votos'}. Depois de encerrar, ninguém mais vota.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="ghost" onClick={onClose}>
            Ainda não
          </Button>
          <Button loading={loading} onClick={() => onSubmit()}>
            Encerrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-muted">
        {leaders.length > 1
          ? 'Deu empate. Você desempata: escolha uma das opções na frente.'
          : 'Ninguém votou ainda. Se encerrar agora, escolha a opção que vale.'}
      </p>
      <div className="space-y-2" role="radiogroup" aria-label="Opção vencedora">
        {candidates.map((o) => (
          <label
            key={o.id}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 ${picked === o.id ? 'border-navy bg-navy-soft/50' : 'border-line'}`}
          >
            <input
              type="radio"
              name="winner"
              className="size-4 accent-navy"
              checked={picked === o.id}
              onChange={() => setPicked(o.id)}
            />
            <span className="font-bold">
              {o.label} <span className="font-normal text-muted">· {o.votes} votos</span>
            </span>
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="ghost" onClick={onClose}>
          Ainda não
        </Button>
        <Button loading={loading} disabled={!picked} onClick={() => onSubmit(picked)}>
          Encerrar
        </Button>
      </div>
    </div>
  );
}
