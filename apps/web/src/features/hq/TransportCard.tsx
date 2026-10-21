import type { QueryKey } from '@tanstack/react-query';
import type { EventDetail, StopDto } from '@role/contracts';
import { STOP_KIND_LABELS, STOP_KINDS, type StopKind } from '@role/domain';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { IconEdit, IconPlus, IconTrash } from '../../components/icons';
import { Field, MoneyInput, Skeleton } from '../../components/misc';
import { Sheet } from '../../components/Sheet';
import { api } from '../../lib/api';
import { formatBRL } from '../../lib/format';
import { keys, useAction, useTransport } from '../../lib/queries';
import { StopsTimeline } from './panel/parts';

type PlanChoice = 'seat' | 'app' | 'own';

/**
 * Transporte do rolê: pontos de encontro e paradas (o General da Frota monta) e o "como eu vou" de
 * cada um (carro, app de carona ou por conta própria). O valor da corrida é só informativo.
 */
export function TransportCard({ detail }: { detail: EventDetail }) {
  const { event, me } = detail;
  const { data, isPending } = useTransport(event.id);
  const [editing, setEditing] = useState<StopDto | 'new' | null>(null);
  const invalidate = [keys.transport(event.id), keys.panel(event.id), keys.fleet(event.id)];

  const drop = useAction((id: string) => api.delete(`/stops/${id}`), {
    invalidate,
    success: 'Ponto removido',
  });

  if (isPending || !data) return <Skeleton rows={1} />;
  const showPlan = me.can['fleet.join'] && event.status === 'confirmed';
  if (!data.canEdit && data.stops.length === 0 && !showPlan) return null;

  return (
    <section className="card space-y-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2>Pontos e transporte</h2>
          <p className="mt-1 text-sm text-muted">
            Onde encontrar, onde parar e quem vai de app, tudo num lugar só.
          </p>
        </div>
        {data.canEdit && (
          <Button size="sm" variant="soft" onClick={() => setEditing('new')}>
            <IconPlus size={16} /> Ponto
          </Button>
        )}
      </div>

      {data.stops.length === 0 ? (
        <p className="text-sm text-muted">
          {data.canEdit
            ? 'Cadastre o ponto de encontro, as paradas e o local para chamar o app.'
            : 'O General da Frota ainda não cadastrou os pontos de encontro.'}
        </p>
      ) : data.canEdit ? (
        <ul className="space-y-2">
          {data.stops.map((s) => (
            <li key={s.id} className="flex items-start gap-2 rounded-xl bg-desk-deep p-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 font-bold">
                  {s.time && <span className="mono text-sm">{s.time}</span>}
                  {s.name}
                </p>
                <p className="text-xs text-muted">
                  {STOP_KIND_LABELS[s.kind]}
                  {s.address && ` · ${s.address}`}
                </p>
                {s.note && <p className="mt-0.5 text-sm">{s.note}</p>}
              </div>
              <button
                type="button"
                aria-label={`Editar ${s.name}`}
                className="grid size-9 place-items-center rounded-lg text-muted hover:bg-navy-soft"
                onClick={() => setEditing(s)}
              >
                <IconEdit size={17} />
              </button>
              <button
                type="button"
                aria-label={`Remover ${s.name}`}
                className="grid size-9 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                onClick={() => drop.mutate(s.id)}
              >
                <IconTrash size={17} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <StopsTimeline stops={data.stops} />
      )}

      {showPlan && <RidePlan eventId={event.id} data={data} invalidate={invalidate} />}

      {(data.appRiders.length > 0 || data.ownRiders.length > 0) && (
        <div className="space-y-1 text-sm text-muted">
          {data.appRiders.length > 0 && (
            <p>
              De app (Uber, 99, táxi):{' '}
              <strong className="text-ink">
                {data.appRiders.map((u) => u.name.split(' ')[0]).join(', ')}
              </strong>
            </p>
          )}
          {data.ownRiders.length > 0 && (
            <p>
              Por conta própria:{' '}
              <strong className="text-ink">
                {data.ownRiders.map((u) => u.name.split(' ')[0]).join(', ')}
              </strong>
            </p>
          )}
        </div>
      )}

      <Sheet
        open={editing !== null}
        title={editing === 'new' ? 'Novo ponto' : 'Editar ponto'}
        onClose={() => setEditing(null)}
      >
        {editing !== null && (
          <StopForm
            eventId={event.id}
            stop={editing === 'new' ? null : editing}
            invalidate={invalidate}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
    </section>
  );
}

function RidePlan({
  eventId,
  data,
  invalidate,
}: {
  eventId: string;
  data: NonNullable<ReturnType<typeof useTransport>['data']>;
  invalidate: QueryKey[];
}) {
  const seated = data.myRide === 'driver' || data.myRide === 'passenger';
  const current: PlanChoice = data.myPlan?.mode ?? 'seat';
  const [choice, setChoice] = useState<PlanChoice>(current);
  const [est, setEst] = useState<number | null>(data.myPlan?.estCents ?? null);

  const save = useAction(
    () =>
      api.put(`/events/${eventId}/ride-plan`, {
        mode: choice === 'seat' ? null : choice,
        ...(choice === 'app' ? { estCents: est } : {}),
      }),
    { invalidate, success: 'Salvo' },
  );

  if (seated) {
    return (
      <p className="rounded-xl bg-ok-soft p-3 text-sm font-bold text-ok">
        {data.myRide === 'driver' ? 'Você dirige um dos carros.' : 'Você tem lugar em um carro.'}
      </p>
    );
  }

  const options: { value: PlanChoice; label: string; hint: string }[] = [
    { value: 'seat', label: 'Quero lugar em um carro', hint: 'Escolha o carro na lista abaixo.' },
    { value: 'app', label: 'Vou de app', hint: 'Uber, 99 ou táxi, cada um por si.' },
    { value: 'own', label: 'Vou por conta própria', hint: 'Meu carro, moto ou outro jeito.' },
  ];

  return (
    <div className="space-y-3 border-t border-line pt-4">
      <h3 className="text-base">Como eu vou</h3>
      <div className="space-y-2" role="radiogroup" aria-label="Como você vai">
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 ${choice === o.value ? 'border-navy bg-navy-soft/50' : 'border-line'}`}
          >
            <input
              type="radio"
              name="ride"
              className="mt-1 size-4 accent-navy"
              checked={choice === o.value}
              onChange={() => setChoice(o.value)}
            />
            <span>
              <span className="block font-bold">{o.label}</span>
              <span className="text-sm text-muted">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
      {choice === 'app' && (
        <Field
          label="Estimativa da corrida (opcional)"
          hint="Só para o General da Frota ter uma ideia. Não entra no rateio."
        >
          <MoneyInput value={est} onChange={setEst} placeholder="45,00" />
        </Field>
      )}
      <Button size="sm" loading={save.isPending} onClick={() => save.mutate(undefined)}>
        Salvar
      </Button>
      {data.myPlan?.mode === 'app' && data.myPlan.estCents ? (
        <p className="text-xs text-muted">Sua estimativa: {formatBRL(data.myPlan.estCents)}.</p>
      ) : null}
    </div>
  );
}

function StopForm({
  eventId,
  stop,
  invalidate,
  onDone,
}: {
  eventId: string;
  stop: StopDto | null;
  invalidate: QueryKey[];
  onDone: () => void;
}) {
  const [kind, setKind] = useState<StopKind>(stop?.kind ?? 'meeting');
  const [name, setName] = useState(stop?.name ?? '');
  const [time, setTime] = useState(stop?.time ?? '');
  const [address, setAddress] = useState(stop?.address ?? '');
  const [note, setNote] = useState(stop?.note ?? '');

  const save = useAction(
    () => {
      const body = {
        kind,
        name: name.trim(),
        time: time || null,
        address: address.trim() || null,
        note: note.trim() || null,
      };
      return stop
        ? api.patch(`/stops/${stop.id}`, body)
        : api.post(`/events/${eventId}/stops`, body);
    },
    {
      invalidate,
      success: stop ? 'Ponto atualizado' : 'Ponto criado. A turma foi avisada.',
      onSuccess: onDone,
    },
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length >= 2) save.mutate(undefined);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Tipo">
        <select
          className="field"
          value={kind}
          onChange={(e) => setKind(e.target.value as StopKind)}
        >
          {STOP_KINDS.map((k) => (
            <option key={k} value={k}>
              {STOP_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Nome do ponto">
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Posto Ipiranga da Marginal"
          maxLength={60}
          autoFocus
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Horário (opcional)">
          <input
            className="field"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </Field>
        <Field label="Endereço (opcional)">
          <input
            className="field"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Av. Brasil, 100"
            maxLength={160}
          />
        </Field>
      </div>
      <Field label="Observação (opcional)">
        <input
          className="field"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Quem chegar antes espera no café"
          maxLength={160}
        />
      </Field>
      <Button type="submit" block loading={save.isPending} disabled={name.trim().length < 2}>
        Salvar ponto
      </Button>
    </form>
  );
}
