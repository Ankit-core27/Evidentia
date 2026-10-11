// evidence router: uploads, evidence records, links and the integrity check.
import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Evidence,
  EvidenceDetail,
  EvidenceFilters,
  EvidenceLink,
  EvidenceLinkCreate,
  EvidenceListItem,
  EvidenceUpdate,
  Id,
  VerifyResult
} from '@/types/api';
import { invalidateCase, queryKeys } from './queryKeys';

export const PROCESSING_POLL_MS = 3000;

/** True while any of the items is still queued or processing. */
export const isProcessing = (items: Pick<Evidence, 'processing_status'>[] | undefined) =>
  items?.some((e) => e.processing_status === 'queued' || e.processing_status === 'processing') ?? false;

export const useGlobalEvidence = (filters: EvidenceFilters = {}) =>
  useQuery({
    queryKey: queryKeys.evidenceList(filters),
    queryFn: ({ signal }) => api.get<EvidenceListItem[]>('/evidence', { ...filters }, signal),
    refetchInterval: (query) => (isProcessing(query.state.data) ? PROCESSING_POLL_MS : false)
  });

/** Evidence of one case. Polls while any file is still queued or processing. */
export const useCaseEvidence = (caseId: Id | undefined) => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.caseEvidence(caseId!),
    queryFn: ({ signal }) => api.get<Evidence[]>(`/cases/${caseId}/evidence`, undefined, signal),
    enabled: caseId !== undefined,
    refetchInterval: (q) => (isProcessing(q.state.data) ? PROCESSING_POLL_MS : false)
  });

  // When processing finishes, the AI may have proposed new records, so refresh the
  // rest of the case. The evidence list itself is already fresh.
  const wasProcessing = useRef(false);
  const processing = isProcessing(query.data);
  useEffect(() => {
    if (wasProcessing.current && !processing && caseId !== undefined) {
      const evidenceKey = queryKeys.caseEvidence(caseId);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.case(caseId),
        predicate: (q) => q.queryKey[2] !== evidenceKey[2]
      });
      void queryClient.invalidateQueries({ queryKey: ['evidence'] });
      // Scenario details live outside the case key; they report how much changed since.
      void queryClient.invalidateQueries({ queryKey: ['reconstruction'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      void queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
    }
    wasProcessing.current = processing;
  }, [processing, caseId, queryClient]);

  return query;
};

export const useEvidenceDetail = (evidenceId: Id | null | undefined) =>
  useQuery({
    queryKey: queryKeys.evidence(evidenceId!),
    queryFn: ({ signal }) => api.get<EvidenceDetail>(`/evidence/${evidenceId}`, undefined, signal),
    enabled: evidenceId !== null && evidenceId !== undefined,
    refetchInterval: (query) => (query.state.data && isProcessing([query.state.data]) ? PROCESSING_POLL_MS : false)
  });

/** Uploads one or more files to a case (multipart field `files`). */
export const useUploadEvidence = (caseId: Id) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => {
      const form = new FormData();
      files.forEach((file) => form.append('files', file));
      return api.post<Evidence[]>(`/cases/${caseId}/evidence`, form);
    },
    onSuccess: () => invalidateCase(queryClient, caseId)
  });
};

export const useUpdateEvidence = (evidenceId: Id) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EvidenceUpdate) => api.patch<Evidence>(`/evidence/${evidenceId}`, input),
    onSuccess: (updated) => invalidateCase(queryClient, updated.case_id)
  });
};

export const useReprocessEvidence = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (evidenceId: Id) => api.post<Evidence>(`/evidence/${evidenceId}/reprocess`),
    onSuccess: (updated) => invalidateCase(queryClient, updated.case_id)
  });
};

export const useCreateEvidenceLink = (caseId: Id) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EvidenceLinkCreate) => api.post<EvidenceLink>('/evidence-links', input),
    onSuccess: () => invalidateCase(queryClient, caseId)
  });
};

export const useDeleteEvidenceLink = (caseId: Id) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (linkId: Id) => api.delete(`/evidence-links/${linkId}`),
    onSuccess: () => invalidateCase(queryClient, caseId)
  });
};

/** Recomputes every file's SHA-256 for a case and reports mismatches. */
export const useVerifyCase = (caseId: Id) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<VerifyResult>(`/cases/${caseId}/verify`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.audit(caseId) })
  });
};
