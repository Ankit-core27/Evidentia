import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AnatomyFinding, MedicalAnalysisRequest, MedicalAnalysisResult, ReviewStatus } from '@/types/api';
import { invalidateCase, queryKeys } from './queryKeys';

export const useAnatomyFindings = (caseId: number) => useQuery({
  queryKey: queryKeys.anatomyFindings(caseId),
  queryFn: ({ signal }) => api.get<AnatomyFinding[]>(`/cases/${caseId}/anatomy-findings`, undefined, signal)
});

export const useReviewAnatomyFinding = (caseId: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: { review_status: ReviewStatus } }) =>
      api.patch<AnatomyFinding>(`/anatomy-findings/${id}`, input),
    onSuccess: () => invalidateCase(client, caseId)
  });
};

export const useMedicalAnalysis = (caseId: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: MedicalAnalysisRequest) => api.post<MedicalAnalysisResult>(`/cases/${caseId}/medical-analysis`, body),
    onSuccess: () => invalidateCase(client, caseId)
  });
};

export const useAnatomyAIStatus = () => useQuery({
  queryKey: ['api-health'],
  queryFn: ({ signal }) => api.get<{ status: string; ai_enabled: boolean }>('/health', undefined, signal),
  staleTime: 30_000
});
