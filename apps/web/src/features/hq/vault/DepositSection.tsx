import type { EventDetail } from '@role/contracts';
import { CopyButton, Countdown } from '../../../components/misc';
import { IconCheck, IconClip, IconClock } from '../../../components/icons';
import { FileButton } from '../../../components/FileButton';
import { api } from '../../../lib/api';
import { formatBRL, formatDateTime } from '../../../lib/format';
import { eventKeys, useAction } from '../../../lib/queries';

/** Janela do Sinal, do ponto de vista de quem precisa pagar (RN-10 a RN-14). */
export function DepositSection({ detail }: { detail: EventDetail }) {
  const { event, me, deposit } = detail;

  const upload = useAction((file: File) => api.upload(`/events/${event.id}/deposit/proof`, file), {
    invalidate: eventKeys(event.id, event.code),
    success: 'Comprovante enviado! O Tesoureiro vai conferir.',
  });

  if (!deposit.required) return null;

  if (!deposit.openedAt) {
    return (
      <section className="card p-5">
        <h2>Sinal por Pix</h2>
        <p className="mt-2 text-muted">
          Este rolê vai pedir {deposit.amountCents ? formatBRL(deposit.amountCents) : 'um sinal'}{' '}
          para garantir a vaga. A janela de pagamento abre quando o rolê for confirmado.
        </p>
      </section>
    );
  }

  // O Tesoureiro segura o dinheiro: não paga a si mesmo.
  if (me.can['deposit.review'] && me.depositStatus === 'approved') {
    return (
      <section className="card p-5">
        <h2>Sinal por Pix</h2>
        <p className="mt-2 text-muted">
          Você é quem recebe o sinal ({formatBRL(deposit.amountCents ?? 0)} por pessoa). Confira os
          comprovantes no painel do Tesoureiro, abaixo.
        </p>
      </section>
    );
  }

  if (me.participation !== 'in') return null;

  const status = me.depositStatus;
  const needsPayment = status === 'pending' || status === 'rejected' || status === 'waitlisted';

  return (
    <section className={`card space-y-3 p-5 ${needsPayment ? 'ring-2 ring-carimbo/50' : ''}`}>
      <h2>Seu sinal</h2>

      {status === 'approved' && (
        <p className="rounded-xl bg-ok-soft p-3 font-bold text-ok">
          <IconCheck size={18} /> Sinal aprovado. Sua vaga está garantida.
        </p>
      )}
      {status === 'submitted' && (
        <p className="rounded-xl bg-navy-soft p-3 font-bold text-navy-dark">
          <IconClock size={18} /> Comprovante em análise pelo Tesoureiro.
        </p>
      )}

      {needsPayment && (
        <>
          {status === 'rejected' && (
            <p className="rounded-xl bg-danger-soft p-3 text-sm font-bold text-danger">
              O Tesoureiro recusou o comprovante. O motivo está nos seus avisos. Envie outro.
            </p>
          )}
          {status === 'waitlisted' && (
            <p className="rounded-xl bg-danger-soft p-3 text-sm font-bold text-danger">
              O prazo acabou e você foi para a fila de espera. Envie o comprovante e avise o
              Tesoureiro para voltar à lista.
            </p>
          )}
          <p className="text-muted">
            Pague <strong className="text-ink">{formatBRL(deposit.amountCents ?? 0)}</strong> por
            Pix e anexe o comprovante para garantir cama e lugar no carro.
          </p>
          {deposit.pixKey && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-desk p-3">
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase text-muted">Chave Pix</p>
                <p className="truncate font-bold">{deposit.pixKey}</p>
              </div>
              <CopyButton value={deposit.pixKey} label="Copiar" />
            </div>
          )}
          {deposit.deadlineAt && (
            <p className="text-sm font-bold text-warn">
              <IconClock size={15} /> <Countdown until={deposit.deadlineAt} prefix="Vence em" /> ·{' '}
              {formatDateTime(deposit.deadlineAt)}
            </p>
          )}
          <FileButton
            label={
              <>
                <IconClip size={16} /> Anexar comprovante
              </>
            }
            variant="primary"
            block
            loading={upload.isPending}
            onFile={(f) => upload.mutate(f)}
          />
        </>
      )}
    </section>
  );
}
