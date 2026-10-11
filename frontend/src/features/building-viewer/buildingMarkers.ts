import type { CaseWorkspace, Location } from '@/types/api';
import type { BuildingEntry } from '@/features/geographic-area/buildingRegistry';

export interface LinkedEvidence {
  id: number;
  title: string;
  type: string;
}

/** Evidence linked to a record through evidence_links. Only what was entered is returned. */
export function linkedEvidence(workspace: CaseWorkspace, targetType: string, targetId: number): LinkedEvidence[] {
  const ids = new Set(workspace.links.filter((l) => l.target_type === targetType && l.target_id === targetId).map((l) => l.evidence_id));
  return workspace.evidence.filter((e) => ids.has(e.id)).map((e) => ({ id: e.id, title: e.title, type: e.type }));
}

/**
 * An evidence position inside a building, relative to one modelled component so it moves
 * with that component when the building is dissected. Stored on a `locations` row of the
 * case: `building_id` names the building and `geometry` holds
 * `{ "component": "<node name>", "offset": [x, y, z] }` in the component's local metres.
 */
export interface BuildingMarker {
  id: number;
  caseId: number;
  label: string;
  component: string;
  offset: [number, number, number];
  location: Location;
  evidence: LinkedEvidence[];
}

export function buildingMarkers(workspace: CaseWorkspace, building: BuildingEntry): BuildingMarker[] {
  if (building.db_id === undefined || building.db_id === null) return [];
  const markers: BuildingMarker[] = [];
  for (const l of workspace.locations) {
    if (l.building_id !== building.db_id || l.review_status === 'rejected') continue;
    const g = l.geometry as { component?: unknown; offset?: unknown } | null;
    if (typeof g?.component !== 'string' || !Array.isArray(g.offset) || g.offset.length !== 3 || !g.offset.every((n) => typeof n === 'number')) continue;
    markers.push({
      id: l.id,
      caseId: l.case_id,
      label: l.address,
      component: g.component,
      offset: g.offset as [number, number, number],
      location: l,
      evidence: linkedEvidence(workspace, 'location', l.id)
    });
  }
  return markers;
}
