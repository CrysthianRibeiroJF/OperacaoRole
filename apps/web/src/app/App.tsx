import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Spinner } from '../components/misc';
import { LoginPage } from '../features/auth/LoginPage';
import { RequireAuth } from '../features/auth/RequireAuth';
import { FeedPage } from '../features/feed/FeedPage';
import { InvitePage } from '../features/events/InvitePage';
import { PrivacyPage, TermsPage } from '../features/legal/LegalPages';
import { AppShell } from './AppShell';

// O QG concentra a maior parte do código (cofre, despesas, acerto): carrega sob demanda.
const CreateEventPage = lazy(() =>
  import('../features/events/CreateEventPage').then((m) => ({ default: m.CreateEventPage })),
);
const HqPage = lazy(() => import('../features/hq/HqPage').then((m) => ({ default: m.HqPage })));
const NotificationsPage = lazy(() =>
  import('../features/notifications/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  })),
);
const AccountHub = lazy(() =>
  import('../features/account/AccountHub').then((m) => ({ default: m.AccountHub })),
);
const ProfileData = lazy(() =>
  import('../features/account/ProfileData').then((m) => ({ default: m.ProfileData })),
);
const NotificationSettings = lazy(() =>
  import('../features/account/NotificationSettings').then((m) => ({
    default: m.NotificationSettings,
  })),
);
const SecuritySettings = lazy(() =>
  import('../features/account/SecuritySettings').then((m) => ({ default: m.SecuritySettings })),
);
const PrivacySettings = lazy(() =>
  import('../features/account/PrivacySettings').then((m) => ({ default: m.PrivacySettings })),
);

export function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/entrar" element={<LoginPage />} />
        {/* O convite é público: abre sem login, em modo Observador. */}
        <Route element={<AppShell />}>
          <Route path="/c/:code" element={<InvitePage />} />
          <Route path="/termos" element={<TermsPage />} />
          <Route path="/privacidade" element={<PrivacyPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<FeedPage />} />
            <Route path="/novo" element={<CreateEventPage />} />
            <Route path="/role/:id" element={<HqPage />} />
            <Route path="/avisos" element={<NotificationsPage />} />
            <Route path="/perfil" element={<AccountHub />} />
            <Route path="/perfil/dados" element={<ProfileData />} />
            <Route path="/perfil/avisos" element={<NotificationSettings />} />
            <Route path="/perfil/seguranca" element={<SecuritySettings />} />
            <Route path="/perfil/privacidade" element={<PrivacySettings />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
