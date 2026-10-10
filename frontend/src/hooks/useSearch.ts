// search router: cited answers and passage search within a case.
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AskRequest, AskResponse, Id, SearchHit } from '@/types/api';
import { queryKeys } from './queryKeys';

/** Asks a question about a case's evidence. The caller keeps the conversation and sends it as `history`. */
export const useAsk = (caseId: Id) =>
  useMutation({
    mutationFn: (input: AskRequest) => api.post<AskResponse>(`/cases/${caseId}/ask`, input)
  });

export const useCaseSearch = (caseId: Id | undefined, q: string) =>
  useQuery({
    queryKey: queryKeys.search(caseId!, q),
    queryFn: ({ signal }) => api.get<SearchHit[]>(`/cases/${caseId}/search`, { q }, signal),
    enabled: caseId !== undefined && q.trim().length > 0
  });
