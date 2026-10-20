import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { IconDownload, IconTrash } from '../../components/icons';
import { Field } from '../../components/misc';
import { Sheet } from '../../components/Sheet';
import { api } from '../../lib/api';
import { useAction } from '../../lib/queries';
import { AccountPage } from './AccountLayout';

export function PrivacySettings() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const remove = useAction(() => api.post('/me/delete', { confirm: 'EXCLUIR' }), {
    onSuccess: () => {
      qc.clear();
      navigate('/entrar', { replace: true });
    },
  });

  return (
    <AccountPage
      title="Privacidade e dados"
      intro="O que guardamos sobre você é seu: dá para baixar ou apagar."
    >
      <section className="card space-y-3 p-5">
        <div>
          <h2>Baixar meus dados</h2>
          <p className="mt-1 text-sm text-muted">
            Um arquivo com o seu perfil, os rolês de que participa, as despesas que você pagou e
            seus avisos.
          </p>
        </div>
        <a
          href="/api/me/export"
          download
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-navy-soft px-4 font-bold text-navy-dark hover:brightness-95"
        >
          <IconDownload size={18} /> Baixar meus dados
        </a>
      </section>

      <section className="card space-y-3 p-5">
        <div>
          <h2>Excluir minha conta</h2>
          <p className="mt-1 text-sm text-muted">
            Seu nome, celular, chave Pix e comprovantes são apagados. Os valores lançados nos rolês
            de que você participou ficam sem identificação, porque o resto do grupo precisa deles
            para fechar a conta.
          </p>
        </div>
        <Button variant="danger" block onClick={() => setDeleting(true)}>
          <IconTrash size={17} /> Excluir minha conta
        </Button>
      </section>

      <Sheet
        open={deleting}
        title="Excluir a conta?"
        onClose={() => {
          setDeleting(false);
          setConfirmText('');
        }}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Só é possível excluir sem rolês em andamento e sem acertos pendentes. Isso não pode ser
            desfeito.
          </p>
          <Field label="Digite EXCLUIR para confirmar">
            <input
              className="field"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Button
            variant="danger"
            block
            loading={remove.isPending}
            disabled={confirmText !== 'EXCLUIR'}
            onClick={() => remove.mutate(undefined)}
          >
            Excluir conta definitivamente
          </Button>
        </div>
      </Sheet>
    </AccountPage>
  );
}
