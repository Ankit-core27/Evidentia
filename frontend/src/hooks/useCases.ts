// cases router: cases, workspace and investigators.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Case,
  CaseCreate,
  CaseFilters,
  CaseListItem,
  CaseUpdate,
  CaseWorkspace,
  Id,
  Investigator
} from '@/types/api';
import { invalidateCase, queryKeys } from './queryKeys';
import { isProcessing, PROCESSING_POLL_MS } from './useEvidence';

export const useInvestigators = () =>
  useQuery({
    queryKey: queryKeys.investigators,
    queryFn: ({ signal }) => api.get<Investigator[]>('/investigators', undefined, signal),
    staleTime: 5 * 60_000
  });

export const useCases = (filters: CaseFilters = {}, { enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: queryKeys.cases(filters),
    queryFn: ({ signal }) => api.get<CaseListItem[]>('/cases', { ...filters }, signal),
    enabled
  });

export const useCase = (caseId: Id | undefined) => {
  const queryClient = useQueryClient();
  return useQuery<Case>({
    queryKey: queryKeys.caseDetail(caseId!),
    queryFn: ({ signal }) => api.get<Case>(`/cases/${caseId}`, undefined, signal),
    enabled: caseId !== undefined,
    // Show the case from an already-loaded workspace while this request runs.
    placeholderData: (previous) =>
      previous ??
      (caseId === undefined ? undefined : queryClient.getQueryData<CaseWorkspace>(queryKeys.workspace(caseId))?.case)
  });
};

/** Everything about one case. Polls while evidence is processing, since processing adds AI proposals. */
export const useCaseWorkspace = (caseId: Id | undefined) =>
  useQuery({
    queryKey: queryKeys.workspace(caseId!),
    queryFn: ({ signal }) => api.get<CaseWorkspace>(`/cases/${caseId}/workspace`, undefined, signal),
    enabled: caseId !== undefined,
    refetchInterval: (query) => (isProcessing(query.state.data?.evidence) ? PROCESSING_POLL_MS : false)
  });

export const useCreateCase = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CaseCreate) => api.post<Case>('/cases', input),
    onSuccess: (created) => invalidateCase(queryClient, created.id)
  });
};

export const useUpdateCase = (caseId: Id) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CaseUpdate) => api.patch<Case>(`/cases/${caseId}`, input),
    onSuccess: () => invalidateCase(queryClient, caseId)
  });
};
