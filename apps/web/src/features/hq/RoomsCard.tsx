import type { EventDetail, RoomDto, RoomsDto } from '@role/contracts';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { IconPlus, IconTrash } from '../../components/icons';
import { Avatar, Field, Skeleton } from '../../components/misc';
import { Sheet } from '../../components/Sheet';
import { api } from '../../lib/api';
import { eventKeys, useAction, useRooms } from '../../lib/queries';

/** Quartos da Base: camas como lugares marcados, com a trava do sinal valendo para escolher (RN-14). */
export function RoomsCard({ detail }: { detail: EventDetail }) {
  const { event, me, deposit } = detail;
  const { data, isPending } = useRooms(event.id);
  const [editing, setEditing] = useState<RoomDto | 'new' | null>(null);
  const invalidate = eventKeys(event.id, event.code);

  const active = event.status === 'confirmed';
  const canManage = me.can['rooms.edit'] && active;
  const canJoin = me.can['rooms.join'] && active;
  const locked = !!deposit.openedAt && me.depositStatus !== 'approved';

  const join = useAction((id: string) => api.post(`/rooms/${id}/join`), {
    invalidate,
    success: 'Cama garantida',
  });
  const leave = useAction((id: string) => api.post(`/rooms/${id}/leave`), {
    invalidate,
    success: 'Você saiu do quarto',
  });
  const assign = useAction(
    (v: { id: string; userId: string }) => api.post(`/rooms/${v.id}/assign`, { userId: v.userId }),
    {
      invalidate,
      success: 'Pessoa alocada',
    },
  );
  const remove = useAction(
    (v: { id: string; userId: string }) => api.post(`/rooms/${v.id}/remove`, { userId: v.userId }),
    { invalidate },
  );
  const drop = useAction((id: string) => api.delete(`/rooms/${id}`), {
    invalidate,
    success: 'Quarto removido',
  });

  // Sem quartos e sem quem monte: o cartão não ocupa espaço.
  if (!isPending && data && data.rooms.length === 0 && !canManage) return null;
  if (event.status === 'archived' || event.status === 'cancelled') return null;
  if (isPending || !data) return <Skeleton rows={1} />;

  const { rooms, unassigned, myRoomId } = data;

  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2>Quartos</h2>
          <p className="mt-1 text-sm text-muted">
            Cada um escolhe a sua cama, sem briga na chegada.
          </p>
        </div>
        {canManage && (
          <Button size="sm" variant="soft" onClick={() => setEditing('new')}>
            <IconPlus size={16} /> Quarto
          </Button>
        )}
      </div>

      {locked && canJoin && rooms.length > 0 && (
        <p className="rounded-[10px] bg-sol-soft p-3 text-sm font-bold text-sol-ink">
          Pague o sinal para escolher sua cama. Quem está com o sinal aprovado escolhe primeiro.
        </p>
      )}
      {rooms.length === 0 && (
        <p className="text-sm text-muted">
          Monte os quartos da casa com o número de camas de cada um.
        </p>
      )}

      <ul className="space-y-3">
        {rooms.map((r) => {
          const mine = r.id === myRoomId;
          return (
            <li
              key={r.id}
              className={`rounded-[12px] border p-3.5 ${mine ? 'border-navy bg-navy-soft/40' : 'border-line'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-[1.4rem] font-extrabold uppercase leading-none">
                  {r.name}
                </p>
                {canManage && (
                  <span className="flex gap-0.5">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                      Editar
                    </Button>
                    <button
                      type="button"
                      aria-label={`Remover ${r.name}`}
                      className="grid size-9 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                      onClick={() => drop.mutate(r.id)}
                    >
                      <IconTrash size={17} />
                    </button>
                  </span>
                )}
              </div>

              <ul className="mt-3 flex flex-wrap gap-2.5" aria-label={`Camas de ${r.name}`}>
                {r.occupants.map((p) => (
                  <li key={p.id} className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      disabled={!canManage}
                      onClick={() => canManage && remove.mutate({ id: r.id, userId: p.id })}
                      aria-label={canManage ? `Tirar ${p.name} do quarto` : p.name}
                      title={canManage ? `Tirar ${p.name}` : p.name}
                    >
                      <Avatar user={p} size={42} />
                    </button>
                    <span className="max-w-14 truncate text-[11px] font-bold">
                      {p.name.split(' ')[0]}
                    </span>
                  </li>
                ))}
                {Array.from({ length: r.freeBeds }, (_, i) => (
                  <li key={`free-${i}`} className="flex flex-col items-center gap-1">
                    <span
                      className="size-[42px] rounded-xl border-2 border-dashed border-line"
                      aria-label="Cama livre"
                    />
                    <span className="text-[11px] text-muted">Livre</span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {canJoin && !mine && r.freeBeds > 0 && (
                  <Button
                    size="sm"
                    disabled={locked}
                    loading={join.isPending && join.variables === r.id}
                    onClick={() => join.mutate(r.id)}
                  >
                    {myRoomId ? 'Trocar para este quarto' : 'Pegar cama'}
                  </Button>
                )}
                {mine && (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={leave.isPending}
                    onClick={() => leave.mutate(r.id)}
                  >
                    Sair do quarto
                  </Button>
                )}
                {canManage && unassigned.length > 0 && r.freeBeds > 0 && (
                  <AssignPicker
                    unassigned={unassigned}
                    onAssign={(userId) => assign.mutate({ id: r.id, userId })}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {unassigned.length > 0 && rooms.length > 0 && (
        <p className="text-sm text-muted">
          Sem cama ainda:{' '}
          <strong className="text-ink">
            {unassigned.map((u) => u.name.split(' ')[0]).join(', ')}
          </strong>
        </p>
      )}

      <Sheet
        open={editing !== null}
        title={editing === 'new' ? 'Novo quarto' : 'Editar quarto'}
        onClose={() => setEditing(null)}
      >
        {editing !== null && (
          <RoomForm
            eventId={event.id}
            code={event.code}
            room={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
    </section>
  );
}

function AssignPicker({
  unassigned,
  onAssign,
}: {
  unassigned: RoomsDto['unassigned'];
  onAssign: (userId: string) => void;
}) {
  const [userId, setUserId] = useState('');
  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        className="field !w-auto !py-1.5 text-sm"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        aria-label="Alocar pessoa neste quarto"
      >
        <option value="">Alocar…</option>
        {unassigned.map((u) => (
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

function RoomForm({
  eventId,
  code,
  room,
  onDone,
}: {
  eventId: string;
  code: string;
  room: RoomDto | null;
  onDone: () => void;
}) {
  const [name, setName] = useState(room?.name ?? '');
  const [beds, setBeds] = useState(room?.beds ?? 2);

  const save = useAction(
    () => {
      const body = { name: name.trim(), beds };
      return room
        ? api.patch(`/rooms/${room.id}`, body)
        : api.post(`/events/${eventId}/rooms`, body);
    },
    {
      invalidate: eventKeys(eventId, code),
      success: room ? 'Quarto atualizado' : 'Quarto criado',
      onSuccess: onDone,
    },
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate(undefined);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nome do quarto">
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Suíte"
          maxLength={40}
          autoFocus
        />
      </Field>
      <Field label="Quantas camas?">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="grid size-11 place-items-center rounded-[10px] border-[1.5px] border-line text-xl font-bold"
            aria-label="Menos camas"
            onClick={() => setBeds((b) => Math.max(1, b - 1))}
          >
            −
          </button>
          <span className="mono w-8 text-center text-xl font-semibold">{beds}</span>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-[10px] border-[1.5px] border-line text-xl font-bold"
            aria-label="Mais camas"
            onClick={() => setBeds((b) => Math.min(12, b + 1))}
          >
            +
          </button>
        </div>
      </Field>
      <Button type="submit" block loading={save.isPending} disabled={name.trim().length < 2}>
        Salvar quarto
      </Button>
    </form>
  );
}
