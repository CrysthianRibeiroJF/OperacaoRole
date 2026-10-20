import type { EventDetail } from '@role/contracts';
import { budgetCurve, perPersonCents } from '@role/domain';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { IconEdit } from '../../components/icons';
import { Field, MoneyInput } from '../../components/misc';
import { Sheet } from '../../components/Sheet';
import { api } from '../../lib/api';
import { formatBRL } from '../../lib/format';
import { eventKeys, useAction, useSupplies } from '../../lib/queries';

/**
 * Simulador de orçamento: custos fixos (casa) + mercado estimado, divididos por quem está no rolê.
 * Mostra o valor por cabeça caindo conforme entra gente, que é o incentivo para convidar mais.
 */
export function BudgetCard({ detail }: { detail: EventDetail }) {
  const { event, me, budget } = detail;
  const supplies = useSupplies(event.id);
  const [editing, setEditing] = useState(false);

  const live = event.status === 'open' || event.status === 'confirmed';
  if (!live) return null;

  const canEdit = me.can['budget.edit'];
  const fixed = budget.fixedCostsCents;
  const suppliesCents = supplies.data?.estimatedCents ?? 0;
  const input = { fixedCents: fixed ?? 0, suppliesCents, people: event.confirmedCount };
  const now = perPersonCents(input);
  const hasData = fixed !== null || suppliesCents > 0;

  const curve = budgetCurve(input, [0, 1, 2, 3, 5]);
  const max = Math.max(...curve.map((p) => p.perPersonCents), 1);
  const overCap = now !== null && now > event.costCapCents;

  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2>Orçamento</h2>
          <p className="mt-1 text-sm text-muted">Mais gente, rolê mais barato.</p>
        </div>
        {canEdit && (
          <Button size="sm" variant="soft" onClick={() => setEditing(true)}>
            <IconEdit size={15} /> Custos fixos
          </Button>
        )}
      </div>

      {!hasData || now === null ? (
        <p className="text-sm text-muted">
          {canEdit
            ? 'Informe os custos fixos (casa, hospedagem) para ver quanto fica por pessoa.'
            : 'O General da Base ainda vai informar os custos fixos.'}
        </p>
      ) : (
        <>
          <div>
            <p className="eyebrow">Hoje, com {event.confirmedCount} pessoas</p>
            <p className="mono mt-1 text-[2.25rem] font-semibold leading-none">{formatBRL(now)}</p>
            <p className={`mt-2 text-sm font-bold ${overCap ? 'text-warn' : 'text-ok'}`}>
              {overCap
                ? `Passa ${formatBRL(now - event.costCapCents)} do teto de ${formatBRL(event.costCapCents)} por pessoa.`
                : `Dentro do teto de ${formatBRL(event.costCapCents)} por pessoa.`}
            </p>
          </div>

          <ul className="space-y-2" aria-label="Valor por pessoa conforme entra mais gente">
            {curve.map((p, i) => (
              <li
                key={p.people}
                className="grid grid-cols-[4.5rem_1fr_5.5rem] items-center gap-3 text-sm"
              >
                <span className="text-muted">
                  {i === 0 ? 'Agora' : `+${p.people - event.confirmedCount}`}
                </span>
                <span className="h-3 overflow-hidden rounded-full bg-desk-deep" aria-hidden>
                  <span
                    className={`block h-full rounded-full ${i === 0 ? 'bg-night' : 'bg-sol'}`}
                    style={{ width: `${Math.max(8, (p.perPersonCents / max) * 100)}%` }}
                  />
                </span>
                <span className="mono text-right font-semibold">{formatBRL(p.perPersonCents)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            Estimativa: custos fixos {formatBRL(fixed ?? 0)} + mercado {formatBRL(suppliesCents)}. O
            rateio real usa as despesas lançadas.
          </p>
        </>
      )}

      <Sheet open={editing} title="Custos fixos" onClose={() => setEditing(false)}>
        {editing && (
          <FixedCostsForm
            eventId={event.id}
            code={event.code}
            initial={fixed}
            onDone={() => setEditing(false)}
          />
        )}
      </Sheet>
    </section>
  );
}

function FixedCostsForm({
  eventId,
  code,
  initial,
  onDone,
}: {
  eventId: string;
  code: string;
  initial: number | null;
  onDone: () => void;
}) {
  const [value, setValue] = useState<number | null>(initial);
  const save = useAction(
    (cents: number | null) => api.put(`/events/${eventId}/budget`, { fixedCostsCents: cents }),
    {
      invalidate: eventKeys(eventId, code),
      success: 'Custos fixos atualizados',
      onSuccess: onDone,
    },
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate(value);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field
        label="Total dos custos fixos"
        hint="Casa ou pousada, taxa de limpeza, o que é dividido por todos independentemente do consumo."
      >
        <MoneyInput value={value} onChange={setValue} placeholder="1.500,00" />
      </Field>
      <Button type="submit" block loading={save.isPending}>
        Salvar
      </Button>
    </form>
  );
}
