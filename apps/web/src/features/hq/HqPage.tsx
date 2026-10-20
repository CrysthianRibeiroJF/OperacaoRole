import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  IconArrowLeft,
  IconBell,
  IconBellOff,
  IconClock,
  IconHome,
  IconMedal,
  IconPin,
  IconWallet,
} from '../../components/icons';
import { Countdown, ErrorState, Spinner } from '../../components/misc';
import { api, ApiError } from '../../lib/api';
import { formatEventDates } from '../../lib/format';
import { useAction, useEventDetail } from '../../lib/queries';
import { StatusTag } from '../events/shared';
import { BaseTab } from './BaseTab';
import { TeamTab } from './TeamTab';
import { VaultTab } from './VaultTab';

const TABS: { key: string; label: string; icon: ReactNode }[] = [
  { key: 'base', label: 'Base', icon: <IconHome size={18} /> },
  { key: 'equipe', label: 'Equipe', icon: <IconMedal size={18} /> },
  { key: 'cofre', label: 'Cofre', icon: <IconWallet size={18} /> },
];

/** Quartel-General do Rolê: o dashboard de quem confirmou presença. */
export function HqPage() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { data, isPending, error, refetch } = useEventDetail(id);

  const mute = useQuery({
    queryKey: ['mute', id],
    queryFn: () => api.get<{ muted: boolean }>(`/events/${id}/mute`),
    enabled: !!data,
  });
  const toggleMute = useAction((muted: boolean) => api.put(`/events/${id}/mute`, { muted }), {
    invalidate: [['mute', id]],
  });

  if (isPending) return <Spinner />;
  if (error) {
    const forbidden = error instanceof ApiError && error.status === 403;
    return (
      <div className="space-y-4">
        <ErrorState
          message={
            forbidden
              ? 'Confirme presença no convite para entrar no QG deste rolê.'
              : 'Não consegui abrir o QG do rolê.'
          }
          {...(forbidden ? {} : { onRetry: () => void refetch() })}
        />
        <Link to="/" className="block text-center font-bold text-navy-dark">
          Voltar para meus rolês
        </Link>
      </div>
    );
  }

  const { event } = data;
  const tab = TABS.some((t) => t.key === params.get('aba')) ? params.get('aba')! : 'base';
  const muted = mute.data?.muted ?? false;

  return (
    <div className="space-y-4">
      <header className="-mx-4 -mt-6 rounded-b-[28px] bg-night px-5 pb-7 pt-5 text-white">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-white/75 hover:text-white"
          >
            <IconArrowLeft size={16} /> Meus rolês
          </Link>
          <button
            type="button"
            aria-pressed={muted}
            onClick={() => toggleMute.mutate(!muted)}
            title={muted ? 'Reativar avisos deste rolê' : 'Silenciar avisos deste rolê'}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-bold text-white/75 hover:bg-white/10 hover:text-white"
          >
            {muted ? <IconBellOff size={17} /> : <IconBell size={17} />}
            {muted ? 'Silenciado' : 'Avisos'}
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="eyebrow !text-white/55">Ordem nº {event.code}</span>
          <StatusTag status={event.status} onDark />
        </div>
        <h1 className="mt-3 text-[3rem]">{event.title}</h1>
        <p className="mt-3 flex items-center gap-1.5 font-bold text-sol">
          <IconPin size={17} /> {event.destination}
        </p>
        <p className="mt-0.5 text-white/75">{formatEventDates(event.startDate, event.endDate)}</p>

        {event.status === 'open' && (
          <p className="mt-4 flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-bold">
            <IconClock size={15} /> {event.confirmedCount}/{event.quorum} confirmados ·{' '}
            <Countdown until={event.responseDeadlineAt} />
          </p>
        )}
        {event.belowQuorum && (
          <p className="mt-4 rounded-lg bg-sol px-3 py-2 text-sm font-bold text-on-sol">
            O rolê segue confirmado, mas está abaixo do mínimo ({event.confirmedCount}/
            {event.quorum}). Chame mais gente.
          </p>
        )}
      </header>

      <div
        role="tablist"
        aria-label="Seções do QG"
        className="sticky top-0 z-30 -mx-4 bg-desk/90 px-4 py-2 backdrop-blur"
      >
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls={`panel-${t.key}`}
              onClick={() => setParams({ aba: t.key }, { replace: true })}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-[9px] px-2 text-sm font-extrabold transition-colors ${
                tab === t.key ? 'bg-ink text-surface' : 'text-muted hover:bg-desk-deep'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="space-y-4">
        {tab === 'base' && <BaseTab detail={data} />}
        {tab === 'equipe' && <TeamTab detail={data} />}
        {tab === 'cofre' && <VaultTab detail={data} />}
      </div>
    </div>
  );
}
