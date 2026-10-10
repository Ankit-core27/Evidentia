// timeline router: incident events.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CaseEvent, CaseEventCreate, CaseEventUpdate, EventCategory, Id } from '@/types/api';
import { invalidateCase, queryKeys } from './queryKeys';

export const useEvents = (caseId: Id | undefined, category?: EventCategory) =>
  useQuery({
    queryKey: queryKeys.events(caseId!, category),
    queryFn: ({ signal }) => api.get<CaseEvent[]>(`/cases/${caseId}/events`, { category }, signal),
    enabled: caseId !== undefined
  });

export const useCreateEvent = (caseId: Id) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CaseEventCreate) => api.post<CaseEvent>(`/cases/${caseId}/events`, input),
    onSuccess: () => invalidateCase(queryClient, caseId)
  });
};

export const useUpdateEvent = (caseId: Id) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: Id; input: CaseEventUpdate }) => api.patch<CaseEvent>(`/events/${id}`, input),
    onSuccess: () => invalidateCase(queryClient, caseId)
  });
};

export const useDeleteEvent = (caseId: Id) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => api.delete(`/events/${id}`),
    onSuccess: () => invalidateCase(queryClient, caseId)
  });
};
