import type { EventDetail, PartyRulesDto } from '@role/contracts';
import { MAX_CAPACITY, MAX_CHILDREN_HARD } from '@role/domain';
import { useState } from 'react';
import { Button } from '../../../components/Button';
import { Field, Skeleton, Toggle } from '../../../components/misc';
import { api } from '../../../lib/api';
import { eventKeys, useAction, useParty } from '../../../lib/queries';

/**
 * Regras de acompanhantes (só o Idealizador): liberar casal e crianças, teto de crianças por
 * confirmação e capacidade da casa em pessoas. É o que impede o rolê de virar uma creche.
 */
export function PartyRulesCard({ detail }: { detail: EventDetail }) {
  const { event } = detail;
  const { data, isPending } = useParty(event.id);
  const live = event.status === 'open' || event.status === 'confirmed';

  if (isPending || !data) return <Skeleton rows={1} />;
  return (
    <RulesForm
      key={JSON.stringify(data.rules)}
      eventId={event.id}
      code={event.code}
      rules={data.rules}
      total={data.totalHeads}
      live={live}
    />
  );
}

function RulesForm({
  eventId,
  code,
  rules,
  total,
  live,
}: {
  eventId: string;
  code: string;
  rules: PartyRulesDto;
  total: number;
  live: boolean;
}) {
  const [allow, setAllow] = useState(rules.allowCompanions);
  const [children, setChildren] = useState(rules.maxChildren);
  const [capacity, setCapacity] = useState(rules.capacity === null ? '' : String(rules.capacity));

  const capacityNumber = capacity.trim() === '' ? null : Number(capacity);
  const capacityOk =
    capacityNumber === null ||
    (Number.isInteger(capacityNumber) && capacityNumber >= 1 && capacityNumber <= MAX_CAPACITY);
  const dirty =
    allow !== rules.allowCompanions ||
    children !== rules.maxChildren ||
    capacityNumber !== rules.capacity;

  const save = useAction(
    () =>
      api.put<PartyRulesDto>(`/events/${eventId}/party-rules`, {
        allowCompanions: allow,
        maxChildren: children,
        capacity: capacityNumber,
      }),
    { invalidate: [...eventKeys(eventId, code), ['party', eventId]], success: 'Regras salvas' },
  );

  return (
    <section className="card space-y-4 p-5">
      <div>
        <p className="eyebrow">Idealizador</p>
        <h2 className="mt-2">Regras da turma</h2>
        <p className="mt-1 text-sm text-muted">
          Hoje são <strong className="text-ink">{total} pessoas</strong> no rolê. O quórum conta só
          quem confirma; a casa conta todas as cabeças.
        </p>
      </div>

      <Toggle
        checked={allow}
        onChange={setAllow}
        label="Liberar acompanhantes"
        hint="Casal e crianças entram na confirmação de quem os leva."
        disabled={!live}
      />
      <Field label="Crianças por confirmação" hint="Criança é isenta. Zero desliga.">
        <select
          className="field"
          value={children}
          onChange={(e) => setChildren(Number(e.target.value))}
          disabled={!live || !allow}
        >
          {Array.from({ length: MAX_CHILDREN_HARD + 1 }, (_, n) => (
            <option key={n} value={n}>
              {n === 0 ? 'Nenhuma' : n === 1 ? 'Até 1 criança' : `Até ${n} crianças`}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Capacidade da casa (pessoas)"
        hint="Vazio, sem limite. Acompanhante que estoura a casa é recusado."
        error={capacityOk ? undefined : `Informe de 1 a ${MAX_CAPACITY}`}
      >
        <input
          className="field"
          inputMode="numeric"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ''))}
          placeholder="Sem limite"
          disabled={!live}
        />
      </Field>
      <Button
        size="sm"
        loading={save.isPending}
        disabled={!live || !dirty || !capacityOk}
        onClick={() => save.mutate(undefined)}
      >
        Salvar regras
      </Button>
    </section>
  );
}
