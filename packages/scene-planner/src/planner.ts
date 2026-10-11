import {
  assetRegistry,
  diagnoseScene,
  loadScene,
  sceneSchema,
  type AssetRegistry,
} from '@evidentia/scene-engine';

import { DeterministicMockScenePlanner } from './mock-provider.js';
import type {
  PlannerRequest,
  ScenePlannerDiagnostic,
  ScenePlannerOptions,
  ScenePlannerProvider,
  ScenePlannerResult,
} from './types.js';

const SUPPORTED_ENVIRONMENTS = new Set(['indoor', 'outdoor', 'mixed']);

function error(
  code: ScenePlannerDiagnostic['code'],
  path: string,
  message: string,
): ScenePlannerDiagnostic {
  return { severity: 'error', code, path, message };
}

function validateRequest(request: PlannerRequest, registry: AssetRegistry): ScenePlannerDiagnostic[] {
  const diagnostics: ScenePlannerDiagnostic[] = [];
  if (!request || typeof request !== 'object') {
    return [error('INVALID_PLANNER_REQUEST', '$', 'A planner request object is required.')];
  }
  if (typeof request.description !== 'string' || !request.description.trim()) {
    diagnostics.push(error('INVALID_PLANNER_REQUEST', 'description', 'Provide a non-empty synthetic scene description.'));
  }
  if (!SUPPORTED_ENVIRONMENTS.has(request.environmentType)) {
    diagnostics.push(error('INVALID_PLANNER_REQUEST', 'environmentType', 'Environment must be indoor, outdoor, or mixed.'));
  }
  const rooms = request.roomConstraints ?? [];
  const roomIdentifiers = new Set(rooms.flatMap(({ id, name }) => [id, name].filter((value): value is string => Boolean(value))));
  const entranceRoomId = request.requestedLayout?.entranceRoomId;
  if (entranceRoomId && rooms.length && !roomIdentifiers.has(entranceRoomId)) {
    diagnostics.push(error('INVALID_REFERENCE', 'requestedLayout.entranceRoomId', `Entrance room "${entranceRoomId}" is not present in the supplied room constraints.`));
  }
  for (const [index, room] of rooms.entries()) {
    if (!room.name.trim()) {
      diagnostics.push(error('INVALID_PLANNER_REQUEST', `roomConstraints.${index}.name`, 'Room names cannot be empty.'));
    }
    for (const [key, value] of Object.entries(room.dimensions ?? {})) {
      if (!Number.isFinite(value) || value <= 0) {
        diagnostics.push(error('INVALID_PLANNER_REQUEST', `roomConstraints.${index}.dimensions.${key}`, 'Supplied dimensions must be positive finite metre values.'));
      }
    }
  }
  const permitted = request.permittedAssetIds;
  for (const [index, assetId] of (permitted ?? []).entries()) {
    if (!registry[assetId]) {
      diagnostics.push(error('UNSUPPORTED_ASSET_REQUEST', `permittedAssetIds.${index}`, `Asset "${assetId}" is not in the scene asset registry.`));
    }
  }
  for (const [index, object] of (request.objectConstraints ?? []).entries()) {
    if (object.assetId && !registry[object.assetId]) {
      diagnostics.push(error('UNSUPPORTED_ASSET_REQUEST', `objectConstraints.${index}.assetId`, `Asset "${object.assetId}" is not in the scene asset registry.`));
    } else if (object.assetId && permitted && !permitted.includes(object.assetId)) {
      diagnostics.push(error('UNSUPPORTED_ASSET_REQUEST', `objectConstraints.${index}.assetId`, `Asset "${object.assetId}" is not included in the permitted asset IDs.`));
    }
    for (const [index, marker] of (request.evidenceMarkerConstraints ?? []).entries()) {
      if (!marker.evidenceId.trim()) {
        diagnostics.push(error('INVALID_PLANNER_REQUEST', `evidenceMarkerConstraints.${index}.evidenceId`, 'Evidence references cannot be empty.'));
      }
      if (!marker.position.every(Number.isFinite)) {
        diagnostics.push(error('INVALID_PLANNER_REQUEST', `evidenceMarkerConstraints.${index}.position`, 'Evidence marker coordinates must be finite world-space metres.'));
      }
      if (marker.roomName && rooms.length && !roomIdentifiers.has(marker.roomName)) {
        diagnostics.push(error('INVALID_REFERENCE', `evidenceMarkerConstraints.${index}.roomName`, `Room "${marker.roomName}" is not present in the supplied room constraints.`));
      }
      if (marker.objectName &&
        !request.objectConstraints?.some(({ name }) => name === marker.objectName)) {
        diagnostics.push(error('INVALID_REFERENCE', `evidenceMarkerConstraints.${index}.objectName`, `Object "${marker.objectName}" is not present in the supplied object constraints.`));
      }
    }
    if (object.roomName && rooms.length && !roomIdentifiers.has(object.roomName)) {
      diagnostics.push(error('INVALID_REFERENCE', `objectConstraints.${index}.roomName`, `Room "${object.roomName}" is not present in the supplied room constraints.`));
    }
  }
  for (const [index, connection] of (request.requestedLayout?.connections ?? []).entries()) {
    if (!roomIdentifiers.has(connection.roomA)) {
      diagnostics.push(error('INVALID_REFERENCE', `requestedLayout.connections.${index}.roomA`, `Room "${connection.roomA}" is not present in the supplied room constraints.`));
    }
    if (!roomIdentifiers.has(connection.roomB)) {
      diagnostics.push(error('INVALID_REFERENCE', `requestedLayout.connections.${index}.roomB`, `Room "${connection.roomB}" is not present in the supplied room constraints.`));
    }
  }
  return diagnostics;
}

