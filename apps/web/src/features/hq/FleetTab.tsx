import type { EventDetail, FleetDto, VehicleDto } from '@role/contracts';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { IconBox, IconCar, IconClock, IconPin, IconPlus, IconTrash } from '../../components/icons';
import { Avatar, EmptyState, ErrorState, Field, Skeleton } from '../../components/misc';
import { Sheet } from '../../components/Sheet';
import { api } from '../../lib/api';
import { eventKeys, useAction, useFleet, useSession } from '../../lib/queries';
import { TransportCard } from './TransportCard';

/** Aba Frotas & Caronas: carros, lugares estilo mapa de avião e bagagem por veículo. */
export function FleetTab({ detail }: { detail: EventDetail }) {
  const { event, me, deposit } = detail;
  const { data, isPending, isError, refetch } = useFleet(event.id);
  const [editing, setEditing] = useState<VehicleDto | 'new' | null>(null);
  const meId = useSession().data?.profile?.id;
  const invalidate = eventKeys(event.id, event.code);

  const active = event.status === 'confirmed';
  const canManage = me.can['fleet.edit'] && active;
  const canJoin = me.can['fleet.join'] && active;
  const seatLocked = !!deposit.openedAt && me.depositStatus !== 'approved';

  const join = useAction((id: string) => api.post(`/vehicles/${id}/join`), {
    invalidate,
    success: 'Lugar garantido',
  });
  const leave = useAction((id: string) => api.post(`/vehicles/${id}/leave`), {
    invalidate,
    success: 'Você saiu do carro',
  });
  const remove = useAction(
    (v: { id: string; userId: string }) =>
      api.post(`/vehicles/${v.id}/remove`, { userId: v.userId }),
    { invalidate },
  );
  const assign = useAction(
    (v: { id: string; userId: string }) =>
      api.post(`/vehicles/${v.id}/assign`, { userId: v.userId }),
    {
      invalidate,
      success: 'Passageiro alocado',
    },
  );
  const dropVehicle = useAction((id: string) => api.delete(`/vehicles/${id}`), {
    invalidate,
    success: 'Carro removido',
  });

  if (isPending) return <Skeleton rows={3} />;
  if (isError)
    return <ErrorState message="Não consegui carregar os carros." onRetry={() => void refetch()} />;

  const { vehicles, seatless, unassignedCargo, myVehicleId, iAmDriver } = data;

  return (
    <>
      <TransportCard detail={detail} />
      <section className="card space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2>Frotas</h2>
            <p className="mt-1 text-sm text-muted">
              Quem vai com quem, sem descobrir na hora da saída que não cabe.
            </p>
          </div>
          {canJoin && !iAmDriver && (
            <Button size="sm" onClick={() => setEditing('new')}>
              <IconPlus size={16} /> Meu carro
            </Button>
          )}
        </div>
        {seatLocked && canJoin && (
          <p className="rounded-[10px] bg-sol-soft p-3 text-sm font-bold text-sol-ink">
            Pague o sinal para escolher seu lugar. Quem está com o sinal aprovado reserva primeiro.
          </p>
        )}
      </section>

      {vehicles.length === 0 && (
        <EmptyState emoji="🚗" title="Nenhum carro cadastrado">
          Quem vai dirigir cadastra o carro com horário, lugares livres e o que cabe no porta-malas.
        </EmptyState>
      )}

      {vehicles.map((v) => {
        const mine = v.id === myVehicleId;
        const iDrive = v.driver.id === meId;
        return (
          <article key={v.id} className={`card space-y-4 p-4 ${mine ? 'border-navy' : ''}`}>
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-[1.6rem] font-extrabold uppercase leading-none">
                  {v.label}
                </h3>
                <p className="mt-1.5 flex items-center gap-2 text-sm text-muted">
                  <Avatar user={v.driver} size={22} /> {v.driver.name} dirige
                </p>
              </div>
              {(iDrive || canManage) && (
                <div className="flex gap-0.5">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(v)}>
                    Editar
                  </Button>
                  <button
                    type="button"
                    aria-label={`Remover ${v.label}`}
                    className="grid size-9 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                    onClick={() => dropVehicle.mutate(v.id)}
                  >
                    <IconTrash size={17} />
                  </button>
                </div>
              )}
            </header>

            {(v.departurePlace || v.departureTime) && (
              <p className="mono flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                {v.departurePlace && (
                  <span className="inline-flex items-center gap-1.5">
                    <IconPin size={15} /> {v.departurePlace}
                  </span>
                )}
                {v.departureTime && (
                  <span className="inline-flex items-center gap-1.5">
                    <IconClock size={15} /> {v.departureTime}
                  </span>
                )}
              </p>
            )}

            <SeatMap
              vehicle={v}
              manage={canManage || iDrive}
              onRemove={(userId) => remove.mutate({ id: v.id, userId })}
            />

            <div className="rounded-[10px] bg-desk-deep p-3">
              <p
                className={`flex items-center gap-1.5 text-sm font-bold ${v.overloaded ? 'text-warn' : ''}`}
              >
                <IconBox size={16} /> Bagagem {v.cargo.length}/{v.cargoCapacity}
                {v.overloaded && ' · passou do que cabe'}
              </p>
              {v.cargoNote && <p className="mt-0.5 text-xs text-muted">{v.cargoNote}</p>}
              {v.cargo.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {v.cargo.map((c) => (
                    <CargoChip
                      key={c.id}
                      id={c.id}
                      name={c.name}
                      manage={canManage}
                      invalidate={invalidate}
                    />
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {canJoin && !mine && v.freeSeats > 0 && !iAmDriver && (
                <Button
                  size="sm"
                  disabled={seatLocked}
                  loading={join.isPending && join.variables === v.id}
                  onClick={() => join.mutate(v.id)}
                >
                  {myVehicleId ? 'Trocar para este carro' : 'Pegar carona'}
                </Button>
              )}
              {mine && !iAmDriver && (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={leave.isPending}
                  onClick={() => leave.mutate(v.id)}
                >
                  Sair do carro
                </Button>
              )}
              {canManage && seatless.length > 0 && v.freeSeats > 0 && (
                <AssignPicker
                  seatless={seatless}
                  onAssign={(userId) => assign.mutate({ id: v.id, userId })}
                />
              )}
            </div>
          </article>
        );
      })}

      {seatless.length > 0 && vehicles.length > 0 && (
        <section className="card p-4">
          <h3 className="eyebrow !text-ink">Ainda sem lugar ({seatless.length})</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {seatless.map((u) => (
              <li
                key={u.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-desk-deep py-1 pl-1 pr-3 text-sm font-bold"
              >
                <Avatar user={u} size={24} /> {u.name.split(' ')[0]}
              </li>
            ))}
          </ul>
        </section>
      )}

      {canManage && (
        <CargoPanel
          eventId={event.id}
          invalidate={invalidate}
          unassigned={unassignedCargo}
          vehicles={vehicles}
        />
      )}

      <Sheet
        open={editing !== null}
        title={editing === 'new' ? 'Cadastrar meu carro' : 'Editar carro'}
        onClose={() => setEditing(null)}
      >
        {editing !== null && (
          <VehicleForm
            eventId={event.id}
            code={event.code}
            vehicle={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
    </>
  );
}

/** Lugares como mapa de avião: ocupado = avatar, livre = tracejado. */
function SeatMap({
  vehicle,
  manage,
  onRemove,
}: {
  vehicle: VehicleDto;
  manage: boolean;
  onRemove: (userId: string) => void;
}) {
  return (
    <div>
      <p className="eyebrow mb-2">
        Lugares · {vehicle.seats - vehicle.freeSeats}/{vehicle.seats}
      </p>
      <ul className="flex flex-wrap gap-2.5">
        <li
          className="flex flex-col items-center gap-1"
          title={`${vehicle.driver.name} (motorista)`}
        >
          <span className="grid size-11 place-items-center rounded-xl bg-night text-white">
            <IconCar size={20} />
          </span>
          <span className="text-[11px] font-bold">Motorista</span>
        </li>
        {Array.from({ length: vehicle.driverCompanions }, (_, i) => (
          <li key={`driver-companion-${i}`} className="flex flex-col items-center gap-1">
            <span
              className="grid size-11 place-items-center rounded-xl bg-navy-soft text-xs font-extrabold text-navy-dark"
              title={`Acompanhante de ${vehicle.driver.name}`}
            >
              +1
            </span>
            <span className="text-[11px] text-muted">Acomp.</span>
          </li>
        ))}
        {vehicle.passengers.flatMap((p) => [
          <li key={p.id} className="flex flex-col items-center gap-1">
            <button
              type="button"
              disabled={!manage}
              onClick={() => manage && onRemove(p.id)}
              aria-label={manage ? `Tirar ${p.name} do carro` : p.name}
              title={manage ? `Tirar ${p.name}` : p.name}
              className="relative"
            >
              <Avatar user={p} size={44} />
            </button>
            <span className="max-w-14 truncate text-[11px] font-bold">{p.name.split(' ')[0]}</span>
          </li>,
          ...Array.from({ length: p.companions }, (_, k) => (
            <li key={`${p.id}-companion-${k}`} className="flex flex-col items-center gap-1">
              <span className="grid size-11 place-items-center rounded-xl bg-navy-soft text-xs font-extrabold text-navy-dark">
                +1
              </span>
              <span className="text-[11px] text-muted">Acomp.</span>
            </li>
          )),
        ])}
        {Array.from({ length: vehicle.freeSeats }, (_, i) => (
          <li key={`free-${i}`} className="flex flex-col items-center gap-1">
            <span
              className="size-11 rounded-xl border-2 border-dashed border-line"
              aria-label="Lugar livre"
            />
            <span className="text-[11px] text-muted">Livre</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssignPicker({
  seatless,
  onAssign,
}: {
  seatless: FleetDto['seatless'];
  onAssign: (userId: string) => void;
}) {
  const [userId, setUserId] = useState('');
  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        className="field !w-auto !py-1.5 text-sm"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        aria-label="Alocar pessoa neste carro"
      >
        <option value="">Alocar…</option>
        {seatless.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        variant="soft"
        disabled={!userId}
        onClick={() => {
          onAssign(userId);
          setUserId('');
        }}
      >
        Alocar
      </Button>
    </span>
  );
}

function CargoChip({
  id,
  name,
  manage,
  invalidate,
}: {
  id: string;
  name: string;
  manage: boolean;
  invalidate: ReturnType<typeof eventKeys>;
}) {
  const move = useAction((vehicleId: string | null) => api.patch(`/cargo/${id}`, { vehicleId }), {
    invalidate,
  });
  const del = useAction(() => api.delete(`/cargo/${id}`), { invalidate });
  return (
    <li className="inline-flex items-center gap-1 rounded-full bg-surface py-1 pl-3 pr-1.5 text-sm font-bold ring-1 ring-line">
      {name}
      {manage && (
        <>
          <button
            type="button"
            className="rounded-full px-1.5 text-xs text-muted hover:bg-desk-deep"
            onClick={() => move.mutate(null)}
            aria-label={`Desalocar ${name}`}
            title="Desalocar"
          >
            ↩
          </button>
          <button
            type="button"
            className="grid size-6 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger"
            onClick={() => del.mutate(undefined)}
            aria-label={`Remover ${name}`}
          >
            <IconTrash size={13} />
          </button>
        </>
      )}
    </li>
  );
}

function CargoPanel({
  eventId,
  invalidate,
  unassigned,
  vehicles,
}: {
  eventId: string;
  invalidate: ReturnType<typeof eventKeys>;
  unassigned: FleetDto['unassignedCargo'];
  vehicles: VehicleDto[];
}) {
  const [name, setName] = useState('');
  const add = useAction(() => api.post(`/events/${eventId}/cargo`, { name: name.trim() }), {
    invalidate,
    success: 'Item de bagagem adicionado',
    onSuccess: () => setName(''),
  });
  const move = useAction(
    (v: { id: string; vehicleId: string }) =>
      api.patch(`/cargo/${v.id}`, { vehicleId: v.vehicleId }),
    { invalidate },
  );

  return (
    <section className="card space-y-3 p-4">
      <div>
        <h3 className="eyebrow !text-ink">Tralhas do General da Frota</h3>
        <p className="mt-1 text-sm text-muted">
          Cooler, guarda-sol, caixa de som: cada item vai para um carro.
        </p>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim().length >= 2) add.mutate(undefined);
        }}
      >
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Cooler grande"
          maxLength={60}
          aria-label="Nome do item de bagagem"
        />
        <Button
          type="submit"
          variant="soft"
          loading={add.isPending}
          disabled={name.trim().length < 2}
        >
          Adicionar
        </Button>
      </form>
      {unassigned.length > 0 && (
        <ul className="divide-y divide-line">
          {unassigned.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2">
              <span className="font-bold">{c.name}</span>
              <select
                className="field !w-auto !py-1.5 text-sm"
                value=""
                onChange={(e) =>
                  e.target.value && move.mutate({ id: c.id, vehicleId: e.target.value })
                }
                aria-label={`Escolher carro para ${c.name}`}
              >
                <option value="">Sem carro</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function VehicleForm({
  eventId,
  code,
  vehicle,
  onDone,
}: {
  eventId: string;
  code: string;
  vehicle: VehicleDto | null;
  onDone: () => void;
}) {
  const [label, setLabel] = useState(vehicle?.label ?? '');
  const [seats, setSeats] = useState(vehicle?.seats ?? 3);
  const [cargo, setCargo] = useState(vehicle?.cargoCapacity ?? 2);
  const [place, setPlace] = useState(vehicle?.departurePlace ?? '');
  const [time, setTime] = useState(vehicle?.departureTime ?? '');
  const [note, setNote] = useState(vehicle?.cargoNote ?? '');

  const save = useAction(
    () => {
      const body = {
        label: label.trim(),
        seats,
        cargoCapacity: cargo,
        departurePlace: place.trim() || null,
        departureTime: time || null,
        cargoNote: note.trim() || null,
      };
      return vehicle
        ? api.patch(`/vehicles/${vehicle.id}`, body)
        : api.post(`/events/${eventId}/vehicles`, body);
    },
    {
      invalidate: eventKeys(eventId, code),
      success: vehicle ? 'Carro atualizado' : 'Carro cadastrado',
      onSuccess: onDone,
    },
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate(undefined);
  }

  const stepper = (
    value: number,
    set: (n: number) => void,
    min: number,
    max: number,
    label: string,
  ) => (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className="grid size-11 place-items-center rounded-[10px] border-[1.5px] border-line text-xl font-bold"
        aria-label={`Menos ${label}`}
        onClick={() => set(Math.max(min, value - 1))}
      >
        −
      </button>
      <span className="mono w-8 text-center text-xl font-semibold">{value}</span>
      <button
        type="button"
        className="grid size-11 place-items-center rounded-[10px] border-[1.5px] border-line text-xl font-bold"
        aria-label={`Mais ${label}`}
        onClick={() => set(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nome do carro">
        <input
          className="field"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Gol da Bia"
          maxLength={60}
          autoFocus
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Lugares livres">{stepper(seats, setSeats, 0, 12, 'lugares')}</Field>
        <Field label="Itens grandes que cabem">{stepper(cargo, setCargo, 0, 20, 'itens')}</Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Saída de">
          <input
            className="field"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="Pinheiros"
            maxLength={80}
          />
        </Field>
        <Field label="Horário">
          <input
            className="field"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </Field>
      </div>
      <Field label="O que cabe (opcional)" hint="Ex.: 1 cooler grande e 4 mochilas.">
        <input
          className="field"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={120}
        />
      </Field>
      <Button type="submit" block loading={save.isPending} disabled={label.trim().length < 2}>
        Salvar carro
      </Button>
    </form>
  );
}
