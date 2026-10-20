import type { EventDetail } from '@role/contracts';
import { useState, type FormEvent } from 'react';
import { IconReceipt } from '../../../components/icons';
import { Button } from '../../../components/Button';
import { Badge, Field, MoneyInput, Toggle } from '../../../components/misc';
import { ReasonSheet } from '../../../components/ReasonSheet';
import { api } from '../../../lib/api';
import { formatBRL, formatDateTime } from '../../../lib/format';
import { eventKeys, useAction, useDepositQueue } from '../../../lib/queries';

/** Painel do General do Tesouro (ou do Idealizador, enquanto o cargo está vago): sinal e comprovantes. */
export function TreasurerPanel({ detail }: { detail: EventDetail }) {
  const { event, me, deposit } = detail;
  const canConfigure =
    me.can['deposit.configure'] && (event.status === 'open' || event.status === 'confirmed');
  const canReview = me.can['deposit.review'] && !!deposit.openedAt;

  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2>Painel do Tesoureiro</h2>
        <p className="text-sm text-muted">
          {detail.roles.find((r) => r.role === 'treasury')?.user
            ? 'Você ocupa o cargo.'
            : 'O cargo está vago, então o Idealizador cobre.'}
        </p>
      </div>
      {canConfigure && <DepositConfig detail={detail} />}
      {canReview && <ProofQueue detail={detail} />}
    </section>
  );
}

function DepositConfig({ detail }: { detail: EventDetail }) {
  const { event, deposit } = detail;
  const locked = !!deposit.openedAt;

  const [required, setRequired] = useState(deposit.required);
  const [amount, setAmount] = useState<number | null>(deposit.amountCents);
  const [pix, setPix] = useState(deposit.pixKey ?? '');
  const [deadline, setDeadline] = useState('');

  const save = useAction((body: object) => api.put(`/events/${event.id}/deposit`, body), {
    invalidate: eventKeys(event.id, event.code),
    success: 'Sinal configurado',
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({
      required,
      ...(required && amount !== null ? { amountCents: amount } : {}),
      ...(required && pix ? { pixKey: pix.trim() } : {}),
      ...(deadline ? { deadlineAt: new Date(deadline).toISOString() } : {}),
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-desk p-4">
      <h3 className="text-base">Sinal por Pix</h3>
      {!locked && (
        <Toggle
          checked={required}
          onChange={setRequired}
          label="Exigir sinal"
          hint="Só garante a vaga quem enviar o comprovante."
        />
      )}
      {locked && (
        <p className="text-sm text-muted">
          Janela aberta: {formatBRL(deposit.amountCents ?? 0)} por pessoa, prazo{' '}
          {deposit.deadlineAt ? formatDateTime(deposit.deadlineAt) : '—'}. O valor não muda depois
          que o pessoal começa a pagar.
        </p>
      )}
      {required && !locked && (
        <>
          <Field label="Valor por pessoa">
            <MoneyInput value={amount} onChange={setAmount} placeholder="50,00" />
          </Field>
          <Field label="Chave Pix para receber">
            <input
              className="field"
              value={pix}
              onChange={(e) => setPix(e.target.value)}
              maxLength={140}
            />
          </Field>
        </>
      )}
      {required && (
        <Field
          label={locked ? 'Estender o prazo' : 'Prazo do sinal (opcional)'}
          hint={locked ? undefined : 'Sem prazo definido, são 48h a partir da confirmação do rolê.'}
        >
          <input
            className="field"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </Field>
      )}
      <Button
        type="submit"
        size="sm"
        loading={save.isPending}
        disabled={required && !locked && (amount === null || pix.trim().length < 3)}
      >
        Salvar
      </Button>
    </form>
  );
}

const statusBadge = {
  none: <Badge>—</Badge>,
  pending: <Badge tone="warn">Não pagou</Badge>,
  submitted: <Badge tone="info">Aguardando você</Badge>,
  approved: <Badge tone="ok">Aprovado</Badge>,
  rejected: <Badge tone="danger">Recusado</Badge>,
  waitlisted: <Badge tone="danger">Fila de espera</Badge>,
} as const;

function ProofQueue({ detail }: { detail: EventDetail }) {
  const { event } = detail;
  const { data, isPending } = useDepositQueue(event.id, true);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const invalidate = eventKeys(event.id, event.code);

  const approve = useAction(
    (userId: string) =>
      api.post(`/events/${event.id}/deposits/${userId}/review`, { decision: 'approve' }),
    { invalidate, success: 'Sinal aprovado' },
  );
  const reject = useAction(
    (v: { userId: string; reason: string }) =>
      api.post(`/events/${event.id}/deposits/${v.userId}/review`, {
        decision: 'reject',
        reason: v.reason,
      }),
    { invalidate, success: 'Comprovante recusado', onSuccess: () => setRejecting(null) },
  );

  const paid = data?.filter((d) => d.status === 'approved').length ?? 0;

  return (
    <div className="space-y-3">
      <h3 className="text-base">
        Comprovantes{' '}
        {data && (
          <span className="text-muted">
            ({paid}/{data.length} aprovados)
          </span>
        )}
      </h3>
      {isPending && <p className="text-muted">Carregando…</p>}
      <ul className="divide-y divide-line">
        {data?.map((d) => (
          <li key={d.user.id} className="space-y-2 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold">{d.user.name}</p>
                {d.submittedAt && (
                  <p className="text-xs text-muted">Enviado {formatDateTime(d.submittedAt)}</p>
                )}
                {d.rejectReason && (
                  <p className="text-xs text-danger">Recusado: {d.rejectReason}</p>
                )}
              </div>
              {statusBadge[d.status]}
            </div>
            {d.hasProof && (
              <div className="flex flex-wrap gap-2">
                <a
                  className="inline-flex min-h-9 items-center rounded-xl bg-navy-soft px-3 text-sm font-bold text-navy-dark"
                  href={`/api/events/${event.id}/deposits/${d.user.id}/proof`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IconReceipt size={15} /> Ver comprovante
                </a>
                {d.status === 'submitted' && (
                  <>
                    <Button
                      size="sm"
                      loading={approve.isPending && approve.variables === d.user.id}
                      onClick={() => approve.mutate(d.user.id)}
                    >
                      Aprovar
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setRejecting(d.user.id)}>
                      Recusar
                    </Button>
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      <ReasonSheet
        open={!!rejecting}
        title="Recusar comprovante"
        label="Por quê? (a pessoa vai ler isso)"
        submitLabel="Recusar comprovante"
        loading={reject.isPending}
        onClose={() => setRejecting(null)}
        onSubmit={(reason) => rejecting && reject.mutate({ userId: rejecting, reason })}
      />
    </div>
  );
}
