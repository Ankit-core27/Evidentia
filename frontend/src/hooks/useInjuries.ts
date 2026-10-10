// injuries router (M5): injury markers for the anatomy view.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Id, Injury, InjuryCreate, InjuryUpdate } from '@/types/api';
import { invalidateCase, queryKeys } from './queryKeys';

export const useInjuries = (caseId: Id | undefined) =>
  useQuery({
    queryKey: queryKeys.injuries(caseId!),
    queryFn: ({ signal }) => api.get<Injury[]>(`/cases/${caseId}/injuries`, undefined, signal),
    enabled: caseId !== undefined
  });

/** Uses the proposed PATCH /api/injuries/{id} (see docs/FRONTEND_TASKS.md). */
export const useUpdateInjury = (caseId: Id) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: Id; input: InjuryUpdate }) => api.patch<Injury>(`/injuries/${id}`, input),
    onSuccess: () => invalidateCase(queryClient, caseId)
  });
};

export const useCreateInjury = (caseId: Id) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InjuryCreate) => api.post<Injury>(`/cases/${caseId}/injuries`, input),
    onSuccess: () => invalidateCase(queryClient, caseId)
  });
};
