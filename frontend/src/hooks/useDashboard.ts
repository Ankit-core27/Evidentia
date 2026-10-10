// dashboard router: agency-wide counts and alerts.
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Alert, Dashboard } from '@/types/api';
import { queryKeys } from './queryKeys';

export const useDashboard = () =>
  useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: ({ signal }) => api.get<Dashboard>('/dashboard', undefined, signal)
  });

export const useAlerts = () =>
  useQuery({
    queryKey: queryKeys.alerts,
    queryFn: ({ signal }) => api.get<Alert[]>('/alerts', undefined, signal),
    refetchInterval: 60_000
  });
