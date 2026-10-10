// Human-readable names for records referenced by type and id (links, observations, audit entries).
import { CaseWorkspace, Id, Observation, RecordType } from '@/types/api';
import { firstLine, humanize } from './format';

export const recordLabel = (
  workspace: CaseWorkspace | undefined,
  type: RecordType,
  id: Id,
  observations?: Observation[]
): string => {
  const fallback = `${humanize(type)} #${id}`;
  if (!workspace) return fallback;
  switch (type) {
    case 'case':
      return workspace.case.case_number;
    case 'person':
      return workspace.persons.find((p) => p.id === id)?.name ?? fallback;
    case 'object':
      return workspace.objects.find((o) => o.id === id)?.label ?? fallback;
    case 'location':
      return workspace.locations.find((l) => l.id === id)?.address ?? fallback;
    case 'evidence':
      return workspace.evidence.find((e) => e.id === id)?.title ?? fallback;
    case 'event': {
      const event = workspace.events.find((e) => e.id === id);
      return event ? firstLine(event.description, 80) : fallback;
    }
    case 'relationship': {
      const rel = workspace.relationships.find((r) => r.id === id);
      if (!rel) return fallback;
      const from = recordLabel(workspace, rel.from_type, rel.from_id);
      const to = recordLabel(workspace, rel.to_type, rel.to_id);
      return `${from} → ${to}${rel.label ? `: ${rel.label}` : ''}`;
    }
    case 'injury': {
      const injury = workspace.injuries.find((i) => i.id === id);
      if (!injury) return fallback;
      const person = injury.person_id ? workspace.persons.find((p) => p.id === injury.person_id)?.name : null;
      return `${injury.type}, ${humanize(injury.body_region).toLowerCase()}${person ? ` (${person})` : ''}`;
    }
    case 'observation':
      return observations?.find((o) => o.id === id)?.statement ?? fallback;
    default:
      return fallback;
  }
};
