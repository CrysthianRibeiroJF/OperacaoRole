import type { EventDetail } from '@role/contracts';
import { ErrorState, Spinner } from '../../components/misc';
import { formatBRL } from '../../lib/format';
import { useVault } from '../../lib/queries';
import { Ticket } from '../events/shared';
import { DepositSection } from './vault/DepositSection';
import { ExpensesSection } from './vault/ExpensesSection';
import { SettlementSection } from './vault/SettlementSection';
import { TreasurerPanel } from './vault/TreasurerPanel';

/** Extrato pessoal: o número que importa em destaque, os componentes dele no canhoto. */
function MyBalance({ eventId }: { eventId: string }) {
  const { data, isPending, isError, refetch } = useVault(eventId);
  if (isPending) return <Spinner />;
  if (isError)
    return (
      <ErrorState message="Não consegui carregar o seu Cofre." onRetry={() => void refetch()} />
    );

  const net = data.projectedNetCents;
  const sign = net > 0 ? '+' : net < 0 ? '−' : '';
  const valueColor = net > 0 ? 'text-sol' : net < 0 ? 'text-[#ff9a8a]' : 'text-white';

  const parts: [string, number][] = [
    ['Você pagou', data.paidByMeCents],
    ['Sinal pago', data.depositPaidCents],
    [data.settled ? 'Sua parte' : 'Sua parte (prévia)', data.projectedShareCents],
  ];

  return (
    <div className="space-y-3">
      <Ticket
        night
        top={
          <div className="px-5 pb-6 pt-5">
            <p className="eyebrow !text-white/55">
              {data.settled ? 'Saldo final' : 'Saldo até agora'}
            </p>
            <p className={`mono mt-2 text-[2.75rem] font-semibold leading-none ${valueColor}`}>
              {sign}
              {formatBRL(Math.abs(net))}
            </p>
            <p className="mt-2 text-sm text-white/75">
              {net > 0
                ? 'Você tem a receber.'
                : net < 0
                  ? 'Você deve ao grupo.'
                  : 'Você está quite.'}
            </p>
          </div>
        }
        bottom={
          <dl className="grid grid-cols-3 gap-2 px-5 pb-4 pt-5">
            {parts.map(([title, value]) => (
              <div key={title}>
                <dt className="eyebrow !text-[10px] leading-tight">{title}</dt>
                <dd className="mono mt-1 text-[15px] font-semibold">{formatBRL(value)}</dd>
              </div>
            ))}
          </dl>
        }
      />
      {data.pendingExpenses > 0 && (
        <p className="rounded-[10px] bg-warn-soft px-4 py-2.5 text-sm font-bold text-warn">
          {data.pendingExpenses} despesa(s) sua(s) aguardando aprovação do Tesoureiro.
        </p>
      )}
    </div>
  );
}

/** Cofre: tudo o que é dinheiro, num lugar só. */
export function VaultTab({ detail }: { detail: EventDetail }) {
  const isTreasurer = detail.me.can['settlement.close'];
  return (
    <>
      <MyBalance eventId={detail.event.id} />
      <DepositSection detail={detail} />
      {(isTreasurer || detail.me.can['deposit.configure']) && <TreasurerPanel detail={detail} />}
      <ExpensesSection detail={detail} />
      <SettlementSection detail={detail} />
    </>
  );
}
