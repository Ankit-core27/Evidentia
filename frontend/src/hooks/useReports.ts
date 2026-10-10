// reports router: stored reports and the case audit trail.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AuditEntry, Id, Report, ReportCreate, ReportListItem } from '@/types/api';
import { queryKeys } from './queryKeys';

export const useCreateReport = (caseId: Id) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReportCreate) => api.post<Report>(`/cases/${caseId}/reports`, input),
    onSuccess: (report) => {
      queryClient.setQueryData(queryKeys.report(report.id), report);
      void queryClient.invalidateQueries({ queryKey: queryKeys.caseReports(caseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit(caseId) });
    }
  });
};

export const useReport = (reportId: Id | null | undefined) =>
  useQuery({
    queryKey: queryKeys.report(reportId!),
    queryFn: ({ signal }) => api.get<Report>(`/reports/${reportId}`, undefined, signal),
    enabled: reportId !== null && reportId !== undefined
  });

/** Uses the proposed GET /api/cases/{id}/reports (see docs/FRONTEND_TASKS.md). */
export const useCaseReports = (caseId: Id | undefined) =>
  useQuery({
    queryKey: queryKeys.caseReports(caseId!),
    queryFn: ({ signal }) => api.get<ReportListItem[]>(`/cases/${caseId}/reports`, undefined, signal),
    enabled: caseId !== undefined
  });

export const useAudit = (caseId: Id | undefined) =>
  useQuery({
    queryKey: queryKeys.audit(caseId!),
    queryFn: ({ signal }) => api.get<AuditEntry[]>(`/cases/${caseId}/audit`, undefined, signal),
    enabled: caseId !== undefined
  });
