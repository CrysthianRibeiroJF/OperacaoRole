import type { EventDetail, SettlementDto, TransferDto } from '@role/contracts';
import { useState } from 'react';
import { IconCheck } from '../../../components/icons';
import { Button } from '../../../components/Button';
import { Badge, CopyButton, Spinner } from '../../../components/misc';
import { Sheet } from '../../../components/Sheet';
import { api, ApiError } from '../../../lib/api';
import { formatBRL, formatDateTime } from '../../../lib/format';
import {
  eventKeys,
  useAction,
  useDepositQueue,
  useExpenses,
  useSession,
  useSettlement,
} from '../../../lib/queries';

/** Fase 4: acerto de contas. O Tesoureiro vê tudo; cada pessoa vê só o que é seu. */
export function SettlementSection({ detail }: { detail: EventDetail }) {
  const { event, me } = detail;
  const { data, isPending } = useSettlement(event.id);
  const isTreasurer = me.can['settlement.close'];

  if (event.status !== 'confirmed' && event.status !== 'closed') return null;
  if (isPending) return <Spinner />;
  if (!data) return null;

  return (
    <section className="card space-y-4 p-5">
      <h2>Acerto de contas</h2>
      {data.closed ? (
        <ClosedView detail={detail} settlement={data} />
      ) : isTreasurer ? (
        <TreasurerPreview detail={detail} settlement={data} />
      ) : (
        <p className="text-muted">
          A conta ainda está aberta. Quando o Tesoureiro fechar, o seu saldo e quem paga quem
          aparecem aqui. Cada um vê só o que é seu.
        </p>
      )}
    </section>
  );
}

