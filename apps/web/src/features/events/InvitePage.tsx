import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { IconArrowLeft, IconBeer, IconClock, IconLeaf, IconPin } from '../../components/icons';
import { AvatarStack, Countdown, ErrorState, Spinner, Toggle } from '../../components/misc';
import { api, ApiError } from '../../lib/api';
import { formatBRL, formatDateTime, formatEventDates } from '../../lib/format';
import { eventKeys, keys, useAction, useInvite, useSession } from '../../lib/queries';
import { track } from '../../lib/telemetry';
import { ShareButton, Stamp, StatusTag, SwallowMeter, Ticket } from './shared';

/** "O Convite": tela pública, feita para converter rápido (Tô dentro / Passo). */
export function InvitePage() {
  const { code = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: session } = useSession();
  const { data, isPending, error, refetch } = useInvite(code);
  const [showWhy, setShowWhy] = useState(false);

  useEffect(() => {
    if (data) track('invite_viewed', { once: code });
  }, [data, code]);

  const loggedIn = !!session?.profile;
  const eventId = data?.event.id ?? '';
  const invalidate = eventKeys(eventId, code);

  const respond = useAction(
    (body: { response: 'in' | 'out'; drinksAlcohol?: boolean; diet?: 'omnivore' | 'vegetarian' }) =>
      api.post(`/events/${eventId}/respond`, body),
    { invalidate },
  );
  const prefs = useAction(
    (body: { drinksAlcohol: boolean; diet: 'omnivore' | 'vegetarian' }) =>
      api.put(`/events/${eventId}/preferences`, body),
    { invalidate: [keys.invite(code), keys.event(eventId)] },
  );

  if (isPending) return <Spinner />;
  if (error) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <ErrorState
        message={
          notFound
            ? 'Esse convite não existe (ou o link veio incompleto).'
            : 'Não consegui abrir o convite.'
        }
        {...(notFound ? {} : { onRetry: () => void refetch() })}
      />
    );
  }

  const { event, confirmed, me } = data;
  const joined = me?.participation === 'in';
  const passed = me?.participation === 'out';
  const live = event.status === 'open' || event.status === 'confirmed';
  const fresh = params.get('novo') === '1';

  function join() {
    if (!loggedIn) {
      navigate(`/entrar?next=${encodeURIComponent(`/c/${code}`)}`);
      return;
    }
    respond.mutate({ response: 'in' });
  }

  const headline =
    event.status === 'confirmed'
      ? event.belowQuorum
        ? 'Confirmado, mas abaixo do mínimo. Chame mais gente.'
        : 'Rolê oficial. Agora é entrar ou ficar de fora.'
      : event.status === 'open'
        ? event.missing === 1
          ? 'Falta só 1 pessoa para virar oficial.'
          : `Faltam ${event.missing} para virar oficial.`
        : '';

  return (
    <div className="mx-auto w-full max-w-xl space-y-5 pb-4">
      {loggedIn && (
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-navy-dark">
          <IconArrowLeft size={16} /> Meus rolês
        </Link>
      )}

      {fresh && joined && (
        <div className="rounded-[14px] bg-ok-soft p-4 text-ok">
          <p className="font-display text-2xl font-extrabold uppercase">Proposta no ar</p>
          <p className="mt-1 text-sm">
            Jogue o link no grupo. Quando bater {event.quorum} confirmados, o rolê vira oficial.
          </p>
          <div className="mt-3">
            <ShareButton event={event} />
          </div>
        </div>
      )}

      <Ticket
        night
        top={
          <div className="px-5 pb-7 pt-5">
            <div className="flex items-center justify-between gap-3">
              <span className="eyebrow !text-white/55">Ordem nº {event.code}</span>
              <StatusTag status={event.status} onDark />
            </div>
            <h1 className="mt-4 text-[3.25rem]">{event.title}</h1>
            <p className="mt-3 flex items-center gap-1.5 text-lg font-bold text-sol">
              <IconPin size={18} /> {event.destination}
            </p>
            <p className="mt-0.5 text-white/75">
              {formatEventDates(event.startDate, event.endDate)}
            </p>
          </div>
        }
        bottom={
          <div className="relative space-y-3 px-5 pb-5 pt-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Andorinhas</p>
                <p className="font-display mt-0.5 text-[2.25rem] font-extrabold leading-none">
                  {event.confirmedCount}
                  <span className="text-muted"> / {event.quorum}</span>
                </p>
              </div>
              {event.status === 'confirmed' && (
                <div className="pr-1">
                  <Stamp slam size="md">
                    Confirmado
                  </Stamp>
                </div>
              )}
              {event.status === 'open' && (
                <p className="flex items-center gap-1 text-sm font-bold text-sol-ink">
                  <IconClock size={15} /> <Countdown until={event.responseDeadlineAt} />
                </p>
              )}
            </div>
            <SwallowMeter confirmed={event.confirmedCount} quorum={event.quorum} size={40} />
            {headline && <p className="text-sm text-muted">{headline}</p>}
            {confirmed.length > 0 && (
              <div className="flex items-center gap-3 pt-1">
                <AvatarStack users={confirmed} />
                <span className="text-sm text-muted">
                  {confirmed
                    .map((c) => c.name.split(' ')[0])
                    .slice(0, 3)
                    .join(', ')}
                  {confirmed.length > 3 ? '…' : ''}
                </span>
              </div>
            )}
          </div>
        }
      />

      <dl className="card grid grid-cols-2 divide-x divide-line">
        <div className="p-4">
          <dt className="eyebrow">Custo estimado</dt>
          <dd className="mono mt-1 text-2xl font-semibold">{formatBRL(event.costCapCents)}</dd>
          <dd className="text-xs text-muted">por pessoa (teto)</dd>
        </div>
        <div className="p-4">
          <dt className="eyebrow">Quem lançou</dt>
          <dd className="mt-1 text-xl font-extrabold">{event.organizer.name}</dd>
          {event.requiresDeposit && event.depositCents && (
            <dd className="text-xs font-bold text-carimbo-dark">
              Sinal de {formatBRL(event.depositCents)} no Pix
            </dd>
          )}
        </div>
      </dl>

      {live && !joined && (
        <div className="space-y-3">
          <Button size="lg" block loading={respond.isPending} onClick={join}>
            Tô dentro
          </Button>
          {!passed && (
            <Button
              variant="ghost"
              block
              onClick={() => (loggedIn ? respond.mutate({ response: 'out' }) : join())}
            >
              Passo dessa vez
            </Button>
          )}
          {passed && (
            <p className="text-center text-sm text-muted">
              Você passou. Mudou de ideia? É só entrar.
            </p>
          )}
          {!loggedIn && (
            <p className="text-center text-sm text-muted">
              Você cria sua conta com o celular em 20 segundos.
            </p>
          )}
        </div>
      )}

      {joined && me && (
        <div className="space-y-4">
          <div className="rounded-[14px] bg-ok-soft p-4 text-ok">
            <p className="font-display text-2xl font-extrabold uppercase">Você está dentro</p>
            {event.requiresDeposit && me.depositStatus === 'pending' && (
              <p className="mt-1 text-sm">
                Falta o sinal para garantir sua vaga. Abra o QG para pagar.
              </p>
            )}
          </div>
          <Link
            to={`/role/${event.id}`}
            className="key inline-flex min-h-14 w-full items-center justify-center rounded-[10px] bg-sol px-6 text-lg font-bold text-on-sol [--key-edge:var(--color-sol-dark)] hover:brightness-105"
          >
            Abrir o QG do rolê
          </Link>

          <div className="card p-4">
            <p className="eyebrow">Seu perfil neste rolê</p>
            <p className="mb-1 mt-1 text-sm text-muted">
              Define só o que você paga no rateio. Dá para mudar até a conta fechar.
            </p>
            <Toggle
              label="Eu bebo álcool"
              icon={<IconBeer size={18} />}
              checked={me.drinksAlcohol}
              disabled={prefs.isPending}
              onChange={(v) => prefs.mutate({ drinksAlcohol: v, diet: me.diet })}
            />
            <Toggle
              label="Sou vegetariano(a)"
              icon={<IconLeaf size={18} />}
              checked={me.diet === 'vegetarian'}
              disabled={prefs.isPending}
              onChange={(v) =>
                prefs.mutate({
                  drinksAlcohol: me.drinksAlcohol,
                  diet: v ? 'vegetarian' : 'omnivore',
                })
              }
            />
          </div>

          <ShareButton event={event} size="md" />
          {!me.isOrganizer && live && (
            <Button
              variant="ghost"
              block
              loading={respond.isPending}
              onClick={() => respond.mutate({ response: 'out' })}
            >
              Mudei de ideia, passo
            </Button>
          )}
        </div>
      )}

      {!live && (
        <p className="card p-4 text-center font-bold text-muted">
          {event.status === 'archived' &&
            `Esta proposta não chegou a ${event.quorum} confirmações a tempo.`}
          {event.status === 'cancelled' && 'Este rolê foi cancelado.'}
          {event.status === 'closed' && 'Este rolê já aconteceu e a conta foi fechada.'}
        </p>
      )}

      <section className="px-1 text-sm text-muted">
        <button
          type="button"
          className="font-bold text-navy-dark"
          onClick={() => setShowWhy((v) => !v)}
          aria-expanded={showWhy}
        >
          Como funciona {showWhy ? '▾' : '▸'}
        </button>
        {showWhy && (
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Com {event.quorum} confirmados, o rolê vira oficial. Ninguém precisa esperar o grupo
              inteiro.
            </li>
            <li>Se tiver sinal, a vaga só é sua depois do Pix e do comprovante.</li>
            <li>O app não mexe no seu dinheiro: o Pix é direto entre as pessoas.</li>
            <li>No fim, o Tesoureiro fecha a conta e cada um vê só o seu saldo.</li>
          </ul>
        )}
        {event.status === 'open' && (
          <p className="mt-3">Prazo para responder: {formatDateTime(event.responseDeadlineAt)}.</p>
        )}
      </section>
    </div>
  );
}
