import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type {
  DepositQueueItem,
  FleetDto,
  MutedEventDto,
  RoomsDto,
  NotificationPrefsDto,
  SecurityOverview,
  SuppliesDto,
  EventDetail,
  ExpenseDto,
  FeedItem,
  InviteView,
  NotificationDto,
  ProfileDto,
  SettlementDto,
  VaultDto,
} from '@role/contracts';
import { useToast } from '../components/Toast';
import { api, errorMessage } from './api';

export const keys = {
  session: ['session'] as const,
  feed: ['feed'] as const,
  invite: (code: string) => ['invite', code] as const,
  event: (id: string) => ['event', id] as const,
  expenses: (id: string) => ['expenses', id] as const,
  settlement: (id: string) => ['settlement', id] as const,
  vault: (id: string) => ['vault', id] as const,
  deposits: (id: string) => ['deposits', id] as const,
  supplies: (id: string) => ['supplies', id] as const,
  fleet: (id: string) => ['fleet', id] as const,
  rooms: (id: string) => ['rooms', id] as const,
  notifications: ['notifications'] as const,
  security: ['security'] as const,
  notifPrefs: ['notif-prefs'] as const,
  mutedEvents: ['muted-events'] as const,
};

export const useSession = () =>
  useQuery({
    queryKey: keys.session,
    queryFn: () => api.get<{ profile: ProfileDto | null }>('/session'),
    staleTime: 60_000,
  });

export const useFeed = () =>
  useQuery({ queryKey: keys.feed, queryFn: () => api.get<FeedItem[]>('/events') });

export const useInvite = (code: string) =>
  useQuery({
    queryKey: keys.invite(code),
    queryFn: () => api.get<InviteView>(`/invites/${code}`),
    refetchInterval: 20_000,
    retry: false,
  });

export const useEventDetail = (id: string) =>
  useQuery({
    queryKey: keys.event(id),
    queryFn: () => api.get<EventDetail>(`/events/${id}`),
    refetchInterval: 20_000,
    retry: false,
  });

export const useExpenses = (id: string) =>
  useQuery({
    queryKey: keys.expenses(id),
    queryFn: () => api.get<ExpenseDto[]>(`/events/${id}/expenses`),
  });

export const useSettlement = (id: string) =>
  useQuery({
    queryKey: keys.settlement(id),
    queryFn: () => api.get<SettlementDto>(`/events/${id}/settlement`),
  });

export const useVault = (id: string) =>
  useQuery({ queryKey: keys.vault(id), queryFn: () => api.get<VaultDto>(`/events/${id}/vault`) });

export const useDepositQueue = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: keys.deposits(id),
    queryFn: () => api.get<DepositQueueItem[]>(`/events/${id}/deposits`),
    enabled,
  });

export const useSupplies = (id: string) =>
  useQuery({
    queryKey: keys.supplies(id),
    queryFn: () => api.get<SuppliesDto>(`/events/${id}/supplies`),
  });

export const useFleet = (id: string, enabled = true) =>
  useQuery({
    queryKey: keys.fleet(id),
    queryFn: () => api.get<FleetDto>(`/events/${id}/fleet`),
    enabled,
  });

export const useRooms = (id: string) =>
  useQuery({ queryKey: keys.rooms(id), queryFn: () => api.get<RoomsDto>(`/events/${id}/rooms`) });

export const useSecurity = () =>
  useQuery({ queryKey: keys.security, queryFn: () => api.get<SecurityOverview>('/me/security') });

export const useNotificationPrefs = () =>
  useQuery({
    queryKey: keys.notifPrefs,
    queryFn: () => api.get<NotificationPrefsDto>('/me/notification-prefs'),
  });

export const useMutedEvents = () =>
  useQuery({
    queryKey: keys.mutedEvents,
    queryFn: () => api.get<MutedEventDto[]>('/me/muted-events'),
  });

export const useNotifications = () =>
  useQuery({
    queryKey: keys.notifications,
    queryFn: () => api.get<{ items: NotificationDto[]; unread: number }>('/notifications'),
    refetchInterval: 30_000,
  });

/** Qualquer mudança em um rolê invalida tudo que depende dele (os dados são pequenos). */
export const eventKeys = (id: string, code?: string): QueryKey[] => [
  keys.event(id),
  keys.expenses(id),
  keys.settlement(id),
  keys.vault(id),
  keys.deposits(id),
  keys.supplies(id),
  keys.fleet(id),
  keys.rooms(id),
  keys.feed,
  keys.notifications,
  ...(code ? [keys.invite(code)] : []),
];

/** Mutação com toast de sucesso/erro e invalidação de cache padronizados. */
export function useAction<TArgs, TRes = unknown>(
  fn: (args: TArgs) => Promise<TRes>,
  opts: { invalidate?: QueryKey[]; success?: string; onSuccess?: (res: TRes) => void } = {},
) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (res) => {
      await Promise.all(
        (opts.invalidate ?? []).map((queryKey) => qc.invalidateQueries({ queryKey })),
      );
      if (opts.success) toast.ok(opts.success);
      opts.onSuccess?.(res);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}
