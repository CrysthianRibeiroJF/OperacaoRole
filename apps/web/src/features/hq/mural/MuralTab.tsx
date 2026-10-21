import type { EventDetail } from '@role/contracts';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/Button';
import { IconDownload, IconReceipt, IconUsers } from '../../../components/icons';
import { Field } from '../../../components/misc';
import { useToast } from '../../../components/Toast';
import { api } from '../../../lib/api';
import { useAction, useCrews } from '../../../lib/queries';
import { PackingCard } from './PackingCard';
import { PhotosCard } from './PhotosCard';
import { RepeatSheet } from './RepeatSheet';
import { TracksCard } from './TracksCard';

const link =
  'inline-flex min-h-9 items-center gap-1.5 rounded-[10px] bg-navy-soft px-3 text-sm font-bold text-navy-dark hover:brightness-95';

/** Aba Mural: tudo que dá vida ao rolê além da logística (agenda, relatório, fotos, bagagem e trilha). */
export function MuralTab({ detail }: { detail: EventDetail }) {
  const { event, me } = detail;
  const [repeating, setRepeating] = useState(false);
  const reportReady = event.status === 'confirmed' || event.status === 'closed';
  const calendarReady = event.status !== 'cancelled' && event.status !== 'archived';

  return (
    <>
      <section className="card space-y-3 p-5">
        <h2>Atalhos do rolê</h2>
        <div className="flex flex-wrap gap-2">
          {calendarReady && (
            <a href={`/api/events/${event.id}/calendar.ics`} download className={link}>
              <IconDownload size={16} /> Salvar na agenda
            </a>
          )}
          {reportReady && (
            <Link to={`/role/${event.id}/relatorio`} className={link}>
              <IconReceipt size={16} /> Relatório de Missão
            </Link>
          )}
          {me.isOrganizer && event.status !== 'cancelled' && (
            <Button size="sm" variant="soft" onClick={() => setRepeating(true)}>
              Repetir esse rolê
            </Button>
          )}
        </div>
        {calendarReady && (
          <p className="text-xs text-muted">
            A agenda avisa um dia antes. Abra o arquivo no celular para adicionar ao calendário.
          </p>
        )}
        {me.isOrganizer && (event.status === 'open' || event.status === 'confirmed') && (
          <CrewInvite eventId={event.id} />
        )}
      </section>

      <PhotosCard detail={detail} />
      <PackingCard detail={detail} />
      <TracksCard detail={detail} />

      {me.isOrganizer && (
        <RepeatSheet detail={detail} open={repeating} onClose={() => setRepeating(false)} />
      )}
    </>
  );
}

/** "Chamar a tropa": avisa, dentro do app, quem ainda não respondeu a esta proposta. */
function CrewInvite({ eventId }: { eventId: string }) {
  const crews = useCrews();
  const toast = useToast();
  const [crewId, setCrewId] = useState('');

  const invite = useAction(
    () => api.post<{ invited: number }>(`/events/${eventId}/invite-crew`, { crewId }),
    {
      onSuccess: ({ invited }) =>
        toast.ok(
          invited === 0
            ? 'Ninguém novo para avisar: a tropa toda já respondeu.'
            : `${invited} ${invited === 1 ? 'pessoa avisada' : 'pessoas avisadas'}`,
        ),
    },
  );

  if (!crews.data || crews.data.length === 0) {
    return (
      <p className="text-sm text-muted">
        <Link to="/tropas" className="font-bold text-navy-dark">
          Crie uma tropa
        </Link>{' '}
        para chamar a turma de uma vez.
      </p>
    );
  }
  return (
    <div className="space-y-2 border-t border-line pt-3">
      <Field label="Chamar uma tropa para este rolê">
        <select className="field" value={crewId} onChange={(e) => setCrewId(e.target.value)}>
          <option value="">Escolha a tropa</option>
          {crews.data.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.members.length})
            </option>
          ))}
        </select>
      </Field>
      <Button
        size="sm"
        variant="soft"
        loading={invite.isPending}
        disabled={!crewId}
        onClick={() => invite.mutate(undefined)}
      >
        <IconUsers size={16} /> Chamar a tropa
      </Button>
    </div>
  );
}
