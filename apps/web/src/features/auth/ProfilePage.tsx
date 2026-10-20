import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Avatar, Field, Spinner } from '../../components/misc';
import { api } from '../../lib/api';
import { formatPhone } from '../../lib/format';
import { keys, useAction, useSession } from '../../lib/queries';

export function ProfilePage() {
  const { data, isPending } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const profile = data?.profile;

  const [name, setName] = useState('');
  const [pixKey, setPixKey] = useState('');
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

  if (isPending || !profile) return <Spinner />;

  async function logout() {
    await api.post('/auth/logout');
    qc.clear();
    navigate('/entrar', { replace: true });
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-4">
        <Avatar user={profile} size={64} />
        <div>
          <h1>{profile.name}</h1>
          <p className="text-muted">{formatPhone(profile.phone)}</p>
        </div>
      </header>

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

      <Button variant="ghost" block onClick={() => void logout()}>
        Sair da conta
      </Button>
    </div>
  );
}
