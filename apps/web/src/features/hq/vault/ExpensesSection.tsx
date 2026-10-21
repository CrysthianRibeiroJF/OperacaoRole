import type { EventDetail, ExpenseCategory, ExpenseDto, PublicUser } from '@role/contracts';
import type { Quota } from '@role/domain';
import { IconCamera, IconReceipt } from '../../../components/icons';
import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/Button';
import { FileButton } from '../../../components/FileButton';
import { Badge, EmptyState, Field, MoneyInput, Spinner, Toggle } from '../../../components/misc';
import { ReasonSheet } from '../../../components/ReasonSheet';
import { Sheet } from '../../../components/Sheet';
import { api } from '../../../lib/api';
import { formatBRL, formatDateTime } from '../../../lib/format';
import { eventKeys, useAction, useExpenses, useFleet, useSession } from '../../../lib/queries';
import { CATEGORY_LABELS, QUOTA_HINTS, QUOTA_LABELS } from './labels';

export function ExpensesSection({ detail }: { detail: EventDetail }) {
  const { event, me } = detail;
  const { data, isPending } = useExpenses(event.id);
  const [adding, setAdding] = useState(false);

  const canAdd = me.can['expense.create'] && event.status === 'confirmed';
  const approvedTotal =
    data?.filter((e) => e.status === 'approved').reduce((s, e) => s + e.amountCents, 0) ?? 0;

  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2>Despesas</h2>
          <p className="text-sm text-muted">
            Total aprovado: <strong className="text-ink">{formatBRL(approvedTotal)}</strong>
          </p>
        </div>
        {canAdd && (
          <Button size="sm" onClick={() => setAdding(true)}>
            ＋ Lançar
          </Button>
        )}
      </div>

      {isPending && <Spinner />}
      {data && data.length === 0 && (
        <EmptyState emoji="🧾" title="Nenhuma despesa ainda">
          Comprou gelo, carvão ou abasteceu pelo grupo? Lance aqui com a foto da nota em segundos.
        </EmptyState>
      )}
      <ul className="divide-y divide-line">
        {data?.map((e) => (
          <ExpenseItem key={e.id} expense={e} detail={detail} />
        ))}
      </ul>

      <Sheet open={adding} title="Lançar despesa" onClose={() => setAdding(false)}>
        <ExpenseForm detail={detail} onDone={() => setAdding(false)} />
      </Sheet>
    </section>
  );
}

