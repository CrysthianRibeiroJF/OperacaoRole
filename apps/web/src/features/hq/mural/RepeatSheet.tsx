import type { EventCard, EventDetail } from '@role/contracts';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/Button';
import { ForecastStrip } from '../../../components/ForecastStrip';
import { Field } from '../../../components/misc';
import { Sheet } from '../../../components/Sheet';
import { api } from '../../../lib/api';
import { keys, useAction, useCrews } from '../../../lib/queries';

const today = () => new Date().toISOString().slice(0, 10);

/** "Repetir esse rolê": proposta nova com valor, quórum, lista de compras, quartos e Base já prontos. */
export function RepeatSheet({
  detail,
  open,
  onClose,
}: {
  detail: EventDetail;
  open: boolean;
  onClose: () => void;
}) {
  const { event } = detail;
  const navigate = useNavigate();
  const crews = useCrews();
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [crewId, setCrewId] = useState('');

  const repeat = useAction(
    () =>
      api.post<EventCard>(`/events/${event.id}/repeat`, {
        startDate,
        ...(endDate ? { endDate } : {}),
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(crewId ? { crewId } : {}),
      }),
    {
      invalidate: [keys.feed],
      success: 'Rolê novo lançado',
      onSuccess: (card) => {
        onClose();
        navigate(`/role/${card.id}`);
      },
    },
  );

  const valid = !!startDate && (!endDate || endDate >= startDate);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (valid) repeat.mutate(undefined);
  }

  return (
    <Sheet open={open} title="Repetir esse rolê" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">
          Nasce uma proposta nova em <strong className="text-ink">{event.destination}</strong>, com
          o mesmo valor, quórum, lista de compras, quartos e dados da Base. Cargos, carros, despesas
          e respostas começam do zero.
        </p>
        <Field label="Nome (opcional)" hint="Em branco, mantém o mesmo nome.">
          <input
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={event.title}
            maxLength={80}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nova data">
            <input
              className="field"
              type="date"
              min={today()}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </Field>
          <Field label="Volta (opcional)">
            <input
              className="field"
              type="date"
              min={startDate || today()}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        </div>
        <ForecastStrip
          destination={event.destination}
          startDate={startDate}
          endDate={endDate || null}
        />

        {crews.data && crews.data.length > 0 && (
          <Field
            label="Chamar uma tropa (opcional)"
            hint="Os membros recebem o aviso com o link do convite."
          >
            <select className="field" value={crewId} onChange={(e) => setCrewId(e.target.value)}>
              <option value="">Não chamar agora</option>
              {crews.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.members.length})
                </option>
              ))}
            </select>
          </Field>
        )}

        <Button type="submit" block loading={repeat.isPending} disabled={!valid}>
          Lançar rolê novo
        </Button>
      </form>
    </Sheet>
  );
}
