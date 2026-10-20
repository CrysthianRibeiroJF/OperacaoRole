import type { EventDetail, SupplyItemDto } from '@role/contracts';
import { SUPPLY_CATEGORIES, SUPPLY_CATEGORY_LABELS, type SupplyCategory } from '@role/domain';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import {
  IconCheck,
  IconEdit,
  IconPlus,
  IconTrash,
  IconUndo,
  IconWand,
} from '../../components/icons';
import {
  Avatar,
  EmptyState,
  ErrorState,
  Field,
  MoneyInput,
  Skeleton,
  Toggle,
} from '../../components/misc';
import { Sheet } from '../../components/Sheet';
import { api } from '../../lib/api';
import { formatBRL } from '../../lib/format';
import { eventKeys, useAction, useSession, useSupplies } from '../../lib/queries';

/** Aba Mercado & Itens: lista por categoria, "eu levo" e baixa que vira despesa com a cota certa. */
export function SuppliesTab({ detail }: { detail: EventDetail }) {
  const { event, me } = detail;
  const { data, isPending, isError, refetch } = useSupplies(event.id);
  const meId = useSession().data?.profile?.id;
  const invalidate = eventKeys(event.id, event.code);
  const [editing, setEditing] = useState<SupplyItemDto | 'new' | null>(null);
  const [buying, setBuying] = useState<SupplyItemDto | null>(null);

  const active = event.status === 'confirmed';
  const canEdit = me.can['supplies.edit'] && active;
  const canClaim = me.can['supplies.claim'] && active;

  const suggest = useAction(() => api.post(`/events/${event.id}/supplies/suggest`), {
    invalidate,
    success: 'Lista montada. Ajuste o que quiser.',
  });
  const claim = useAction((id: string) => api.post(`/supplies/${id}/claim`), { invalidate });
  const unclaim = useAction((id: string) => api.post(`/supplies/${id}/unclaim`), { invalidate });
  const undo = useAction((id: string) => api.post(`/supplies/${id}/undo`), {
    invalidate,
    success: 'Item reaberto',
  });
  const remove = useAction((id: string) => api.delete(`/supplies/${id}`), {
    invalidate,
    success: 'Item removido',
  });

  if (isPending) return <Skeleton rows={4} />;
  if (isError)
    return <ErrorState message="Não consegui carregar a lista." onRetry={() => void refetch()} />;

  const { items, estimatedCents, realCents, doneCount } = data;
  const progress = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  const groups = SUPPLY_CATEGORIES.map((category) => ({
    category,
    items: items.filter((i) => i.category === category),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <section className="card space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2>Mercado</h2>
            <p className="mt-1 text-sm text-muted">Quem leva o quê, sem desperdício.</p>
          </div>
          {canEdit && (
            <Button size="sm" variant="soft" onClick={() => setEditing('new')}>
              <IconPlus size={16} /> Item
            </Button>
          )}
        </div>
        {items.length > 0 && (
          <>
            <div className="h-2 overflow-hidden rounded-full bg-desk-deep" aria-hidden>
              <div
                className="h-full rounded-full bg-sol transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <dl className="grid grid-cols-3 gap-2">
              <div>
                <dt className="eyebrow !text-[10px]">Comprados</dt>
                <dd className="mono mt-0.5 font-semibold">
                  {doneCount}/{items.length}
                </dd>
              </div>
              <div>
                <dt className="eyebrow !text-[10px]">Estimado</dt>
                <dd className="mono mt-0.5 font-semibold">{formatBRL(estimatedCents)}</dd>
              </div>
              <div>
                <dt className="eyebrow !text-[10px]">Gasto real</dt>
                <dd className="mono mt-0.5 font-semibold">{formatBRL(realCents)}</dd>
              </div>
            </dl>
          </>
        )}
      </section>

      {items.length === 0 && (
        <EmptyState emoji="🛒" title="A lista ainda está vazia">
          {canEdit ? (
            <div className="space-y-3">
              <p>
                Eu monto uma lista inicial com a quantidade certa para quem está no rolê: quem come
                carne, quem bebe, vegetarianos e os dias. Depois você ajusta.
              </p>
              <Button loading={suggest.isPending} onClick={() => suggest.mutate(undefined)}>
                <IconWand size={18} /> Montar lista sugerida
              </Button>
            </div>
          ) : (
            <p>O General de Suprimentos ainda vai montar a lista.</p>
          )}
        </EmptyState>
      )}

      {groups.map((g) => (
        <section key={g.category} className="space-y-2">
          <h3 className="eyebrow !text-ink">{SUPPLY_CATEGORY_LABELS[g.category]}</h3>
          <ul className="card divide-y divide-line">
            {g.items.map((item) => {
              const mine = item.assignee?.id === meId;
              return (
                <li key={item.id} className="space-y-2 p-3.5">
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 ${
                        item.done ? 'border-ok bg-ok text-white' : 'border-line text-transparent'
                      }`}
                      aria-hidden
                    >
                      <IconCheck size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`font-bold ${item.done ? 'text-muted line-through' : ''}`}>
                        {item.name}
                      </p>
                      <p className="mono text-xs text-muted">
                        {item.quantityLabel}
                        {item.estPriceCents !== null && ` · ~${formatBRL(item.estPriceCents)}`}
                        {item.realPriceCents !== null &&
                          ` · pago ${formatBRL(item.realPriceCents)}`}
                      </p>
                    </div>
                    {canEdit && !item.done && (
                      <div className="flex shrink-0 gap-0.5">
                        <button
                          type="button"
                          aria-label={`Editar ${item.name}`}
                          className="grid size-9 place-items-center rounded-lg text-muted hover:bg-desk-deep"
                          onClick={() => setEditing(item)}
                        >
                          <IconEdit size={17} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remover ${item.name}`}
                          className="grid size-9 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                          onClick={() => remove.mutate(item.id)}
                        >
                          <IconTrash size={17} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pl-9">
                    {item.assignee ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-bold">
                        <Avatar user={item.assignee} size={22} />{' '}
                        {mine ? 'Você leva' : `${item.assignee.name.split(' ')[0]} leva`}
                      </span>
                    ) : (
                      canClaim &&
                      !item.done && (
                        <Button
                          size="sm"
                          variant="soft"
                          loading={claim.isPending && claim.variables === item.id}
                          onClick={() => claim.mutate(item.id)}
                        >
                          Eu levo
                        </Button>
                      )
                    )}
                    {active && !item.done && (mine || canEdit) && item.assignee && (
                      <Button size="sm" onClick={() => setBuying(item)}>
                        Comprei
                      </Button>
                    )}
                    {mine && !item.done && active && (
                      <Button size="sm" variant="ghost" onClick={() => unclaim.mutate(item.id)}>
                        Largar
                      </Button>
                    )}
                    {item.done && (mine || canEdit) && !item.hasExpense && active && (
                      <Button size="sm" variant="ghost" onClick={() => undo.mutate(item.id)}>
                        <IconUndo size={15} /> Reabrir
                      </Button>
                    )}
                    {item.hasExpense && <span className="tag text-ok">Virou despesa</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <Sheet
        open={editing !== null}
        title={editing === 'new' ? 'Novo item' : 'Editar item'}
        onClose={() => setEditing(null)}
      >
        {editing !== null && (
          <ItemForm
            eventId={event.id}
            code={event.code}
            item={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>

      <Sheet open={buying !== null} title="Dar baixa no item" onClose={() => setBuying(null)}>
        {buying && (
          <BuyForm
            item={buying}
            eventId={event.id}
            code={event.code}
            onDone={() => setBuying(null)}
          />
        )}
      </Sheet>
    </>
  );
}

function ItemForm({
  eventId,
  code,
  item,
  onDone,
}: {
  eventId: string;
  code: string;
  item: SupplyItemDto | null;
  onDone: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState<SupplyCategory>(item?.category ?? 'other');
  const [quantity, setQuantity] = useState(item?.quantityLabel ?? '');
  const [price, setPrice] = useState<number | null>(item?.estPriceCents ?? null);

  const save = useAction(
    () => {
      const body = {
        name: name.trim(),
        category,
        quantityLabel: quantity.trim(),
        estPriceCents: price,
      };
      return item
        ? api.patch(`/supplies/${item.id}`, body)
        : api.post(`/events/${eventId}/supplies`, body);
    },
    {
      invalidate: eventKeys(eventId, code),
      success: item ? 'Item atualizado' : 'Item adicionado',
      onSuccess: onDone,
    },
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate(undefined);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Item">
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Linguiça toscana"
          maxLength={80}
          autoFocus
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantidade">
          <input
            className="field"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="2 kg"
            maxLength={30}
          />
        </Field>
        <Field label="Estimativa (total)">
          <MoneyInput value={price} onChange={setPrice} />
        </Field>
      </div>
      <Field label="Categoria" hint="Define quem divide a conta quando o item virar despesa.">
        <select
          className="field"
          value={category}
          onChange={(e) => setCategory(e.target.value as SupplyCategory)}
        >
          {SUPPLY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {SUPPLY_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </Field>
      <Button
        type="submit"
        block
        loading={save.isPending}
        disabled={name.trim().length < 2 || quantity.trim().length < 1}
      >
        Salvar item
      </Button>
    </form>
  );
}

function BuyForm({
  item,
  eventId,
  code,
  onDone,
}: {
  item: SupplyItemDto;
  eventId: string;
  code: string;
  onDone: () => void;
}) {
  const [price, setPrice] = useState<number | null>(item.estPriceCents);
  const [asExpense, setAsExpense] = useState(true);

  const done = useAction(
    () =>
      api.post(`/supplies/${item.id}/done`, {
        ...(price ? { priceCents: price } : {}),
        createExpense: asExpense,
      }),
    {
      invalidate: eventKeys(eventId, code),
      success: asExpense ? 'Baixa feita e despesa lançada' : 'Baixa feita',
      onSuccess: onDone,
    },
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        done.mutate(undefined);
      }}
    >
      <p className="font-bold">{item.name}</p>
      <Field label="Quanto foi pago?">
        <MoneyInput value={price} onChange={setPrice} />
      </Field>
      <div className="rounded-[10px] bg-desk-deep p-3">
        <Toggle
          checked={asExpense}
          onChange={setAsExpense}
          label="Lançar como despesa"
          hint="Entra no rateio só entre quem consome esta categoria."
        />
      </div>
      <Button type="submit" block loading={done.isPending} disabled={asExpense && !price}>
        Confirmar compra
      </Button>
    </form>
  );
}
