import type { EventDetail } from '@role/contracts';
import { ErrorState, Skeleton } from '../../../components/misc';
import { usePanel } from '../../../lib/queries';
import { BasePanelCard, TreasuryPanelCard } from './BaseTreasuryCards';
import { FleetPanelCard } from './FleetPanelCard';
import { MineCard } from './MineCard';
import { OverviewCard } from './OverviewCard';
import { SuppliesPanelCard } from './SuppliesPanelCard';

/**
 * Aba Painel: muda conforme quem entra. O Idealizador vê tudo (visão geral e o painel de cada
 * General); cada General vê o painel do próprio cargo; quem não tem cargo vê o acompanhamento
 * pessoal. O servidor decide o que cada um recebe: o app só mostra o que veio.
 */
export function PanelTab({ detail }: { detail: EventDetail }) {
  const { data, isPending, isError, refetch } = usePanel(detail.event.id);

  if (isPending) return <Skeleton rows={3} />;
  if (isError) {
    return <ErrorState message="Não consegui montar o painel." onRetry={() => void refetch()} />;
  }

  const mine = <MineCard key="mine" data={data.mine} confirmed={detail.event.status !== 'open'} />;
  const hasPanels = data.overview || data.supplies || data.fleet || data.base || data.treasury;

  return (
    <>
      {/* Quem não comanda nada começa pelo próprio andamento; os demais, pela área de responsabilidade. */}
      {!hasPanels && mine}
      {data.overview && <OverviewCard overview={data.overview} />}
      {data.supplies && <SuppliesPanelCard data={data.supplies} />}
      {data.fleet && <FleetPanelCard data={data.fleet} />}
      {data.base && <BasePanelCard data={data.base} />}
      {data.treasury && <TreasuryPanelCard data={data.treasury} />}
      {hasPanels && mine}
    </>
  );
}
