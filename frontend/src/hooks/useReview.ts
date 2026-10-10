// review router: the AI review queue (observations) and conflicting statements.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Conflict, ConflictUpdate, Id, Observation, ObservationUpdate, ReviewStatus } from '@/types/api';
import { invalidateCase, queryKeys } from './queryKeys';

export const useObservations = (caseId: Id | undefined, status?: ReviewStatus) =>
  useQuery({
    queryKey: queryKeys.observations(caseId!, status),
    queryFn: ({ signal }) => api.get<Observation[]>(`/cases/${caseId}/observations`, { status }, signal),
    enabled: caseId !== undefined
  });

/** Confirm, edit or reject an observation. */
export const useUpdateObservation = (caseId: Id) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: Id; input: ObservationUpdate }) =>
      api.patch<Observation>(`/observations/${id}`, input),
    onSuccess: () => invalidateCase(queryClient, caseId)
  });
};

export const useConflicts = (caseId: Id | undefined) =>
  useQuery({
    queryKey: queryKeys.conflicts(caseId!),
    queryFn: ({ signal }) => api.get<Conflict[]>(`/cases/${caseId}/conflicts`, undefined, signal),
    enabled: caseId !== undefined
  });

export const useUpdateConflict = (caseId: Id) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: Id; input: ConflictUpdate }) => api.patch<Conflict>(`/conflicts/${id}`, input),
    onSuccess: () => invalidateCase(queryClient, caseId)
  });
};
