import { z } from 'zod';

import type {
  SceneDefinition,
  ValidationIssue,
  ValidationResult,
} from '../types/scene.js';

const vector3Schema = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
]);

const transformSchema = z.object({
  position: vector3Schema,
  rotation: vector3Schema,
  scale: vector3Schema,
});

const roomSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  parentId: z.string().min(1).optional(),
  position: vector3Schema.optional(),
  dimensions: z
    .object({
      width: z.number().finite().positive().optional(),
      depth: z.number().finite().positive().optional(),
      height: z.number().finite().positive().optional(),
      length: z.number().finite().positive().optional(),
      area: z.number().finite().positive().optional(),
    })
    .passthrough()
    .optional(),
  structural: z
    .object({
      floorTiles: z.array(
        z.object({
          id: z.string().min(1),
          assetId: z.string().min(1),
          label: z.string().min(1),
          transform: transformSchema,
        }),
      ).optional(),
      walls: z.array(
        z.object({
          id: z.string().min(1),
          assetId: z.string().min(1),
          label: z.string().min(1),
          transform: transformSchema,
        }),
      ).optional(),
      doors: z.array(
        z.object({
          id: z.string().min(1),
          assetId: z.string().min(1),
          label: z.string().min(1),
          transform: transformSchema,
        }),
      ).optional(),
      windows: z.array(
        z.object({
          id: z.string().min(1),
          assetId: z.string().min(1),
          label: z.string().min(1),
          transform: transformSchema,
        }),
      ).optional(),
    })
    .passthrough()
    .optional(),
});

const objectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  assetId: z.string().min(1),
  category: z.string().min(1),
  roomId: z.string().min(1).optional(),
  parentId: z.string().min(1).optional(),
  evidenceIds: z.array(z.string().min(1)).optional(),
  transform: transformSchema,
  provenance: z
    .object({
      source: z.enum(['manual', 'estimated', 'inferred', 'unknown']),
      confidence: z.number().finite().min(0).max(1).optional(),
      notes: z.string().optional(),
    })
    .passthrough()
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

const markerSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  evidenceId: z.string().min(1),
  objectId: z.string().min(1).optional(),
  roomId: z.string().min(1).optional(),
  position: vector3Schema,
  rotation: vector3Schema.optional(),
  scale: vector3Schema.optional(),
  color: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const cameraSchema = z.object({
  position: vector3Schema,
  target: vector3Schema,
  fov: z.number().finite().positive().optional(),
  near: z.number().finite().positive().optional(),
  far: z.number().finite().positive().optional(),
});

