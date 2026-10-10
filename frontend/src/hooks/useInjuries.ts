// injuries router (M5): injury markers for the anatomy view.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Id, Injury, InjuryCreate } from '@/types/api';
import { invalidateCase, queryKeys } from './queryKeys';

export const useInjuries = (caseId: Id | undefined) =>
  useQuery({
    queryKey: queryKeys.injuries(caseId!),
    queryFn: ({ signal }) => api.get<Injury[]>(`/cases/${caseId}/injuries`, undefined, signal),
    enabled: caseId !== undefined
  });

export const useCreateInjury = (caseId: Id) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InjuryCreate) => api.post<Injury>(`/cases/${caseId}/injuries`, input),
    onSuccess: () => invalidateCase(queryClient, caseId)
  });
};