function ExpenseForm({ detail, onDone }: { detail: EventDetail; onDone: () => void }) {
  const { event, roster } = detail;
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [amount, setAmount] = useState<number | null>(null);
  const [quota, setQuota] = useState<Quota>('global');
  const [people, setPeople] = useState<string[]>([]);
  const fleet = useFleet(event.id, true);
  const [receipt, setReceipt] = useState<File | null>(null);
  // Conta por item ("a conta do bar"): cada item é dividido só entre quem consumiu.
  const [byItem, setByItem] = useState(false);
  const [items, setItems] = useState<DraftItem[]>(() => [newItem()]);

  const save = useAction(
    async () => {
      const created = await api.post<ExpenseDto>(`/events/${event.id}/expenses`, {
        description: description.trim(),
        category,
        amountCents: amount,
        ...(byItem
          ? {
              quota: 'custom',
              items: items.map((i) => ({
                label: i.label.trim(),
                amountCents: i.amount,
                consumerIds: i.consumers,
              })),
            }
          : {
              quota,
              ...(quota === 'custom' ? { customParticipantIds: people } : {}),
            }),
      });
      // A despesa já existe; se a foto falhar, dá para anexar depois sem perder o lançamento.
      if (receipt)
        await api.upload(`/expenses/${created.id}/receipt`, receipt).catch(() => undefined);
      return created;
    },
    {
      invalidate: eventKeys(event.id, event.code),
      success: 'Despesa lançada',
      onSuccess: onDone,
    },
  );

  const itemsTotal = items.reduce((sum, i) => sum + (i.amount ?? 0), 0);
  const itemsOk =
    !byItem ||
    (items.length > 0 &&
      items.every((i) => i.label.trim().length > 0 && (i.amount ?? 0) > 0) &&
      itemsTotal <= (amount ?? 0));
  const valid =
    description.trim().length >= 2 &&
    amount !== null &&
    amount > 0 &&
    itemsOk &&
    (byItem || quota !== 'custom' || people.length > 0);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (valid) save.mutate(undefined);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="O que foi?">
        <input
          className="field"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Carvão e gelo no posto"
          maxLength={120}
          autoFocus
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor">
          <MoneyInput value={amount} onChange={setAmount} />
        </Field>
        <Field label="Categoria">
          <select
            className="field"
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
          >
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="rounded-[12px] bg-desk-deep px-4 py-1">
        <Toggle
          checked={byItem}
          onChange={setByItem}
          label="Dividir por item"
          hint="Conta do bar ou restaurante: cada um paga só o que consumiu."
        />
      </div>

      {byItem && (
        <ItemsEditor
          items={items}
          setItems={setItems}
          roster={roster.map((m) => m.user)}
          total={amount}
          itemsTotal={itemsTotal}
        />
      )}

      <fieldset className={byItem ? 'hidden' : ''}>
        <legend className="label">Quem divide essa conta?</legend>
        <div className="space-y-2">
          {(Object.keys(QUOTA_LABELS) as Quota[]).map((q) => (
            <label
              key={q}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 ${quota === q ? 'border-navy bg-navy-soft/50' : 'border-line'}`}
            >
              <input
                type="radio"
                name="quota"
                className="mt-1 size-4 accent-navy"
                checked={quota === q}
                onChange={() => setQuota(q)}
              />
              <span>
                <span className="block font-bold">{QUOTA_LABELS[q]}</span>
                <span className="text-sm text-muted">{QUOTA_HINTS[q]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {!byItem && quota === 'custom' && (
        <fieldset>
          <legend className="label">Escolha as pessoas</legend>
          {fleet.data && fleet.data.vehicles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {fleet.data.vehicles.map((v) => {
                const ids = [v.driver.id, ...v.passengers.map((p) => p.id)];
                return (
                  <button
                    key={v.id}
                    type="button"
                    className="rounded-full bg-navy-soft px-3 py-1.5 text-xs font-bold text-navy-dark"
                    onClick={() =>
                      setPeople(ids.filter((id) => roster.some((m) => m.user.id === id)))
                    }
                  >
                    Ocupantes: {v.label}
                  </button>
                );
              })}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {roster.map((m) => (
              <label
                key={m.user.id}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-line p-2.5"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-navy"
                  checked={people.includes(m.user.id)}
                  onChange={(e) =>
                    setPeople((p) =>
                      e.target.checked ? [...p, m.user.id] : p.filter((x) => x !== m.user.id),
                    )
                  }
                />
                <span className="truncate text-sm font-bold">{m.user.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex items-center gap-3">
        <FileButton
          label={
            <>
              <IconCamera size={16} /> {receipt ? 'Trocar nota' : 'Foto da nota'}
            </>
          }
          variant="soft"
          onFile={setReceipt}
        />
        {receipt && <span className="truncate text-sm text-muted">{receipt.name}</span>}
      </div>

      <Button type="submit" block loading={save.isPending} disabled={!valid}>
        Lançar despesa
      </Button>
    </form>
  );
}

interface DraftItem {
  key: number;
  label: string;
  amount: number | null;
  consumers: string[];
}

let draftKey = 0;
const newItem = (): DraftItem => ({ key: draftKey++, label: '', amount: null, consumers: [] });

/** Itens da conta: nome, valor e quem consumiu. O que sobrar do total (taxa, gorjeta) é rateado pelo consumo. */
function ItemsEditor({
  items,
  setItems,
  roster,
  total,
  itemsTotal,
}: {
  items: DraftItem[];
  setItems: (update: (list: DraftItem[]) => DraftItem[]) => void;
  roster: PublicUser[];
  total: number | null;
  itemsTotal: number;
}) {
  const patch = (key: number, change: Partial<DraftItem>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...change } : i)));
  const extra = (total ?? 0) - itemsTotal;

  return (
    <fieldset className="space-y-3">
      <legend className="label">Itens da conta</legend>
      {items.map((item, index) => (
        <div key={item.key} className="space-y-2.5 rounded-xl border border-line p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
            <input
              className="field"
              value={item.label}
              onChange={(e) => patch(item.key, { label: e.target.value })}
              placeholder={`Item ${index + 1} (ex.: Picanha)`}
              maxLength={60}
              aria-label={`Nome do item ${index + 1}`}
            />
            <MoneyInput value={item.amount} onChange={(amount) => patch(item.key, { amount })} />
          </div>
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label={`Quem consumiu o item ${index + 1}`}
          >
            {roster.map((p) => {
              const on = item.consumers.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    patch(item.key, {
                      consumers: on
                        ? item.consumers.filter((id) => id !== p.id)
                        : [...item.consumers, p.id],
                    })
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${on ? 'bg-ink text-surface' : 'bg-desk-deep text-muted'}`}
                >
                  {p.name.split(' ')[0]}
                </button>
              );
            })}
          </div>
          {items.length > 1 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setItems((list) => list.filter((i) => i.key !== item.key))}
            >
              Remover item
            </Button>
          )}
        </div>
      ))}
      <Button size="sm" variant="soft" onClick={() => setItems((list) => [...list, newItem()])}>
        ＋ Item
      </Button>
      <p className={`text-sm ${extra < 0 ? 'font-bold text-danger' : 'text-muted'}`}>
        {extra < 0
          ? 'Os itens passam do valor da despesa.'
          : extra > 0
            ? `Sobram ${formatBRL(extra)} (taxa, gorjeta): rateados na proporção do que cada um consumiu.`
            : 'Os itens fecham o valor da despesa.'}{' '}
        Quem não marcou o item ainda pode marcar depois, na lista de despesas.
      </p>
    </fieldset>
  );
}

