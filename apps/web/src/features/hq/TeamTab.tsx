import type { EventDetail } from '@role/contracts';
import { ROLE_LABELS, type RoleKey } from '@role/domain';
import {
  IconBeer,
  IconCar,
  IconCart,
  IconDice,
  IconHome,
  IconLeaf,
  IconWallet,
} from '../../components/icons';
import { Button } from '../../components/Button';
import { Avatar, Badge } from '../../components/misc';
import { api } from '../../lib/api';
import { eventKeys, useAction } from '../../lib/queries';

const ROLE_INFO: Record<
  RoleKey,
  { icon: (p: { size?: number }) => React.ReactNode; duty: string }
> = {
  base: { icon: IconHome, duty: 'Garante o teto: endereço, Wi-Fi, regras da casa e quartos.' },
  fleet: { icon: IconCar, duty: 'Cuida dos carros, das caronas e da bagagem.' },
  supplies: {
    icon: IconCart,
    duty: 'Monta a lista de mercado e dá baixa no que foi comprado.',
  },
  treasury: { icon: IconWallet, duty: 'Valida o sinal e as notas, e fecha a conta no fim.' },
};

const depositBadge = {
  none: null,
  pending: <Badge tone="warn">Falta o sinal</Badge>,
  submitted: <Badge tone="info">Sinal em análise</Badge>,
  approved: <Badge tone="ok">Sinal ok</Badge>,
  rejected: <Badge tone="danger">Comprovante recusado</Badge>,
  waitlisted: <Badge tone="danger">Fila de espera</Badge>,
} as const;

export function TeamTab({ detail }: { detail: EventDetail }) {
  const { event, me, roles, roster, deposit } = detail;
  const invalidate = eventKeys(event.id, event.code);

  const claim = useAction(
    (role: RoleKey) => api.post(`/events/${event.id}/roles/claim`, { role }),
    {
      invalidate,
      success: 'Missão assumida!',
    },
  );
  const release = useAction(
    (role: RoleKey) => api.post(`/events/${event.id}/roles/release`, { role }),
    {
      invalidate,
      success: 'Você largou o cargo',
    },
  );
  const draw = useAction(() => api.post(`/events/${event.id}/roles/draw`), {
    invalidate,
    success: 'Cargos sorteados!',
  });

  const rolesOpen = event.status === 'confirmed';
  const vacant = roles.filter((r) => !r.user);

  return (
    <>
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2>Quem faz o quê</h2>
          {me.can['roles.draw'] && rolesOpen && vacant.length > 0 && (
            <Button
              size="sm"
              variant="soft"
              loading={draw.isPending}
              onClick={() => draw.mutate(undefined)}
            >
              <IconDice size={16} /> Sortear vagos
            </Button>
          )}
        </div>
        {!rolesOpen && (
          <p className="rounded-xl bg-desk-deep px-3 py-2 text-sm text-muted">
            {event.status === 'open'
              ? 'Os cargos abrem quando o rolê for confirmado.'
              : 'Os cargos ficam travados porque o rolê não está mais ativo.'}
          </p>
        )}

        {roles.map((r) => {
          const info = ROLE_INFO[r.role];
          const mine = r.user && me.roles.includes(r.role);
          return (
            <div key={r.role} className="card flex items-center gap-3 p-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-navy-soft text-navy-dark">
                <info.icon size={24} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base">{ROLE_LABELS[r.role]}</h3>
                <p className="text-sm text-muted">{info.duty}</p>
                {r.user ? (
                  <p className="mt-1.5 flex items-center gap-2 text-sm font-bold">
                    <Avatar user={r.user} size={24} /> {r.user.name}
                    {r.drawn && <Badge tone="sun">sorteado</Badge>}
                  </p>
                ) : (
                  <p className="mt-1.5 text-sm font-bold text-warn">
                    Vago{r.role === 'treasury' || r.role === 'base' ? ' · o Idealizador cobre' : ''}
                  </p>
                )}
              </div>
              {!r.user && rolesOpen && me.can['roles.claim'] && (
                <Button
                  size="sm"
                  loading={claim.isPending && claim.variables === r.role}
                  onClick={() => claim.mutate(r.role)}
                >
                  Assumir
                </Button>
              )}
              {mine && rolesOpen && (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={release.isPending && release.variables === r.role}
                  onClick={() => release.mutate(r.role)}
                >
                  Largar
                </Button>
              )}
            </div>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2>A tropa ({roster.length})</h2>
        <ul className="card divide-y divide-line">
          {roster.map((m) => (
            <li key={m.user.id} className="flex items-center gap-3 p-3.5">
              <Avatar user={m.user} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">
                  {m.user.name}
                  {m.user.id === event.organizer.id && (
                    <span className="ml-1.5 text-xs font-extrabold text-navy-dark">
                      Idealizador
                    </span>
                  )}
                </p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                  {m.roles.map((role) => (
                    <span key={role} className="inline-flex items-center gap-1">
                      {(() => {
                        const I = ROLE_INFO[role].icon;
                        return <I size={13} />;
                      })()}
                      {ROLE_LABELS[role].replace('General ', '')}
                    </span>
                  ))}
                  {m.drinksAlcohol && (
                    <span className="inline-flex items-center gap-1">
                      <IconBeer size={13} /> bebe
                    </span>
                  )}
                  {m.diet === 'vegetarian' && (
                    <span className="inline-flex items-center gap-1">
                      <IconLeaf size={13} /> vegetariano
                    </span>
                  )}
                </p>
              </div>
              {deposit.required && deposit.openedAt && depositBadge[m.depositStatus]}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