export const sceneSchema = z.object({
  schemaVersion: z.enum(['1.0']),
  sceneId: z.string().min(1),
  caseId: z.string().min(1),
  title: z.string().min(1),
  sceneType: z.enum(['indoor', 'outdoor', 'road', 'mixed']),
  units: z.enum(['meters']),
  coordinateSystem: z.object({
    up: z.enum(['Y']),
    forward: z.enum(['-Z', 'Z', '-X', 'X', '-Y', 'Y']),
    handedness: z.enum(['right', 'left']),
    rotationOrder: z.enum(['XYZ', 'YXZ', 'ZXY', 'ZYX', 'XZY', 'YZX']),
  }),
  environment: z.object({
    type: z.string().min(1),
    rooms: z.array(roomSchema),
    metadata: z.record(z.unknown()).optional(),
  }),
  objects: z.array(objectSchema),
  evidenceMarkers: z.array(markerSchema),
  camera: cameraSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
}).superRefine((scene, ctx) => {
  const roomIds = new Set(scene.environment.rooms.map((room) => room.id));
  const objectIds = new Set(scene.objects.map((object) => object.id));
  const markerIds = new Set(scene.evidenceMarkers.map((marker) => marker.id));
  const renderableIds = new Set<string>();

  const registerRenderableId = (id: string, path: (string | number)[]) => {
    if (renderableIds.has(id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: `Scene element ID "${id}" must be unique across objects, structural placements, and evidence markers.`,
      });
      return;
    }
    renderableIds.add(id);
  };

  if (new Set(scene.environment.rooms.map((room) => room.id)).size !== scene.environment.rooms.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['environment', 'rooms'],
      message: 'Room IDs must be unique.',
    });
  }

  if (objectIds.size !== scene.objects.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['objects'],
      message: 'Object IDs must be unique.',
    });
  }
  scene.objects.forEach((object, index) => registerRenderableId(object.id, ['objects', index, 'id']));

  if (markerIds.size !== scene.evidenceMarkers.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['evidenceMarkers'],
      message: 'Evidence marker IDs must be unique.',
    });
  }
  scene.evidenceMarkers.forEach((marker, index) =>
    registerRenderableId(marker.id, ['evidenceMarkers', index, 'id']),
  );

  scene.environment.rooms.forEach((room, roomIndex) => {
    for (const layoutKey of ['floorTiles', 'walls', 'doors', 'windows'] as const) {
      room.structural?.[layoutKey]?.forEach((placement, placementIndex) => {
        registerRenderableId(
          placement.id,
          ['environment', 'rooms', roomIndex, 'structural', layoutKey, placementIndex, 'id'],
        );
      });
    }
  });

  for (const room of scene.environment.rooms) {
    if (room.parentId && !roomIds.has(room.parentId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['environment', 'rooms', room.id, 'parentId'],
        message: `Room parentId "${room.parentId}" was not found in the scene.`,
      });
    }
  }

  for (const object of scene.objects) {
    if (object.roomId && !roomIds.has(object.roomId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['objects', object.id, 'roomId'],
        message: `Object roomId "${object.roomId}" was not found in the scene.`,
      });
    }

    if (object.parentId && !objectIds.has(object.parentId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['objects', object.id, 'parentId'],
        message: `Object parentId "${object.parentId}" was not found in the scene.`,
      });
    }
  }

  for (const marker of scene.evidenceMarkers) {
    if (marker.roomId && !roomIds.has(marker.roomId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['evidenceMarkers', marker.id, 'roomId'],
        message: `Marker roomId "${marker.roomId}" was not found in the scene.`,
      });
    }

    if (marker.objectId && !objectIds.has(marker.objectId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['evidenceMarkers', marker.id, 'objectId'],
        message: `Marker objectId "${marker.objectId}" was not found in the scene.`,
      });
    }
  }
});

export type SceneSchema = z.infer<typeof sceneSchema>;

export function normalizeIssues(issues: z.ZodIssue[]): ValidationIssue[] {
  return issues.map((issue) => ({
    path: issue.path.length ? issue.path.join('.') : '$',
    message: issue.message,
  }));
}

export function validateScene(
  value: unknown,
  registry?: Record<string, { id: string }>,
): ValidationResult {
  const parsed = sceneSchema.safeParse(value);

  if (!parsed.success) {
    return {
      success: false,
      errors: normalizeIssues(parsed.error.issues),
    };
  }

  const errors: ValidationIssue[] = [];
  const scene = parsed.data as SceneDefinition;

  if (registry) {
    for (const object of scene.objects) {
      if (!registry[object.assetId]) {
        errors.push({
          path: `objects.${object.id}.assetId`,
          message: `Asset ID "${object.assetId}" is not present in the asset registry.`,
        });
      }
    }

    for (const room of scene.environment.rooms) {
      for (const layoutKey of ['floorTiles', 'walls', 'doors', 'windows'] as const) {
        const items = room.structural?.[layoutKey] ?? [];
        for (const item of items) {
          if (!registry[item.assetId]) {
            errors.push({
              path: `environment.rooms.${room.id}.structural.${layoutKey}.${item.id}.assetId`,
              message: `Asset ID "${item.assetId}" is not present in the asset registry.`,
            });
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: scene, errors: [] };
}
