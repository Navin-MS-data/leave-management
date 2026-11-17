import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type {
  CalendarResponse,
  LeaveRequest,
  LeaveType,
  PreviewResult,
  PublicHoliday,
  RequestStatus,
  Settings,
  User,
  UserBalance,
} from './types';

export interface RequestInput {
  leaveTypeId: number;
  startDate: string;
  endDate: string;
}

export const useLeaveTypes = () => useQuery({ queryKey: ['leave-types'], queryFn: () => api.get<LeaveType[]>('/leave-types') });

export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: () => api.get<Settings>('/settings') });

export const useHolidays = (year: number) =>
  useQuery({ queryKey: ['holidays', year], queryFn: () => api.get<PublicHoliday[]>(`/holidays?year=${year}`) });

export const useMyBalance = (year: number, enabled = true) =>
  useQuery({
    queryKey: ['balances', 'me', year],
    queryFn: () => api.get<UserBalance>(`/balances/me?year=${year}`),
    enabled,
  });

export const useTeamBalances = (year: number) =>
  useQuery({ queryKey: ['balances', 'team', year], queryFn: () => api.get<UserBalance[]>(`/balances/team?year=${year}`) });

export const useMyRequests = (enabled = true) =>
  useQuery({ queryKey: ['requests', 'mine'], queryFn: () => api.get<LeaveRequest[]>('/leave-requests/mine'), enabled });

export const useInbox = (status: RequestStatus | 'all', enabled = true) =>
  useQuery({
    queryKey: ['inbox', status],
    queryFn: () => api.get<LeaveRequest[]>(`/leave-requests/inbox?status=${status}`),
    enabled,
  });

export const useCalendar = (from: string, to: string, enabled = true) =>
  useQuery({
    queryKey: ['calendar', from, to],
    queryFn: () => api.get<CalendarResponse>(`/calendar?from=${from}&to=${to}`),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useUsers = (enabled = true) =>
  useQuery({ queryKey: ['users'], queryFn: () => api.get<User[]>('/users'), enabled });

/** Dry run of every rule. Nothing is saved. */
export const usePreview = (input: RequestInput | null) =>
  useQuery({
    queryKey: ['preview', input],
    queryFn: () => api.post<PreviewResult>('/leave-requests/preview', input),
    enabled: input !== null,
    placeholderData: keepPreviousData,
    staleTime: 0,
    retry: false,
  });

/** After anything that changes requests, refresh everything that is derived from them. */
export function useRefreshLeaveData() {
  const client = useQueryClient();
  return () =>
    Promise.all(
      ['requests', 'balances', 'calendar', 'inbox', 'preview'].map((key) => client.invalidateQueries({ queryKey: [key] })),
    );
}

export function useCreateRequest() {
  const refresh = useRefreshLeaveData();
  return useMutation({
    mutationFn: (body: RequestInput & { reason: string }) => api.post<LeaveRequest>('/leave-requests', body),
    onSuccess: refresh,
  });
}

export function useCancelRequest() {
  const refresh = useRefreshLeaveData();
  return useMutation({
    mutationFn: (id: number) => api.patch<LeaveRequest>(`/leave-requests/${id}/cancel`),
    onSuccess: refresh,
  });
}

export function useDecideRequest() {
  const refresh = useRefreshLeaveData();
  return useMutation({
    mutationFn: ({ id, outcome, note }: { id: number; outcome: 'approve' | 'reject'; note?: string }) =>
      api.patch<LeaveRequest>(`/leave-requests/${id}/${outcome}`, note ? { note } : {}),
    // Report the decision as soon as the server has made it; the lists refresh behind it.
    // (Waiting here would hold the success callback back by a full round of refetches.)
    onSuccess: () => {
      void refresh();
    },
  });
}
