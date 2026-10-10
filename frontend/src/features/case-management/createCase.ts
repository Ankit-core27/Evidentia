// Creates a case and everything entered in the create-case modal, one API call per
// record, reporting progress step by step. If a later step fails the case is kept,
// and the failures are returned so the officer can fix them in the workspace.
import { api } from '@/lib/api';
import { Case, CaseCreate, CaseObjectCreate, LocationCreate, PersonCreate } from '@/types/api';

export interface NewCaseInput {
  case: CaseCreate;
  location: LocationCreate | null;
  persons: PersonCreate[];
  vehicles: CaseObjectCreate[];
  files: File[];
}

export type StepStatus = 'pending' | 'running' | 'done' | 'failed';

export interface CreationStep {
  key: string;
  label: string;
  status: StepStatus;
  error?: string;
}

export const plannedSteps = (input: NewCaseInput): CreationStep[] => [
  { key: 'case', label: 'Create case', status: 'pending' },
  ...(input.location ? [{ key: 'location', label: 'Save incident location', status: 'pending' as const }] : []),
  ...input.persons.map((p, i) => ({ key: `person-${i}`, label: `Add ${p.role}: ${p.name}`, status: 'pending' as const })),
  ...input.vehicles.map((v, i) => ({ key: `vehicle-${i}`, label: `Add vehicle: ${v.label}`, status: 'pending' as const })),
  ...(input.files.length
    ? [{ key: 'files', label: `Upload ${input.files.length} evidence file${input.files.length > 1 ? 's' : ''}`, status: 'pending' as const }]
    : [])
];

const message = (error: unknown) => (error instanceof Error ? error.message : 'Unknown error');

export async function createCaseWithDetails(
  input: NewCaseInput,
  onStep: (key: string, status: StepStatus, error?: string) => void
): Promise<{ created: Case; failed: number }> {
  onStep('case', 'running');
  let created: Case;
  try {
    created = await api.post<Case>('/cases', input.case);
  } catch (error) {
    onStep('case', 'failed', message(error));
    throw error;
  }
  onStep('case', 'done');

  let failed = 0;
  const run = async (key: string, call: () => Promise<unknown>) => {
    onStep(key, 'running');
    try {
      await call();
      onStep(key, 'done');
    } catch (error) {
      failed += 1;
      onStep(key, 'failed', message(error));
    }
  };

  if (input.location) await run('location', () => api.post(`/cases/${created.id}/locations`, input.location));
  for (const [i, person] of input.persons.entries()) {
    await run(`person-${i}`, () => api.post(`/cases/${created.id}/persons`, person));
  }
  for (const [i, vehicle] of input.vehicles.entries()) {
    await run(`vehicle-${i}`, () => api.post(`/cases/${created.id}/objects`, vehicle));
  }
  if (input.files.length) {
    await run('files', () => {
      const form = new FormData();
      input.files.forEach((file) => form.append('files', file));
      return api.post(`/cases/${created.id}/evidence`, form);
    });
  }
  return { created, failed };
}
