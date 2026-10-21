import { useQuery } from '@tanstack/react-query';
import type { PixPaymentDto } from '@role/contracts';
import { useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { formatBRL } from '../lib/format';
import { Button } from './Button';
import { CopyButton } from './misc';
import { Sheet } from './Sheet';

/**
 * "Pagar com Pix": busca o código Pix copia e cola com o valor e a chave certos. O app só entrega o
 * texto para colar no banco; o dinheiro nunca passa por aqui (D-003).
 */
export function PixPayButton({
  path,
  label = 'Pagar com Pix',
  variant = 'primary',
}: {
  /** Rota da API que devolve o `PixPaymentDto` (acerto ou sinal). */
  path: string;
  label?: string;
  variant?: 'primary' | 'secondary' | 'soft';
}) {
  const [open, setOpen] = useState(false);
  const pix = useQuery({
    queryKey: ['pix', path],
    queryFn: () => api.get<PixPaymentDto>(path),
    enabled: open,
    staleTime: 0,
    retry: false,
  });

  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Sheet open={open} title="Pix copia e cola" onClose={() => setOpen(false)}>
        {pix.isPending && (
          <div
            className="h-32 animate-pulse rounded-xl bg-desk-deep"
            aria-label="Gerando o código"
          />
        )}
        {pix.isError && (
          <p className="rounded-xl bg-danger-soft p-3 text-sm font-bold text-danger">
            {errorMessage(pix.error)}
          </p>
        )}
        {pix.data && <PixDetails pix={pix.data} />}
      </Sheet>
    </>
  );
}

function PixDetails({ pix }: { pix: PixPaymentDto }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-navy-soft p-4 text-center">
        <p className="text-sm text-navy-dark">Você paga a {pix.payee.name}</p>
        <p className="mono mt-1 text-3xl font-semibold">{formatBRL(pix.amountCents)}</p>
      </div>

      <ol className="list-decimal space-y-1.5 pl-5 text-sm">
        <li>Toque em copiar abaixo.</li>
        <li>
          No app do seu banco, abra <strong>Pix</strong> e escolha <strong>Pix Copia e Cola</strong>
          .
        </li>
        <li>
          Cole o código e confira nome e valor antes de confirmar. Depois, avise por aqui que pagou.
        </li>
      </ol>

      <textarea
        readOnly
        rows={4}
        value={pix.payload}
        aria-label="Código Pix copia e cola"
        className="field mono w-full resize-none text-xs"
        onFocus={(e) => e.currentTarget.select()}
      />
      <CopyButton value={pix.payload} label="Copiar Pix copia e cola" />

      <p className="text-xs text-muted">
        Chave: <strong className="text-ink">{pix.key}</strong>. O app só monta o código: o Pix sai
        direto da sua conta para a de {pix.payee.name}.
      </p>
    </div>
  );
}
