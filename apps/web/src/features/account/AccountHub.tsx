import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import {
  IconBell,
  IconKey,
  IconReceipt,
  IconUser,
  IconUsers,
  Swallow,
} from '../../components/icons';
import { Avatar, Skeleton } from '../../components/misc';
import { api } from '../../lib/api';
import { formatPhone } from '../../lib/format';
import { useNotificationPrefs, useSecurity, useSession } from '../../lib/queries';
import { Ticket } from '../events/shared';

function Row({
  to,
  icon,
  title,
  hint,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <li>
      <Link
        to={to}
        className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-desk-deep/60 active:bg-desk-deep"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-navy-soft text-navy-dark">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold">{title}</span>
          <span className="block truncate text-sm text-muted">{hint}</span>
        </span>
        <span className="text-xl text-muted" aria-hidden>
          ›
        </span>
      </Link>
    </li>
  );
}

/** Central da conta: a credencial no topo e um menu direto para cada assunto. */
export function AccountHub() {
  const { data, isPending } = useSession();
  const security = useSecurity();
  const prefs = useNotificationPrefs();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const profile = data?.profile;

  if (isPending || !profile) return <Skeleton rows={2} />;

  const devices = security.data?.sessions.length;
  const enabled = prefs.data ? Object.values(prefs.data.categories).filter(Boolean).length : null;
  const total = prefs.data ? Object.keys(prefs.data.categories).length : null;

  async function logout() {
    await api.post('/auth/logout');
    qc.clear();
    navigate('/entrar', { replace: true });
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <header>
        <p className="eyebrow">Sua credencial</p>
        <h1 className="mt-2 text-[3rem]">Conta</h1>
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

      <ul className="card divide-y divide-line overflow-hidden">
        <Row
          to="/perfil/dados"
          icon={<IconUser size={20} />}
          title="Dados pessoais"
          hint={profile.pixKey ? 'Nome e chave Pix cadastrada' : 'Cadastre sua chave Pix'}
        />
        <Row
          to="/tropas"
          icon={<IconUsers size={20} />}
          title="Minhas tropas"
          hint="Grupos fixos de amigos para chamar de uma vez"
        />
        <Row
          to="/perfil/avisos"
          icon={<IconBell size={20} />}
          title="Avisos"
          hint={
            enabled !== null && total !== null
              ? enabled + ' de ' + total + ' categorias ligadas'
              : 'O que chega na aba Avisos'
          }
        />
        <Row
          to="/perfil/seguranca"
          icon={<IconKey size={20} />}
          title="Segurança e acessos"
          hint={
            devices
              ? devices + (devices === 1 ? ' aparelho conectado' : ' aparelhos conectados')
              : 'Senha, código de recuperação e aparelhos'
          }
        />
        <Row
          to="/perfil/privacidade"
          icon={<IconReceipt size={20} />}
          title="Privacidade e dados"
          hint="Baixar seus dados ou excluir a conta"
        />
      </ul>

      <Button variant="ghost" block onClick={() => void logout()}>
        Sair da conta
      </Button>
    </div>
  );
}
