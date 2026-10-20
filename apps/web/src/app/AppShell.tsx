import { useEffect, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { IconBell, IconFlag, IconPlus, IconUser, Swallow } from '../components/icons';
import { Avatar } from '../components/misc';
import { useNotifications, useSession } from '../lib/queries';

const tabs: { to: string; label: string; icon: ReactNode; end: boolean }[] = [
  { to: '/', label: 'Rolês', icon: <IconFlag size={22} />, end: true },
  { to: '/avisos', label: 'Avisos', icon: <IconBell size={22} />, end: false },
  { to: '/perfil', label: 'Conta', icon: <IconUser size={22} />, end: false },
];

/** Telas públicas e de leitura longa: sem navegação, em coluna estreita. */
const BARE_PREFIXES = ['/c/', '/termos', '/privacidade'];

/**
 * Casca do app. Celular e tablet: navegação na base. Desktop (a partir de 1024 px): menu lateral
 * fixo, conteúdo mais largo e o atalho "Novo rolê" sempre à mão.
 */
export function AppShell() {
  const { data } = useSession();
  const profile = data?.profile;
  const { pathname } = useLocation();
  const showNav = !!profile && !BARE_PREFIXES.some((p) => pathname.startsWith(p));

  return (
    <div className={showNav ? 'lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]' : ''}>
      {showNav && <SideNav name={profile.name} id={profile.id} />}
      <div className="mx-auto min-h-dvh w-full max-w-xl md:max-w-2xl lg:max-w-4xl">
        <main className={`px-4 pt-6 lg:px-8 lg:pt-10 ${showNav ? 'pb-32 lg:pb-14' : 'pb-12'}`}>
          <Outlet />
        </main>
      </div>
      {showNav && <BottomNav />}
      {showNav && <TitleBadge />}
    </div>
  );
}

/** Como tudo é interno, a aba do navegador também avisa quando há novidade. */
function TitleBadge() {
  const { data } = useNotifications();
  const unread = data?.unread ?? 0;
  useEffect(() => {
    document.title = unread > 0 ? '(' + unread + ') Operação Rolê' : 'Operação Rolê';
    return () => {
      document.title = 'Operação Rolê';
    };
  }, [unread]);
  return null;
}

function UnreadDot({ count, ring }: { count: number; ring: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={`mono absolute -right-0.5 -top-1 grid min-w-5 place-items-center rounded-full bg-carimbo px-1 text-[11px] font-semibold leading-5 text-white ring-2 ${ring}`}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}

function SideNav({ name, id }: { name: string; id: string }) {
  const { data } = useNotifications();
  const unread = data?.unread ?? 0;

  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line bg-surface/80 px-4 py-6 backdrop-blur lg:flex">
      <Link to="/" className="flex items-center gap-2.5 px-2">
        <span className="grid size-9 place-items-center rounded-full bg-sol text-on-sol">
          <Swallow size={20} />
        </span>
        <span className="font-display text-[1.5rem] font-extrabold uppercase leading-none">
          Operação Rolê
        </span>
      </Link>

      <Link
        to="/novo"
        className="key inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] bg-sol px-4 font-bold text-on-sol [--key-edge:var(--color-sol-dark)] hover:brightness-105"
      >
        <IconPlus size={18} /> Novo rolê
      </Link>

      <nav aria-label="Navegação principal" className="flex-1">
        <ul className="space-y-1">
          {tabs.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-[10px] px-3 font-bold transition-colors ${
                    isActive
                      ? 'bg-ink text-surface'
                      : 'text-muted hover:bg-desk-deep hover:text-ink'
                  }`
                }
              >
                <span className="relative">
                  {t.icon}
                  {t.to === '/avisos' && <UnreadDot count={unread} ring="ring-surface" />}
                </span>
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Link
        to="/perfil"
        className="flex items-center gap-2.5 rounded-[10px] px-2 py-2 hover:bg-desk-deep"
      >
        <Avatar user={{ id, name }} size={34} />
        <span className="min-w-0 truncate text-sm font-bold">{name}</span>
      </Link>
    </aside>
  );
}

function BottomNav() {
  const { data } = useNotifications();
  const unread = data?.unread ?? 0;

  return (
    <nav
      aria-label="Navegação principal"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-xl px-2 pt-1.5 md:max-w-2xl">
        {tabs.map((t) => (
          <li key={t.to} className="flex-1">
            <NavLink
              to={t.to}
              end={t.end}
              className="group flex flex-col items-center gap-0.5 py-1"
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`relative grid h-8 w-14 place-items-center rounded-full transition-colors ${
                      isActive ? 'bg-sol text-on-sol' : 'text-muted group-hover:bg-desk-deep'
                    }`}
                  >
                    {t.icon}
                    {t.to === '/avisos' && <UnreadDot count={unread} ring="ring-surface" />}
                  </span>
                  <span
                    className={`text-[11px] font-bold tracking-wide ${isActive ? 'text-ink' : 'text-muted'}`}
                  >
                    {t.label}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
