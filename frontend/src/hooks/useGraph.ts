// graph router: the relationship canvas.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CaseGraph, Id, Relationship, RelationshipCreate, RelationshipUpdate } from '@/types/api';
import { invalidateCase, queryKeys } from './queryKeys';

export const useCaseGraph = (caseId: Id | undefined) =>
  useQuery({
    queryKey: queryKeys.graph(caseId!),
    queryFn: ({ signal }) => api.get<CaseGraph>(`/cases/${caseId}/graph`, undefined, signal),
    enabled: caseId !== undefined
  });

export const useCreateRelationship = (caseId: Id) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RelationshipCreate) => api.post<Relationship>(`/cases/${caseId}/relationships`, input),
    onSuccess: () => invalidateCase(queryClient, caseId)
  });
};

/** Confirm, reject or edit a link. */
export const useUpdateRelationship = (caseId: Id) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: Id; input: RelationshipUpdate }) =>
      api.patch<Relationship>(`/relationships/${id}`, input),
    onSuccess: () => invalidateCase(queryClient, caseId)
  });
};

export const useDeleteRelationship = (caseId: Id) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => api.delete(`/relationships/${id}`),
    onSuccess: () => invalidateCase(queryClient, caseId)
  });
};