function BalancesTable({ settlement }: { settlement: SettlementDto }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[420px] text-sm">
        <thead className="bg-desk text-left text-xs uppercase text-muted">
          <tr>
            <th className="px-3 py-2">Quem</th>
            <th className="px-3 py-2 text-right">Pagou</th>
            <th className="px-3 py-2 text-right">Sinal</th>
            <th className="px-3 py-2 text-right">Parte</th>
            <th className="px-3 py-2 text-right">Saldo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {settlement.balances.map((b) => (
            <tr key={b.user.id}>
              <td className="px-3 py-2 font-bold">{b.user.name}</td>
              <td className="px-3 py-2 text-right">{formatBRL(b.paidCents)}</td>
              <td className="px-3 py-2 text-right">{formatBRL(b.depositCents)}</td>
              <td className="px-3 py-2 text-right">{formatBRL(b.costCents)}</td>
              <td
                className={`px-3 py-2 text-right font-extrabold ${b.netCents > 0 ? 'text-ok' : b.netCents < 0 ? 'text-danger' : ''}`}
              >
                {b.netCents > 0 ? '+' : b.netCents < 0 ? '−' : ''}
                {formatBRL(Math.abs(b.netCents))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TransferRow({
  t,
  meId,
  canConfirmAll,
  eventKeysToInvalidate,
}: {
  t: TransferDto;
  meId: string | undefined;
  canConfirmAll: boolean;
  eventKeysToInvalidate: ReturnType<typeof eventKeys>;
}) {
  const confirm = useAction(() => api.post(`/transfers/${t.id}/confirm`), {
    invalidate: eventKeysToInvalidate,
    success: 'Pagamento confirmado',
  });
  const iPay = t.from.id === meId;
  const iReceive = t.to.id === meId;
  const preview = t.id.startsWith('preview-');

  return (
    <li className="space-y-2 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0">
          <strong>{iPay ? 'Você' : t.from.name}</strong> paga{' '}
          <strong>{iReceive ? 'você' : t.to.name}</strong>
        </p>
        <p className="shrink-0 text-lg font-extrabold">{formatBRL(t.amountCents)}</p>
      </div>
      {t.paidAt ? (
        <Badge tone="ok">
          <IconCheck size={13} /> Pago em {formatDateTime(t.paidAt)}
        </Badge>
      ) : (
        !preview && (
          <div className="flex flex-wrap items-center gap-2">
            {iPay && t.toPixKey && (
              <>
                <code className="rounded-lg bg-desk px-2 py-1 text-sm font-bold">{t.toPixKey}</code>
                <CopyButton value={t.toPixKey} label="Copiar Pix" />
              </>
            )}
            {iPay && !t.toPixKey && (
              <span className="text-sm text-muted">
                {t.to.name} ainda não cadastrou a chave Pix. Combine direto.
              </span>
            )}
            {(iReceive || canConfirmAll) && (
              <Button
                size="sm"
                variant={iReceive ? 'primary' : 'ghost'}
                loading={confirm.isPending}
                onClick={() => confirm.mutate(undefined)}
              >
                {iReceive ? 'Recebi o Pix' : 'Dar baixa'}
              </Button>
            )}
          </div>
        )
      )}
    </li>
  );
}

function ClosedView({ detail, settlement }: { detail: EventDetail; settlement: SettlementDto }) {
  const { event, me } = detail;
  const meId = useSession().data?.profile?.id;
  const mine = settlement.balances.find((b) => b.user.id === meId);
  const keysToInvalidate = eventKeys(event.id, event.code);

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-navy-soft p-3 text-sm font-bold text-navy-dark">
        Conta fechada em {settlement.closedAt && formatDateTime(settlement.closedAt)} · total de
        despesas {formatBRL(settlement.totalExpensesCents)}
      </p>

      {mine && (
        <p className="text-lg">
          Seu saldo final:{' '}
          <strong
            className={mine.netCents > 0 ? 'text-ok' : mine.netCents < 0 ? 'text-danger' : ''}
          >
            {mine.netCents > 0 ? 'a receber ' : mine.netCents < 0 ? 'a pagar ' : 'quite '}
            {mine.netCents !== 0 && formatBRL(Math.abs(mine.netCents))}
          </strong>
        </p>
      )}

      <div>
        <h3 className="text-base">
          {me.can['settlement.viewAll'] ? 'Todos os acertos' : 'Seus acertos'}
        </h3>
        {settlement.transfers.length === 0 ? (
          <p className="mt-1 text-muted">Nada a acertar com ninguém.</p>
        ) : (
          <ul className="divide-y divide-line">
            {settlement.transfers.map((t) => (
              <TransferRow
                key={t.id}
                t={t}
                meId={meId}
                canConfirmAll={me.can['settlement.viewAll']}
                eventKeysToInvalidate={keysToInvalidate}
              />
            ))}
          </ul>
        )}
      </div>

      {me.can['settlement.viewAll'] && (
        <details>
          <summary className="cursor-pointer font-bold text-navy-dark">
            Ver o detalhamento por pessoa
          </summary>
          <div className="mt-2">
            <BalancesTable settlement={settlement} />
          </div>
        </details>
      )}
    </div>
  );
}

function TreasurerPreview({
  detail,
  settlement,
}: {
  detail: EventDetail;
  settlement: SettlementDto;
}) {
  const { event } = detail;
  const meId = useSession().data?.profile?.id;
  const [confirming, setConfirming] = useState(false);
  const expenses = useExpenses(event.id);
  const queue = useDepositQueue(event.id, !!detail.deposit.openedAt);

  const pendingExpenses = expenses.data?.filter((e) => e.status === 'pending') ?? [];
  const openContests = expenses.data?.filter((e) => e.contest && !e.contest.resolvedAt) ?? [];
  const pendingProofs = queue.data?.filter((d) => d.status === 'submitted') ?? [];
  const blockers = [
    ...pendingExpenses.map((e) => `Aprovar ou recusar: ${e.description}`),
    ...openContests.map((e) => `Decidir contestação: ${e.description}`),
    ...pendingProofs.map((d) => `Conferir comprovante de ${d.user.name}`),
    ...settlement.issues.map(
      (i) => `Ninguém divide a despesa "${i.description}" (ex.: ninguém marcou que bebe álcool)`,
    ),
  ];

  const close = useAction(() => api.post(`/events/${event.id}/settlement/close`), {
    invalidate: eventKeys(event.id, event.code),
    success: 'Conta do rolê fechada! Todo mundo foi avisado.',
    onSuccess: () => setConfirming(false),
  });
  const closeError = close.error instanceof ApiError && close.error.code === 'SETTLEMENT_BLOCKED';

  return (
    <div className="space-y-4">
      <p className="text-muted">
        Prévia do que cada um deve ou recebe, com as despesas aprovadas. Só entra no rateio quem
        está no rolê e em dia com o sinal.
      </p>
      <p className="text-sm">
        Total de despesas: <strong>{formatBRL(settlement.totalExpensesCents)}</strong>
      </p>

      <BalancesTable settlement={settlement} />

      {settlement.transfers.length > 0 && (
        <div>
          <h3 className="text-base">Quem paga quem</h3>
          <ul className="divide-y divide-line">
            {settlement.transfers.map((t) => (
              <TransferRow
                key={t.id}
                t={t}
                meId={meId}
                canConfirmAll={false}
                eventKeysToInvalidate={[]}
              />
            ))}
          </ul>
        </div>
      )}

      {blockers.length > 0 && (
        <div className="rounded-xl bg-warn-soft p-3 text-sm text-warn">
          <p className="font-extrabold">Antes de fechar:</p>
          <ul className="mt-1 list-disc pl-5">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      <Button
        block
        size="lg"
        disabled={blockers.length > 0 || event.status !== 'confirmed'}
        onClick={() => setConfirming(true)}
      >
        Fechar conta do rolê
      </Button>

      <Sheet open={confirming} title="Fechar a conta?" onClose={() => setConfirming(false)}>
        <div className="space-y-4">
          <p>
            Depois de fechar, ninguém lança nem altera despesas, e cada participante é avisado do
            próprio saldo. Isso não pode ser desfeito.
          </p>
          {closeError && (
            <p className="text-sm font-bold text-danger">
              Ainda há pendências. Atualize a tela e confira a lista.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Voltar
            </Button>
            <Button loading={close.isPending} onClick={() => close.mutate(undefined)}>
              Fechar conta
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