const statusBadge = {
  approved: <Badge tone="ok">Aprovada</Badge>,
  pending: <Badge tone="warn">Aguardando Tesoureiro</Badge>,
  rejected: <Badge tone="danger">Recusada</Badge>,
} as const;

function ExpenseItem({ expense: e, detail }: { expense: ExpenseDto; detail: EventDetail }) {
  const { event, me } = detail;
  const meId = useSession().data?.profile?.id;
  const invalidate = eventKeys(event.id, event.code);
  const [dialog, setDialog] = useState<null | 'reject' | 'contest' | 'resolve'>(null);
  const close = () => setDialog(null);

  const review = useAction(
    (v: { decision: 'approve' | 'reject'; reason?: string }) =>
      api.post(`/expenses/${e.id}/review`, v),
    { invalidate, success: 'Pronto', onSuccess: close },
  );
  const contest = useAction((reason: string) => api.post(`/expenses/${e.id}/contest`, { reason }), {
    invalidate,
    success: 'Contestação enviada ao Tesoureiro',
    onSuccess: close,
  });
  const resolve = useAction(
    (v: { decision: 'keep' | 'reject'; note: string }) =>
      api.post(`/expenses/${e.id}/resolve-contest`, v),
    { invalidate, success: 'Contestação decidida', onSuccess: close },
  );
  const attach = useAction((file: File) => api.upload(`/expenses/${e.id}/receipt`, file), {
    invalidate,
    success: 'Nota anexada',
  });
  const consume = useAction((itemId: string) => api.post(`/expense-items/${itemId}/consume`), {
    invalidate,
  });

  const active = event.status === 'confirmed';
  const openContest = e.contest && !e.contest.resolvedAt;

  return (
    <li className="space-y-2 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">{e.description}</p>
          <p className="text-sm text-muted">
            {e.paidBy.name} pagou · {CATEGORY_LABELS[e.category]} · divide:{' '}
            {e.items.length > 0 ? 'por item' : QUOTA_LABELS[e.quota].toLowerCase()}
            {e.items.length === 0 &&
              e.quota === 'custom' &&
              ` (${e.customParticipants.map((p) => p.name.split(' ')[0]).join(', ')})`}
          </p>
        </div>
        <p className="shrink-0 text-lg font-extrabold">{formatBRL(e.amountCents)}</p>
      </div>

      {e.items.length > 0 && (
        <ul className="space-y-1.5 rounded-xl bg-desk p-3" aria-label="Itens da conta">
          {e.items.map((item) => {
            const mine = !!meId && item.consumers.some((c) => c.id === meId);
            return (
              <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0">
                  <strong>{item.label}</strong> · {formatBRL(item.amountCents)}
                  <span className="block truncate text-xs text-muted">
                    {item.consumers.length > 0
                      ? item.consumers.map((c) => c.name.split(' ')[0]).join(', ')
                      : 'ninguém marcou ainda'}
                  </span>
                </span>
                {active && e.status !== 'rejected' && me.can['expense.create'] && (
                  <Button
                    size="sm"
                    variant={mine ? 'ghost' : 'soft'}
                    onClick={() => consume.mutate(item.id)}
                  >
                    {mine ? 'Tirar meu nome' : 'Eu consumi'}
                  </Button>
                )}
              </li>
            );
          })}
          {e.amountCents > e.items.reduce((s, i) => s + i.amountCents, 0) && (
            <li className="text-xs text-muted">
              Sobra de {formatBRL(e.amountCents - e.items.reduce((s, i) => s + i.amountCents, 0))}{' '}
              (taxa, gorjeta) rateada pelo consumo.
            </li>
          )}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {statusBadge[e.status]}
        {openContest && <Badge tone="danger">Contestada</Badge>}
        {e.hasReceipt && (
          <a
            className="text-sm font-bold text-navy-dark"
            href={`/api/expenses/${e.id}/receipt`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <IconReceipt size={15} /> Ver nota
          </a>
        )}
        <span className="text-xs text-muted">{formatDateTime(e.createdAt)}</span>
      </div>

      {e.rejectReason && <p className="text-sm text-danger">Motivo: {e.rejectReason}</p>}
      {e.contest && (
        <p className="rounded-xl bg-danger-soft p-2.5 text-sm">
          <strong>{e.contest.by.name}</strong> contestou: {e.contest.reason}
          {e.contest.resolution && (
            <span className="block text-muted">Decisão: {e.contest.resolution}</span>
          )}
        </p>
      )}

      {active && (
        <div className="flex flex-wrap gap-2">
          {e.status === 'pending' && me.can['expense.review'] && (
            <>
              <Button
                size="sm"
                loading={review.isPending}
                onClick={() => review.mutate({ decision: 'approve' })}
              >
                Aprovar
              </Button>
              <Button size="sm" variant="danger" onClick={() => setDialog('reject')}>
                Recusar
              </Button>
            </>
          )}
          {openContest && me.can['expense.resolveContest'] && (
            <Button size="sm" variant="soft" onClick={() => setDialog('resolve')}>
              Decidir contestação
            </Button>
          )}
          {e.contestable && (
            <Button size="sm" variant="ghost" onClick={() => setDialog('contest')}>
              Contestar
            </Button>
          )}
          {!e.hasReceipt && e.status !== 'rejected' && e.paidBy.id === meId && (
            <FileButton
              label={
                <>
                  <IconCamera size={15} /> Anexar nota
                </>
              }
              size="sm"
              variant="ghost"
              loading={attach.isPending}
              onFile={(f) => attach.mutate(f)}
            />
          )}
        </div>
      )}

      <ReasonSheet
        open={dialog === 'reject'}
        title="Recusar despesa"
        label="Motivo (quem lançou vai ler)"
        submitLabel="Recusar despesa"
        loading={review.isPending}
        onClose={close}
        onSubmit={(reason) => review.mutate({ decision: 'reject', reason })}
      />
      <ReasonSheet
        open={dialog === 'contest'}
        title="Contestar despesa"
        label="O que não bate?"
        submitLabel="Enviar contestação"
        loading={contest.isPending}
        onClose={close}
        onSubmit={(reason) => contest.mutate(reason)}
      />
      <ResolveSheet
        open={dialog === 'resolve'}
        loading={resolve.isPending}
        onClose={close}
        onSubmit={(v) => resolve.mutate(v)}
      />
    </li>
  );
}

function ResolveSheet({
  open,
  loading,
  onClose,
  onSubmit,
}: {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (v: { decision: 'keep' | 'reject'; note: string }) => void;
}) {
  const [note, setNote] = useState('');
  return (
    <Sheet open={open} title="Decidir contestação" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Sua justificativa (fica registrada)">
          <textarea
            className="field min-h-24"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={240}
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            loading={loading}
            disabled={note.trim().length < 3}
            onClick={() => onSubmit({ decision: 'keep', note: note.trim() })}
          >
            Manter despesa
          </Button>
          <Button
            variant="danger"
            loading={loading}
            disabled={note.trim().length < 3}
            onClick={() => onSubmit({ decision: 'reject', note: note.trim() })}
          >
            Remover da conta
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
