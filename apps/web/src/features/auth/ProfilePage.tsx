import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { IconDownload, IconTrash, Swallow } from '../../components/icons';
import { Avatar, Field, Skeleton } from '../../components/misc';
import { Sheet } from '../../components/Sheet';
import { api } from '../../lib/api';
import { formatPhone } from '../../lib/format';
import { keys, useAction, useSession } from '../../lib/queries';
import { Ticket } from '../events/shared';

export function ProfilePage() {
  const { data, isPending } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const profile = data?.profile;

  const [name, setName] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setPixKey(profile.pixKey ?? '');
    }
  }, [profile]);

  const save = useAction(
    (v: { name: string; pixKey: string }) =>
      api.patch('/me', { name: v.name, pixKey: v.pixKey || null }),
    { invalidate: [keys.session], success: 'Perfil salvo' },
  );

  const remove = useAction(() => api.post('/me/delete', { confirm: 'EXCLUIR' }), {
    onSuccess: () => {
      qc.clear();
      navigate('/entrar', { replace: true });
    },
  });

  if (isPending || !profile) return <Skeleton rows={2} />;

  async function logout() {
    await api.post('/auth/logout');
    qc.clear();
    navigate('/entrar', { replace: true });
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Sua credencial</p>
        <h1 className="mt-2 text-[3rem]">Perfil</h1>
      </header>

      <Ticket
        night
        top={
          <div className="flex items-center gap-4 px-5 pb-6 pt-5">
            <Avatar user={profile} size={68} />
            <div className="min-w-0">
              <p className="font-display truncate text-[2rem] font-extrabold uppercase leading-none">
                {profile.name}
              </p>
              <p className="mono mt-2 text-sm text-white/70">{formatPhone(profile.phone)}</p>
            </div>
          </div>
        }
        bottom={
          <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-5">
            <span className="eyebrow">Tropa Operação Rolê</span>
            <span className="grid size-8 place-items-center rounded-full bg-sol text-on-sol">
              <Swallow size={19} />
            </span>
          </div>
        }
      />

      <form
        className="card space-y-4 p-5"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate({ name: name.trim(), pixKey: pixKey.trim() });
        }}
      >
        <Field label="Nome">
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={60}
          />
        </Field>
        <Field
          label="Sua chave Pix"
          hint="Aparece para quem precisa te pagar no acerto de contas. Só participantes do mesmo rolê veem."
        >
          <input
            className="field"
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            maxLength={140}
            placeholder="CPF, e-mail, telefone ou chave aleatória"
          />
        </Field>
        <Button type="submit" loading={save.isPending} block>
          Salvar
        </Button>
      </form>

      <section className="card space-y-3 p-5">
        <div>
          <h2>Seus dados</h2>
          <p className="mt-1 text-sm text-muted">
            Você pode baixar tudo o que guardamos sobre você ou excluir a conta.
          </p>
        </div>
        <a
          href="/api/me/export"
          download
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-navy-soft px-4 font-bold text-navy-dark hover:brightness-95"
        >
          <IconDownload size={18} /> Baixar meus dados
        </a>
        <Button variant="danger" block onClick={() => setDeleting(true)}>
          <IconTrash size={17} /> Excluir minha conta
        </Button>
      </section>

      <Button variant="ghost" block onClick={() => void logout()}>
        Sair da conta
      </Button>

      <Sheet
        open={deleting}
        title="Excluir a conta?"
        onClose={() => {
          setDeleting(false);
          setConfirmText('');
        }}
      >
        <div className="space-y-4">
          <p>
            Seu nome, telefone, chave Pix e comprovantes são apagados. Os valores lançados nos rolês
            de que você participou permanecem sem identificação, porque o resto do grupo precisa
            deles para fechar a conta.
          </p>
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
    </div>
  );
}
