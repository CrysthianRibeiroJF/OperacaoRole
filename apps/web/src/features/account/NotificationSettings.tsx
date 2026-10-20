import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_INFO,
  type NotificationCategory,
} from '@role/domain';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { IconBellOff } from '../../components/icons';
import { Skeleton, Toggle } from '../../components/misc';
import { api } from '../../lib/api';
import { keys, useAction, useMutedEvents, useNotificationPrefs } from '../../lib/queries';
import { AccountPage } from './AccountLayout';

/** Avisos são todos internos: chegam na aba Avisos. Aqui a pessoa escolhe o que quer ver. */
export function NotificationSettings() {
  const prefs = useNotificationPrefs();
  const muted = useMutedEvents();

  const save = useAction(
    (v: { category: NotificationCategory; enabled: boolean }) =>
      api.put('/me/notification-prefs', { categories: { [v.category]: v.enabled } }),
    { invalidate: [keys.notifPrefs] },
  );
  const unmute = useAction((id: string) => api.put(`/events/${id}/mute`, { muted: false }), {
    invalidate: [keys.mutedEvents],
    success: 'Avisos reativados',
  });

  return (
    <AccountPage
      title="Avisos"
      intro="Tudo chega aqui dentro do app, na aba Avisos. Não enviamos SMS, WhatsApp nem e-mail."
    >
      <section className="card divide-y divide-line px-4">
        {prefs.isPending && <Skeleton rows={2} />}
        {prefs.data &&
          NOTIFICATION_CATEGORIES.map((category) => (
            <div key={category} className="py-1.5">
              <Toggle
                label={NOTIFICATION_CATEGORY_INFO[category].label}
                hint={NOTIFICATION_CATEGORY_INFO[category].hint}
                checked={prefs.data.categories[category]}
                disabled={save.isPending && save.variables?.category === category}
                onChange={(enabled) => save.mutate({ category, enabled })}
              />
            </div>
          ))}
      </section>

      <section className="space-y-3">
        <h2>Rolês silenciados</h2>
        {muted.data && muted.data.length === 0 && (
          <p className="card p-4 text-sm text-muted">
            Nenhum rolê silenciado. Para silenciar um, abra o QG dele e toque em Avisos.
          </p>
        )}
        {muted.data && muted.data.length > 0 && (
          <ul className="card divide-y divide-line">
            {muted.data.map((e) => (
              <li key={e.id} className="flex items-center gap-3 p-3.5">
                <span className="text-muted">
                  <IconBellOff size={20} />
                </span>
                <Link to={`/role/${e.id}`} className="min-w-0 flex-1 truncate font-bold">
                  {e.title}
                </Link>
                <Button
                  size="sm"
                  variant="soft"
                  loading={unmute.isPending && unmute.variables === e.id}
                  onClick={() => unmute.mutate(e.id)}
                >
                  Reativar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AccountPage>
  );
}