function plannerFindings(scene: unknown): ScenePlannerDiagnostic[] {
  if (!scene || typeof scene !== 'object' || !('metadata' in scene)) return [];
  const metadata = (scene as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== 'object' || !('planner' in metadata)) return [];
  const planner = (metadata as { planner?: unknown }).planner;
  if (!planner || typeof planner !== 'object' || !('findings' in planner)) return [];
  const findings = (planner as { findings?: unknown }).findings;
  if (!Array.isArray(findings)) return [];
  return findings.flatMap((finding): ScenePlannerDiagnostic[] => {
    if (!finding || typeof finding !== 'object') return [];
    const value = finding as { code?: unknown; path?: unknown; message?: unknown };
    if (typeof value.code !== 'string' || typeof value.path !== 'string' || typeof value.message !== 'string') return [];
    return [{
      severity: value.code === 'UNRESOLVED_OBJECT_PLACEMENT' ? 'warning' : 'error',
      code: value.code as ScenePlannerDiagnostic['code'],
      path: value.path,
      message: value.message,
    }];
  });
}

export class ScenePlanner {
  private readonly provider: ScenePlannerProvider;
  private readonly registry: AssetRegistry;

  constructor(options: ScenePlannerOptions = {}) {
    this.registry = options.registry ?? assetRegistry;
    this.provider = options.provider ?? new DeterministicMockScenePlanner(this.registry);
  }

  async plan(request: PlannerRequest): Promise<ScenePlannerResult> {
    const requestDiagnostics = validateRequest(request, this.registry);
    if (requestDiagnostics.length) {
      return { success: false, providerId: this.provider.id, diagnostics: requestDiagnostics };
    }

    let candidate: unknown;
    try {
      candidate = await this.provider.generateScene({
        plannerRequest: request,
        responseFormat: {
          name: 'evidentia_scene_v1',
          schema: sceneSchema,
        },
      });
    } catch (cause) {
      return {
        success: false,
        providerId: this.provider.id,
        diagnostics: [error(
          'PROVIDER_ERROR',
          '$',
          `Scene provider "${this.provider.id}" failed: ${cause instanceof Error ? cause.message : 'unknown provider error'}`,
        )],
      };
    }

    const loaded = loadScene(candidate, this.registry);
    if (!loaded.success) {
      return {
        success: false,
        providerId: this.provider.id,
        diagnostics: loaded.diagnostics.map((diagnostic) => ({
          severity: 'error',
          code: diagnostic.code === 'INVALID_JSON'
            ? 'MALFORMED_PROVIDER_OUTPUT'
            : diagnostic.code,
          path: diagnostic.path,
          message: diagnostic.message,
        })),
      };
    }

    const diagnostics: ScenePlannerDiagnostic[] = plannerFindings(loaded.scene);
    const spatialDiagnostics = diagnoseScene(loaded.scene, this.registry);
    const blockingLayoutCodes = new Set([
      'ROOM_FOOTPRINT_OVERLAP',
      'SHARED_BOUNDARY_MISALIGNED',
      'ROOM_UNREACHABLE_FROM_ENTRANCE',
      'BOUNDARY_DOORWAY_BLOCKED',
    ]);
    diagnostics.push(...spatialDiagnostics.map((diagnostic) => ({
      severity: blockingLayoutCodes.has(diagnostic.code) ? 'error' : diagnostic.severity,
      code: diagnostic.code,
      path: diagnostic.path,
      message: diagnostic.message,
    })));
    if (diagnostics.some(({ severity }) => severity === 'error')) {
      return {
        success: false,
        providerId: this.provider.id,
        diagnostics,
      };
    }
    return {
      success: true,
      scene: loaded.scene,
      providerId: this.provider.id,
      diagnostics,
    };
  }
}

export async function planScene(
  request: PlannerRequest,
  options: ScenePlannerOptions = {},
): Promise<ScenePlannerResult> {
  return new ScenePlanner(options).plan(request);
}
