import type { CompanionDto, EventDetail, PartyDto } from '@role/contracts';
import { useState } from 'react';
import { Button } from '../../../components/Button';
import { IconPlus, IconTrash } from '../../../components/icons';
import { Badge, Skeleton, Toggle } from '../../../components/misc';
import { Sheet } from '../../../components/Sheet';
import { api } from '../../../lib/api';
import { formatBRL } from '../../../lib/format';
import { eventKeys, useAction, useParty } from '../../../lib/queries';

interface Draft {
  key: number;
  name: string;
  kind: 'adult' | 'child';
  drinksAlcohol: boolean;
  diet: 'omnivore' | 'vegetarian';
}

let draftKey = 0;
const fromDto = (c: CompanionDto): Draft => ({ key: draftKey++, ...c });
const blank = (kind: Draft['kind']): Draft => ({
  key: draftKey++,
  name: '',
  kind,
  drinksAlcohol: false,
  diet: 'omnivore',
});

/**
 * Meus acompanhantes: casal e crianças que vão junto. Só valem para este rolê (sem conta). O
 * responsável paga a cota do acompanhante adulto; criança é isenta; o quórum conta só o responsável.
 */
export function CompanionsCard({ detail }: { detail: EventDetail }) {
  const { event, me, deposit } = detail;
  const { data, isPending } = useParty(event.id);
  const [open, setOpen] = useState(false);

  if (isPending || !data) return <Skeleton rows={1} />;
  const depositNote =
    deposit.required && deposit.amountCents
      ? ` Sinal: ${formatBRL(deposit.amountCents * data.payingUnits)}.`
      : '';

  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2>Meus acompanhantes</h2>
          <p className="mt-1 text-sm text-muted">
            {data.companions.length === 0
              ? 'Vai levar alguém? Casal ou criança entram na sua confirmação.'
              : `Você paga ${data.payingUnits} ${data.payingUnits === 1 ? 'cota' : 'cotas'}: criança é isenta.${depositNote}`}
          </p>
        </div>
        {data.canEdit && me.participation === 'in' && data.rules.allowCompanions && (
          <Button size="sm" variant="soft" onClick={() => setOpen(true)}>
            {data.companions.length === 0 ? 'Adicionar' : 'Editar'}
          </Button>
        )}
      </div>

      {data.companions.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {data.companions.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="min-w-0 truncate font-bold">{c.name}</span>
              <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                <Badge tone={c.kind === 'adult' ? 'info' : 'ok'}>
                  {c.kind === 'adult' ? 'Adulto · paga cota' : 'Criança · isenta'}
                </Badge>
                {c.drinksAlcohol && <Badge tone="neutral">bebe</Badge>}
                {c.diet === 'vegetarian' && <Badge tone="neutral">vegetariano</Badge>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!data.rules.allowCompanions && (
        <p className="text-sm text-muted">O Idealizador não liberou acompanhantes neste rolê.</p>
      )}
      <Capacity party={data} />

      <Sheet open={open} title="Meus acompanhantes" onClose={() => setOpen(false)}>
        {open && <CompanionsForm eventId={event.id} party={data} onDone={() => setOpen(false)} />}
      </Sheet>
    </section>
  );
}

function Capacity({ party }: { party: PartyDto }) {
  if (party.rules.capacity === null) return null;
  return (
    <p className="text-xs text-muted">
      A casa comporta {party.rules.capacity} pessoas · {party.totalHeads} confirmadas
      {party.capacityLeft !== null && ` (cabem mais ${party.capacityLeft})`}.
    </p>
  );
}

function CompanionsForm({
  eventId,
  party,
  onDone,
}: {
  eventId: string;
  party: PartyDto;
  onDone: () => void;
}) {
  const [rows, setRows] = useState<Draft[]>(() => party.companions.map(fromDto));
  const adults = rows.filter((r) => r.kind === 'adult').length;
  const kids = rows.length - adults;
  const canAddAdult = !party.adultsLocked && adults < party.limits.maxAdults;
  const canAddKid = kids < party.limits.maxChildren;

  const save = useAction(
    () =>
      api.put<PartyDto>(`/events/${eventId}/companions`, {
        companions: rows.map(({ name, kind, drinksAlcohol, diet }) => ({
          name: name.trim(),
          kind,
          drinksAlcohol: kind === 'adult' && drinksAlcohol,
          diet,
        })),
      }),
    {
      invalidate: [...eventKeys(eventId), ['party', eventId]],
      success: 'Acompanhantes salvos',
      onSuccess: onDone,
    },
  );

  const patch = (key: number, change: Partial<Draft>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const valid = rows.every((r) => r.name.trim().length > 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Só valem para este rolê e não precisam de conta. Você paga a cota do acompanhante adulto
        (bebida, comida, sinal); criança é isenta, mas ocupa lugar no carro e conta para a casa.
      </p>
      {party.adultsLocked && (
        <p className="rounded-xl bg-warn-soft p-3 text-sm font-bold text-warn">
          O seu sinal já foi pago por um número de pessoas: o acompanhante adulto fica travado.
          Crianças podem mudar.
        </p>
      )}

      {rows.map((r, i) => {
        const lockedRow = party.adultsLocked && r.kind === 'adult';
        return (
          <fieldset key={r.key} className="space-y-3 rounded-xl border border-line p-3">
            <legend className="px-1 text-xs font-extrabold uppercase text-muted">
              {r.kind === 'adult' ? 'Acompanhante adulto' : `Criança ${i + 1 - adults}`}
            </legend>
            <input
              className="field"
              value={r.name}
              onChange={(e) => patch(r.key, { name: e.target.value })}
              placeholder="Nome"
              maxLength={40}
              aria-label="Nome do acompanhante"
              disabled={lockedRow}
              autoFocus={i === rows.length - 1 && r.name === ''}
            />
            {r.kind === 'adult' && (
              <>
                <Toggle
                  checked={r.drinksAlcohol}
                  onChange={(v) => patch(r.key, { drinksAlcohol: v })}
                  label="Bebe álcool"
                  disabled={lockedRow}
                />
                <label className="block">
                  <span className="label">Alimentação</span>
                  <select
                    className="field"
                    value={r.diet}
                    onChange={(e) => patch(r.key, { diet: e.target.value as Draft['diet'] })}
                    disabled={lockedRow}
                  >
                    <option value="omnivore">Come de tudo</option>
                    <option value="vegetarian">Vegetariano</option>
                  </select>
                </label>
              </>
            )}
            {!lockedRow && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}
              >
                <IconTrash size={16} /> Remover
              </Button>
            )}
          </fieldset>
        );
      })}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="soft"
          disabled={!canAddAdult}
          onClick={() => setRows((list) => [...list, blank('adult')])}
        >
          <IconPlus size={16} /> Acompanhante adulto
        </Button>
        <Button
          size="sm"
          variant="soft"
          disabled={!canAddKid}
          onClick={() => setRows((list) => [...list, blank('child')])}
        >
          <IconPlus size={16} /> Criança
        </Button>
      </div>
      <p className="text-xs text-muted">
        Limite: {party.limits.maxAdults} adulto e {party.limits.maxChildren}{' '}
        {party.limits.maxChildren === 1 ? 'criança' : 'crianças'} por confirmação.
      </p>

      <Button
        block
        loading={save.isPending}
        disabled={!valid}
        onClick={() => save.mutate(undefined)}
      >
        Salvar acompanhantes
      </Button>
    </div>
  );
}
