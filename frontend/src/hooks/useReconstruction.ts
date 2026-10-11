// reconstruction router: scenarios, stages, scene object placements and annotations.
// The scene-object and annotation hooks are for the 3D track's viewer (features/crime-scene).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Id,
  Reconstruction,
  ReconstructionCreate,
  ReconstructionDetail,
  ReconstructionStage,
  SceneAnnotation,
  SceneAnnotationCreate,
  SceneGenerateRequest,
  SceneGeneration,
  SceneObject,
  SceneObjectInput,
  StageCreate
} from '@/types/api';
import { invalidateCase, queryKeys } from './queryKeys';

export const useReconstructions = (caseId: Id | undefined) =>
  useQuery({
    queryKey: queryKeys.reconstructions(caseId!),
    queryFn: ({ signal }) => api.get<Reconstruction[]>(`/cases/${caseId}/reconstructions`, undefined, signal),
    enabled: caseId !== undefined
  });

/** A scenario with its stages, scene objects and annotations. */
export const useReconstruction = (reconstructionId: Id | null | undefined) =>
  useQuery({
    queryKey: queryKeys.reconstruction(reconstructionId!),
    queryFn: ({ signal }) => api.get<ReconstructionDetail>(`/reconstructions/${reconstructionId}`, undefined, signal),
    enabled: reconstructionId !== null && reconstructionId !== undefined
  });

export const useCreateReconstruction = (caseId: Id) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReconstructionCreate) => api.post<Reconstruction>(`/cases/${caseId}/reconstructions`, input),
    onSuccess: () => invalidateCase(queryClient, caseId)
  });
};

/**
 * Reads the case's evidence and records on the backend, writes a scene script (with
 * Gemini, or from the records without a key) and saves one scenario per account.
 */
export const useGenerateReconstructions = (caseId: Id) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SceneGenerateRequest) => api.post<SceneGeneration>(`/cases/${caseId}/reconstructions/generate`, input),
    onSuccess: () => invalidateCase(queryClient, caseId)
  });
};

export const useAddStage = (caseId: Id, reconstructionId: Id) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StageCreate) => api.post<ReconstructionStage>(`/reconstructions/${reconstructionId}/stages`, input),
    onSuccess: () => invalidateCase(queryClient, caseId)
  });
};

/** Replaces a stage's object placements. */
export const useSaveSceneObjects = (caseId: Id, stageId: Id) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (objects: SceneObjectInput[]) => api.put<SceneObject[]>(`/stages/${stageId}/scene-objects`, objects),
    onSuccess: () => invalidateCase(queryClient, caseId)
  });
};

export const useAnnotations = (reconstructionId: Id | null | undefined) =>
  useQuery({
    queryKey: [...queryKeys.reconstruction(reconstructionId!), 'annotations'],
    queryFn: ({ signal }) =>
      api.get<SceneAnnotation[]>(`/reconstructions/${reconstructionId}/annotations`, undefined, signal),
    enabled: reconstructionId !== null && reconstructionId !== undefined
  });

export const useCreateAnnotation = (caseId: Id, reconstructionId: Id) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SceneAnnotationCreate) =>
      api.post<SceneAnnotation>(`/reconstructions/${reconstructionId}/annotations`, input),
    onSuccess: () => invalidateCase(queryClient, caseId)
  });
};
