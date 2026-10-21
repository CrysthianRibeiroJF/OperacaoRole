import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type {
  CrewDto,
  CrewPreview,
  DepositQueueItem,
  FleetDto,
  MissionReportDto,
  PanelDto,
  MutedEventDto,
  PackingDto,
  PhotosDto,
  PollDto,
  PollSummaryDto,
  RoomsDto,
  TracksDto,
  TransportDto,
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
  refunds: (id: string) => ['refunds', id] as const,
  supplies: (id: string) => ['supplies', id] as const,
  fleet: (id: string) => ['fleet', id] as const,
  rooms: (id: string) => ['rooms', id] as const,
  photos: (id: string) => ['photos', id] as const,
  packing: (id: string) => ['packing', id] as const,
  tracks: (id: string) => ['tracks', id] as const,
  report: (id: string) => ['report', id] as const,
  panel: (id: string) => ['panel', id] as const,
  transport: (id: string) => ['transport', id] as const,
  polls: ['polls'] as const,
  poll: (code: string) => ['poll', code] as const,
  crews: ['crews'] as const,
  crewPreview: (code: string) => ['crew-preview', code] as const,
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

export const usePhotos = (id: string) =>
  useQuery({
    queryKey: keys.photos(id),
    queryFn: () => api.get<PhotosDto>(`/events/${id}/photos`),
  });

export const usePacking = (id: string) =>
  useQuery({
    queryKey: keys.packing(id),
    queryFn: () => api.get<PackingDto>(`/events/${id}/packing`),
  });

export const useTracks = (id: string) =>
  useQuery({
    queryKey: keys.tracks(id),
    queryFn: () => api.get<TracksDto>(`/events/${id}/tracks`),
  });

export const useReport = (id: string) =>
  useQuery({
    queryKey: keys.report(id),
    queryFn: () => api.get<MissionReportDto>(`/events/${id}/report`),
    retry: false,
  });

export const usePanel = (id: string) =>
  useQuery({
    queryKey: keys.panel(id),
    queryFn: () => api.get<PanelDto>(`/events/${id}/panel`),
    refetchInterval: 30_000,
    retry: false,
  });

export const useTransport = (id: string) =>
  useQuery({
    queryKey: keys.transport(id),
    queryFn: () => api.get<TransportDto>(`/events/${id}/transport`),
  });

export const usePolls = () =>
  useQuery({ queryKey: keys.polls, queryFn: () => api.get<PollSummaryDto[]>('/polls') });

export const usePoll = (code: string) =>
  useQuery({
    queryKey: keys.poll(code),
    queryFn: () => api.get<PollDto>(`/polls/${code}`),
    refetchInterval: 15_000,
    retry: false,
  });

export const useCrews = () =>
  useQuery({ queryKey: keys.crews, queryFn: () => api.get<CrewDto[]>('/crews') });

export const useCrewPreview = (code: string) =>
  useQuery({
    queryKey: keys.crewPreview(code),
    queryFn: () => api.get<CrewPreview>(`/crews/code/${code}`),
    retry: false,
  });

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
  keys.photos(id),
  keys.packing(id),
  keys.tracks(id),
  keys.report(id),
  keys.panel(id),
  keys.transport(id),
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
