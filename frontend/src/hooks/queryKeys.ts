import { QueryClient } from '@tanstack/react-query';
import { CaseFilters, EventCategory, EvidenceFilters, Id, ReviewStatus } from '@/types/api';

// Everything that belongs to one case sits under ['case', caseId], so a mutation
// can refresh the whole case with one invalidation.
export const queryKeys = {
  investigators: ['investigators'] as const,
  cases: (filters: CaseFilters = {}) => ['cases', filters] as const,
  case: (caseId: Id) => ['case', caseId] as const,
  caseDetail: (caseId: Id) => ['case', caseId, 'detail'] as const,
  workspace: (caseId: Id) => ['case', caseId, 'workspace'] as const,
  caseEvidence: (caseId: Id) => ['case', caseId, 'evidence'] as const,
  persons: (caseId: Id) => ['case', caseId, 'persons'] as const,
  objects: (caseId: Id) => ['case', caseId, 'objects'] as const,
  locations: (caseId: Id) => ['case', caseId, 'locations'] as const,
  events: (caseId: Id, category?: EventCategory) => ['case', caseId, 'events', category ?? 'all'] as const,
  graph: (caseId: Id) => ['case', caseId, 'graph'] as const,
  observations: (caseId: Id, status?: ReviewStatus) => ['case', caseId, 'observations', status ?? 'all'] as const,
  conflicts: (caseId: Id) => ['case', caseId, 'conflicts'] as const,
  search: (caseId: Id, q: string) => ['case', caseId, 'search', q] as const,
  anatomyFindings: (caseId: Id) => ['case', caseId, 'anatomy-findings'] as const,
  injuries: (caseId: Id) => ['case', caseId, 'injuries'] as const,
  reconstructions: (caseId: Id) => ['case', caseId, 'reconstructions'] as const,
  caseReports: (caseId: Id) => ['case', caseId, 'reports'] as const,
  audit: (caseId: Id) => ['case', caseId, 'audit'] as const,
  evidenceList: (filters: EvidenceFilters = {}) => ['evidence', 'list', filters] as const,
  evidence: (evidenceId: Id) => ['evidence', evidenceId] as const,
  /** Under the evidence key, so anything that refreshes an evidence item refreshes its custody too. */
  custody: (evidenceId: Id) => ['evidence', evidenceId, 'custody'] as const,
  reconstruction: (reconstructionId: Id) => ['reconstruction', reconstructionId] as const,
  report: (reportId: Id) => ['report', reportId] as const,
  dashboard: ['dashboard'] as const,
  alerts: ['alerts'] as const
};

/**
 * Refreshes everything a change to one case can affect: the case's own queries,
 * case lists, the global evidence list, reconstructions, the dashboard and alerts.
 */
export const invalidateCase = (queryClient: QueryClient, caseId: Id) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.case(caseId) }),
    queryClient.invalidateQueries({ queryKey: ['cases'] }),
    queryClient.invalidateQueries({ queryKey: ['evidence'] }),
    queryClient.invalidateQueries({ queryKey: ['reconstruction'] }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
    queryClient.invalidateQueries({ queryKey: queryKeys.alerts })
  ]);
