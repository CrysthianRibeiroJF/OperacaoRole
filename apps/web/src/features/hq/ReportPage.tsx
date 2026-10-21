import type { ExpenseCategory } from '@role/contracts';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { IconArrowLeft, IconDownload, IconShare } from '../../components/icons';
import { AvatarStack, Badge, ErrorState, Spinner } from '../../components/misc';
import { useToast } from '../../components/Toast';
import { ApiError } from '../../lib/api';
import { formatBRL, formatEventDates } from '../../lib/format';
import { renderReportImage, reportText } from '../../lib/reportImage';
import { useReport } from '../../lib/queries';
import { Ticket } from '../events/shared';
import { CATEGORY_LABELS } from './vault/labels';

const categoryLabel = (c: string) => CATEGORY_LABELS[c as ExpenseCategory] ?? c;

/** Relatório de Missão: o cartão do rolê para postar ou mandar no grupo. Só números do grupo, sem saldo de ninguém. */
export function ReportPage() {
  const { id = '' } = useParams();
  const { data: report, isPending, error, refetch } = useReport(id);
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (isPending) return <Spinner />;
  if (error || !report) {
    const notYet = error instanceof ApiError && (error.status === 409 || error.status === 403);
    return (
      <div className="space-y-4">
        <ErrorState
          message={notYet ? error.message : 'Não consegui montar o relatório.'}
          {...(notYet ? {} : { onRetry: () => void refetch() })}
        />
        <Link to={`/role/${id}`} className="block text-center font-bold text-navy-dark">
          Voltar ao QG
        </Link>
      </div>
    );
  }

  const text = reportText(report, categoryLabel);

  async function share(download: boolean) {
    if (!report) return;
    setBusy(true);
    try {
      const blob = await renderReportImage(report, categoryLabel);
      const file = new File(
        [blob],
        `missao-${report.event.title.toLowerCase().replace(/\W+/g, '-')}.png`,
        {
          type: 'image/png',
        },
      );
      if (!download && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      if (!download) {
        await navigator.clipboard.writeText(text).catch(() => undefined);
        toast.ok('Imagem salva. O texto foi copiado para colar junto.');
      }
    } catch (err) {
      // Cancelar o compartilhamento não é erro.
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        toast.error('Não consegui gerar a imagem. Tente de novo.');
      }
    } finally {
      setBusy(false);
    }
  }

  const max = Math.max(1, ...report.categories.map((c) => c.cents));

  return (
    <div className="mx-auto w-full max-w-xl space-y-5">
      <Link
        to={`/role/${id}?aba=mural`}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-navy-dark"
      >
        <IconArrowLeft size={16} /> Voltar ao QG
      </Link>

      <Ticket
        night
        top={
          <div className="px-5 pb-6 pt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="eyebrow !text-white/55">Relatório de Missão</span>
              <Badge tone={report.final ? 'ok' : 'sun'}>
                {report.final ? 'Conta fechada' : 'Parcial'}
              </Badge>
            </div>
            <p className="font-display mt-3 text-[2.4rem] font-extrabold uppercase leading-[0.95]">
              {report.event.title}
            </p>
            <p className="mt-2 font-bold text-sol">{report.event.destination}</p>
            <p className="text-sm text-white/70">
              {formatEventDates(report.event.startDate, report.event.endDate)}
            </p>
          </div>
        }
        bottom={
          <div className="space-y-4 px-5 pb-5 pt-5">
            <div>
              <p className="eyebrow">Custou por cabeça</p>
              <p className="mono mt-1 text-[2.6rem] font-semibold leading-none">
                {formatBRL(report.perHeadCents)}
              </p>
              <p className="mt-1 text-sm text-muted">
                {formatBRL(report.perDayPerHeadCents)} por dia
              </p>
              {report.payingCount !== report.headcount && (
                <p className="mt-1 text-xs text-muted">
                  Dividido por {report.payingCount} cotas: criança é isenta.
                </p>
              )}
            </div>
            <dl className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Pessoas" value={String(report.headcount)} />
              <Stat label={report.days === 1 ? 'Dia' : 'Dias'} value={String(report.days)} />
              <Stat label="Despesas" value={String(report.expenseCount)} />
            </dl>
            <p className="text-sm text-muted">
              Total do grupo: <strong className="text-ink">{formatBRL(report.totalCents)}</strong>
            </p>
          </div>
        }
      />

      {!report.final && (
        <p className="rounded-xl bg-sol-soft p-3 text-sm font-bold text-sol-ink">
          Números parciais: o Tesoureiro ainda não fechou a conta. O cartão final sai depois do
          fechamento.
        </p>
      )}

      {(report.topPayer || report.biggestExpense || report.topCategory) && (
        <section className="card space-y-3 p-5">
          <h2>Curiosidades</h2>
          <ul className="space-y-2 text-sm">
            {report.topPayer && (
              <li>
                <strong>{report.topPayer.user.name}</strong> foi quem mais adiantou dinheiro pelo
                grupo ({formatBRL(report.topPayer.amountCents)}). Merece um brinde.
              </li>
            )}
            {report.biggestExpense && (
              <li>
                A maior despesa foi <strong>{report.biggestExpense.description}</strong>,{' '}
                {formatBRL(report.biggestExpense.amountCents)}.
              </li>
            )}
            {report.topCategory && (
              <li>
                Onde mais gastamos: <strong>{categoryLabel(report.topCategory.category)}</strong> (
                {Math.round((report.topCategory.cents / Math.max(1, report.totalCents)) * 100)}% do
                total).
              </li>
            )}
          </ul>
        </section>
      )}

      {report.categories.length > 0 && (
        <section className="card space-y-3 p-5">
          <h2>Para onde foi o dinheiro</h2>
          <ul className="space-y-2.5">
            {report.categories.map((c) => (
              <li key={c.category}>
                <div className="flex justify-between text-sm">
                  <span className="font-bold">{categoryLabel(c.category)}</span>
                  <span className="mono">{formatBRL(c.cents)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-desk-deep" aria-hidden>
                  <div
                    className="h-full rounded-full bg-navy"
                    style={{ width: `${(c.cents / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card space-y-2 p-5">
        <h2>A tropa</h2>
        <AvatarStack users={report.participants} max={10} />
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Button loading={busy} onClick={() => void share(false)}>
          <IconShare size={18} /> Compartilhar
        </Button>
        <Button variant="soft" loading={busy} onClick={() => void share(true)}>
          <IconDownload size={18} /> Baixar imagem
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-desk-deep p-3">
      <dd className="mono text-xl font-semibold">{value}</dd>
      <dt className="text-xs text-muted">{label}</dt>
    </div>
  );
}
