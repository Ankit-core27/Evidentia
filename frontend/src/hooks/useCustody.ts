import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, isMockMode } from '@/lib/api';
import { CustodyEvent, CustodyHistory, CustodyTransfer, Id, IntegrityCheck, TransferCreate } from '@/types/api';
import { queryKeys } from './queryKeys';

// Chain of custody for one evidence item (GET /api/evidence/{id}/custody and the
// custody actions). Every change refreshes the item's custody, its detail (which
// carries the custodian) and the case's audit trail.

export const useCustody = (evidenceId: Id) =>
  useQuery({
    queryKey: queryKeys.custody(evidenceId),
    queryFn: ({ signal }) => api.get<CustodyHistory>(`/evidence/${evidenceId}/custody`, undefined, signal),
    // The mock backend has no custody routes; the panel says so instead.
    enabled: !isMockMode
  });

const useCustodyMutation = <TInput, TResult>(evidenceId: Id, caseId: Id, request: (input: TInput) => Promise<TResult>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.evidence(evidenceId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.audit(caseId) })
      ])
  });
};

export const useStartTransfer = (evidenceId: Id, caseId: Id) =>
  useCustodyMutation(evidenceId, caseId, (input: TransferCreate) =>
    api.post<CustodyTransfer>(`/evidence/${evidenceId}/custody/transfers`, input)
  );

export const useResolveTransfer = (evidenceId: Id, caseId: Id) =>
  useCustodyMutation(evidenceId, caseId, ({ id, verb, note }: { id: Id; verb: 'accept' | 'reject' | 'cancel'; note?: string }) =>
    api.post<CustodyTransfer>(`/custody-transfers/${id}/${verb}`, { note: note ?? '' })
  );

export const useRecordAnalysis = (evidenceId: Id, caseId: Id) =>
  useCustodyMutation(evidenceId, caseId, (note: string) => api.post<CustodyEvent>(`/evidence/${evidenceId}/custody/analyses`, { note }));

export const useVerifyIntegrity = (evidenceId: Id, caseId: Id) =>
  useCustodyMutation(evidenceId, caseId, () => api.post<IntegrityCheck>(`/evidence/${evidenceId}/custody/verify`));
