import type { SuppliesPanel } from '@role/contracts';
import { SUPPLY_CATEGORY_LABELS } from '@role/domain';
import { Avatar, Badge } from '../../../components/misc';
import { formatBRL } from '../../../lib/format';
import { ProgressBar, Stat, TabLink, toneFor } from './parts';

/** Painel do General de Suprimentos: quanto já foi comprado, quanto falta, onde e com quem. */
export function SuppliesPanelCard({ data }: { data: SuppliesPanel }) {
  if (data.totalItems === 0) {
    return (
      <section className="card space-y-2 p-5">
        <p className="eyebrow">General de Suprimentos</p>
        <h2>Mercado</h2>
        <p className="text-sm text-muted">
          A lista de compras ainda não existe. Gere a sugestão pela turma na aba Mercado.
        </p>
        <TabLink tab="mercado">Abrir o Mercado</TabLink>
      </section>
    );
  }

  const over = data.deviationCents;
  return (
    <section className="card space-y-5 p-5">
      <div>
        <p className="eyebrow">General de Suprimentos</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <h2>Mercado</h2>
          <p className="mono text-2xl font-semibold leading-none">{data.percentDone}%</p>
        </div>
        <div className="mt-3">
          <ProgressBar
            percent={data.percentDone}
            tone={toneFor(data.percentDone)}
            label="Itens comprados"
          />
        </div>
        <p className="mt-1.5 text-xs text-muted">
          {data.doneItems} de {data.totalItems} itens comprados
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2.5">
        <Stat label="Estimado" value={formatBRL(data.estCents)} hint="lista inteira" />
        <Stat
          label="Já gasto"
          value={formatBRL(data.realCents)}
          hint={
            over === 0
              ? 'no valor estimado'
              : over > 0
                ? `${formatBRL(over)} acima do estimado`
                : `${formatBRL(-over)} abaixo do estimado`
          }
        />
        <Stat
          label="Por cabeça"
          value={data.perHeadEstCents === null ? '—' : formatBRL(data.perHeadEstCents)}
          hint="estimativa do mercado"
        />
        <Stat
          label="Sem responsável"
          value={data.unassignedItems}
          hint={data.unassignedItems === 0 ? 'tudo com dono' : 'ninguém assumiu'}
        />
      </dl>

      <div className="space-y-3">
        <h3 className="text-base">Por categoria</h3>
        <ul className="space-y-3">
          {data.byCategory.map((c) => {
            const pct = c.total === 0 ? 0 : Math.round((c.done / c.total) * 100);
            return (
              <li key={c.category} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-bold">{SUPPLY_CATEGORY_LABELS[c.category]}</span>
                  <span className="mono text-xs text-muted">
                    {c.done}/{c.total} · {formatBRL(c.realCents)} de {formatBRL(c.estCents)}
                  </span>
                </div>
                <ProgressBar
                  percent={pct}
                  tone={toneFor(pct)}
                  label={SUPPLY_CATEGORY_LABELS[c.category]}
                />
                {c.unassigned > 0 && <Badge tone="warn">{c.unassigned} sem responsável</Badge>}
              </li>
            );
          })}
        </ul>
      </div>

      {data.load.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-base">Quem leva o quê</h3>
          <ul className="space-y-2">
            {data.load.map((l) => (
              <li key={l.user.id} className="flex items-center gap-3">
                <Avatar user={l.user} size={30} />
                <span className="min-w-0 flex-1 truncate font-bold">{l.user.name}</span>
                <span className="mono text-sm">
                  {l.done}/{l.items} {l.items === 1 ? 'item' : 'itens'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.unassigned.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-base">Falta alguém levar</h3>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {data.unassigned.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate font-bold">{i.name}</span>
                <span className="shrink-0 text-xs text-muted">
                  {i.quantityLabel} · {SUPPLY_CATEGORY_LABELS[i.category]}
                </span>
              </li>
            ))}
          </ul>
          {data.unassignedItems > data.unassigned.length && (
            <p className="text-xs text-muted">
              e mais {data.unassignedItems - data.unassigned.length} na aba Mercado.
            </p>
          )}
        </div>
      )}

      <TabLink tab="mercado">Abrir a lista de compras</TabLink>
    </section>
  );
}
