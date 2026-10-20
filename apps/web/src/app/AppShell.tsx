import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { IconBell, IconFlag, IconUser } from '../components/icons';
import { useNotifications, useSession } from '../lib/queries';

const tabs: { to: string; label: string; icon: ReactNode; end: boolean }[] = [
  { to: '/', label: 'Rolês', icon: <IconFlag size={22} />, end: true },
  { to: '/avisos', label: 'Avisos', icon: <IconBell size={22} />, end: false },
  { to: '/perfil', label: 'Conta', icon: <IconUser size={22} />, end: false },
];

export function AppShell() {
  const { data } = useSession();
  const loggedIn = !!data?.profile;
  const { pathname } = useLocation();
  const showNav =
    loggedIn && !['/c/', '/termos', '/privacidade'].some((p) => pathname.startsWith(p));

  return (
    <div className="mx-auto min-h-dvh w-full max-w-xl">
      <main className={`px-4 pt-6 ${showNav ? 'pb-32' : 'pb-12'}`}>
        <Outlet />
      </main>
      {showNav && <BottomNav />}
    </div>
  );
}

function BottomNav() {
  const { data } = useNotifications();
  const unread = data?.unread ?? 0;

  // Como tudo é interno, a aba do navegador também avisa quando há novidade.
  useEffect(() => {
    document.title = unread > 0 ? '(' + unread + ') Operação Rolê' : 'Operação Rolê';
    return () => {
      document.title = 'Operação Rolê';
    };
  }, [unread]);

  return (
    <nav
      aria-label="Navegação principal"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-xl px-2 pt-1.5">
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
                    {t.to === '/avisos' && unread > 0 && (
                      <span className="mono absolute -right-0.5 -top-1 grid min-w-5 place-items-center rounded-full bg-carimbo px-1 text-[11px] font-semibold leading-5 text-white ring-2 ring-surface">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
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
