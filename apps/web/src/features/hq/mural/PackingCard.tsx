import type { EventDetail } from '@role/contracts';
import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/Button';
import { IconTrash } from '../../../components/icons';
import { Badge, Skeleton } from '../../../components/misc';
import { api } from '../../../lib/api';
import { keys, useAction, usePacking } from '../../../lib/queries';

/** Bagagem: sugestões do grupo (General da Base) e a lista pessoal, que só a própria pessoa vê. */
export function PackingCard({ detail }: { detail: EventDetail }) {
  const { event } = detail;
  const { data, isPending } = usePacking(event.id);
  const [label, setLabel] = useState('');
  const [scope, setScope] = useState<'mine' | 'group'>('mine');
  const invalidate = [keys.packing(event.id)];
  const live = event.status === 'open' || event.status === 'confirmed';

  const add = useAction(
    () => api.post(`/events/${event.id}/packing`, { label: label.trim(), scope }),
    { invalidate, onSuccess: () => setLabel('') },
  );
  const check = useAction(
    (v: { id: string; checked: boolean }) =>
      api.post(`/packing/${v.id}/check`, { checked: v.checked }),
    { invalidate },
  );
  const remove = useAction((id: string) => api.delete(`/packing/${id}`), { invalidate });

  if (isPending || !data) return <Skeleton rows={1} />;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (label.trim().length >= 2) add.mutate(undefined);
  }

  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2>Bagagem</h2>
        <p className="mt-1 text-sm text-muted">
          {data.items.length === 0
            ? 'Sua lista pessoal e as sugestões da Base ficam aqui.'
            : `${data.doneCount} de ${data.items.length} itens prontos.`}
        </p>
      </div>

      {data.items.length > 0 && (
        <ul className="divide-y divide-line">
          {data.items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-2.5">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="size-5 shrink-0 accent-navy"
                  checked={i.checked}
                  onChange={(e) => check.mutate({ id: i.id, checked: e.target.checked })}
                />
                <span
                  className={`min-w-0 truncate ${i.checked ? 'text-muted line-through' : 'font-bold'}`}
                >
                  {i.label}
                </span>
              </label>
              {i.scope === 'group' && <Badge tone="info">Do grupo</Badge>}
              {i.canDelete && (
                <button
                  type="button"
                  aria-label={`Remover ${i.label}`}
                  className="grid size-9 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                  onClick={() => remove.mutate(i.id)}
                >
                  <IconTrash size={17} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {live && (
        <form onSubmit={submit} className="space-y-2">
          <div className="flex gap-2">
            <input
              className="field min-w-0 flex-1"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={scope === 'group' ? 'Protetor solar, caixa de som…' : 'Meu carregador…'}
              maxLength={60}
              aria-label="Novo item"
            />
            <Button type="submit" loading={add.isPending} disabled={label.trim().length < 2}>
              Adicionar
            </Button>
          </div>
          {data.canSuggest && (
            <div className="flex gap-2 text-sm" role="radiogroup" aria-label="Quem vê o item">
              {(
                [
                  ['mine', 'Só eu'],
                  ['group', 'Sugerir ao grupo'],
                ] as const
              ).map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={scope === value}
                  onClick={() => setScope(value)}
                  className={`rounded-full px-3 py-1.5 font-bold ${scope === value ? 'bg-ink text-surface' : 'bg-desk-deep text-muted'}`}
                >
                  {text}
                </button>
              ))}
            </div>
          )}
        </form>
      )}
    </section>
  );
}
