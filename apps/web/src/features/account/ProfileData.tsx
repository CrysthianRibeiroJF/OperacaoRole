import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Field, Skeleton } from '../../components/misc';
import { api } from '../../lib/api';
import { formatPhone } from '../../lib/format';
import { keys, useAction, useSession } from '../../lib/queries';
import { AccountPage } from './AccountLayout';

export function ProfileData() {
  const { data, isPending } = useSession();
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
    { invalidate: [keys.session], success: 'Dados salvos' },
  );

  if (isPending || !profile) return <Skeleton rows={2} />;
  const dirty = name.trim() !== profile.name || pixKey.trim() !== (profile.pixKey ?? '');

  return (
    <AccountPage title="Dados pessoais" intro="É assim que o grupo te vê e te paga.">
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
            autoComplete="name"
          />
        </Field>
        <Field label="Celular" hint="É o seu acesso ao app. Não dá para trocar por aqui ainda.">
          <input className="field mono" value={formatPhone(profile.phone)} readOnly disabled />
        </Field>
        <Field
          label="Chave Pix"
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
        <Button
          type="submit"
          loading={save.isPending}
          disabled={!dirty || name.trim().length < 2}
          block
        >
          Salvar
        </Button>
      </form>
    </AccountPage>
  );
}
