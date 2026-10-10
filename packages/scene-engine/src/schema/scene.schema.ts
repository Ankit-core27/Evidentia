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

const positiveVector3Schema = z.tuple([
  z.number().finite().positive(),
  z.number().finite().positive(),
  z.number().finite().positive(),
]);

const roomWallSchema = z.enum(['north', 'south', 'east', 'west']);

const transformSchema = z.object({
  position: vector3Schema,
  rotation: vector3Schema,
  scale: positiveVector3Schema,
});

const roomSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  parentId: z.string().min(1).optional(),
  position: vector3Schema.optional(),
  rotation: vector3Schema.optional(),
  layoutMode: z.enum(['authored', 'procedural']).optional(),
  wallThickness: z.number().finite().positive().optional(),
  floor: z.object({ enabled: z.boolean().optional() }).optional(),
  ceiling: z.object({ enabled: z.boolean().optional() }).optional(),
  openings: z.array(z.object({
    id: z.string().min(1),
    type: z.enum(['door', 'window']),
    wall: roomWallSchema,
    offset: z.number().finite().nonnegative(),
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
    sillHeight: z.number().finite().nonnegative(),
    assetId: z.string().min(1).optional(),
    label: z.string().min(1).optional(),
  })).optional(),
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
  scale: positiveVector3Schema.optional(),
  color: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const cameraSchema = z.object({
  position: vector3Schema,
  target: vector3Schema,
  fov: z.number().finite().positive().optional(),
  near: z.number().finite().positive().optional(),
  far: z.number().finite().positive().optional(),
}).superRefine((camera, ctx) => {
  if ((camera.fov ?? 50) >= 180) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fov'],
      message: 'Camera field of view must be less than 180 degrees.',
    });
  }
  if ((camera.near ?? 0.1) >= (camera.far ?? 500)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['near'],
      message: 'Camera near plane must be less than the far plane.',
    });
  }
  if (camera.position.every((value, index) => value === camera.target[index])) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['position'],
      message: 'Camera position and target must be different points.',
    });
  }
});

const sharedBoundarySchema = z.object({
  id: z.string().min(1),
  roomA: z.string().min(1),
  wallA: roomWallSchema,
  roomB: z.string().min(1),
  wallB: roomWallSchema,
  openingId: z.string().min(1).optional(),
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
    sharedBoundaries: z.array(sharedBoundarySchema).optional(),
    entranceRoomId: z.string().min(1).optional(),
    allowDisconnectedRooms: z.boolean().optional(),
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
        message: `Scene element ID "${id}" must be unique across objects, openings, structural placements, and evidence markers.`,
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
    if (room.layoutMode === 'procedural' &&
      (!(room.dimensions?.width ?? room.dimensions?.length) || !room.dimensions?.depth || !room.dimensions?.height)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['environment', 'rooms', roomIndex, 'dimensions'],
        message: 'Procedural rooms require positive width, depth, and height dimensions.',
      });
    }
    if (
      room.dimensions?.width !== undefined &&
      room.dimensions.length !== undefined &&
      room.dimensions.width !== room.dimensions.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['environment', 'rooms', roomIndex, 'dimensions', 'length'],
        message: 'Room width and length cannot disagree; omit one or make them equal.',
      });
    }
    if (room.layoutMode === 'procedural' && room.rotation &&
      (room.rotation[0] !== 0 || room.rotation[2] !== 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['environment', 'rooms', roomIndex, 'rotation'],
        message: 'Procedural rooms support horizontal rotation around the Y axis only.',
      });
    }
    if (room.layoutMode !== 'procedural' && room.openings?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['environment', 'rooms', roomIndex, 'openings'],
        message: 'Room openings require procedural layout mode so wall geometry can be cut from scene data.',
      });
    }
    for (const layoutKey of ['floorTiles', 'walls', 'doors', 'windows'] as const) {
      room.structural?.[layoutKey]?.forEach((placement, placementIndex) => {
        registerRenderableId(
          placement.id,
          ['environment', 'rooms', roomIndex, 'structural', layoutKey, placementIndex, 'id'],
        );
      });
    }

    if (room.openings) {
      room.openings.forEach((opening, openingIndex) =>
        registerRenderableId(
          opening.id,
          ['environment', 'rooms', roomIndex, 'openings', openingIndex, 'id'],
        ),
      );
      const width = room.dimensions?.width ?? room.dimensions?.length;
      const depth = room.dimensions?.depth;
      const height = room.dimensions?.height;
      const openings = room.openings;
      openings.forEach((opening, openingIndex) => {
        const wallSpan = opening.wall === 'north' || opening.wall === 'south' ? width : depth;
        const openingPath = ['environment', 'rooms', roomIndex, 'openings', openingIndex];
        if (wallSpan === undefined || height === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: openingPath,
            message: 'Room openings require the matching wall span and room height dimensions.',
          });
          return;
        }
        if (opening.offset + opening.width > wallSpan) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...openingPath, 'width'],
            message: `Opening "${opening.id}" extends beyond the ${opening.wall} wall.`,
          });
        }
        if (opening.sillHeight + opening.height > height) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...openingPath, 'height'],
            message: `Opening "${opening.id}" extends above the room ceiling.`,
          });
        }
        for (const other of openings.slice(0, openingIndex)) {
          if (other.wall !== opening.wall) continue;
          const horizontalOverlap = opening.offset < other.offset + other.width &&
            other.offset < opening.offset + opening.width;
          const verticalOverlap = opening.sillHeight < other.sillHeight + other.height &&
            other.sillHeight < opening.sillHeight + opening.height;
          if (horizontalOverlap && verticalOverlap) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: openingPath,
              message: `Opening "${opening.id}" overlaps opening "${other.id}".`,
            });
          }
        }
      });
    }
  });

  const sharedBoundaries = scene.environment.sharedBoundaries ?? [];
  const boundaryIds = new Set<string>();
  sharedBoundaries.forEach((boundary, index) => {
    const path = ['environment', 'sharedBoundaries', index];
    if (boundaryIds.has(boundary.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'id'],
        message: `Shared boundary ID "${boundary.id}" must be unique.`,
      });
    }
    boundaryIds.add(boundary.id);
    const sameWallAlreadyShared = sharedBoundaries.slice(0, index).some((previous) =>
      (previous.roomA === boundary.roomA && previous.wallA === boundary.wallA) ||
      (previous.roomA === boundary.roomB && previous.wallA === boundary.wallB) ||
      (previous.roomB === boundary.roomA && previous.wallB === boundary.wallA) ||
      (previous.roomB === boundary.roomB && previous.wallB === boundary.wallB),
    );
    if (sameWallAlreadyShared) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: 'Each room wall can belong to only one shared boundary.',
      });
    }
    if (!roomIds.has(boundary.roomA) || !roomIds.has(boundary.roomB) || boundary.roomA === boundary.roomB) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: 'A shared boundary must connect two different rooms in this scene.',
      });
    }
    const roomA = scene.environment.rooms.find(({ id }) => id === boundary.roomA);
    const roomB = scene.environment.rooms.find(({ id }) => id === boundary.roomB);
    if (roomA && roomB && (roomA.layoutMode !== 'procedural' || roomB.layoutMode !== 'procedural')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: 'Shared boundaries require procedural layout mode on both rooms so duplicate wall geometry can be suppressed.',
      });
    }
    if (boundary.openingId && roomA) {
      const opening = roomA.openings?.find(({ id }) => id === boundary.openingId);
      if (!opening) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, 'openingId'],
          message: `Shared boundary opening "${boundary.openingId}" was not found in room "${roomA.id}".`,
        });
      } else if (opening.type !== 'door' || opening.wall !== boundary.wallA) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, 'openingId'],
          message: `Shared boundary opening "${opening.id}" must be a door on room "${roomA.id}" wall "${boundary.wallA}".`,
        });
      }
    }
    if (!roomIds.has(boundary.roomA)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'roomA'],
        message: `Shared boundary room "${boundary.roomA}" was not found in the scene.`,
      });
    }
    if (!roomIds.has(boundary.roomB)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'roomB'],
        message: `Shared boundary room "${boundary.roomB}" was not found in the scene.`,
      });
    }
    const oppositeWalls: Record<string, string> = {
      north: 'south',
      south: 'north',
      east: 'west',
      west: 'east',
    };
    if (oppositeWalls[boundary.wallA] !== boundary.wallB) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'wallB'],
        message: 'Shared boundary walls must be opposite (north/south or east/west).',
      });
    }
  });

  if (scene.environment.entranceRoomId && !roomIds.has(scene.environment.entranceRoomId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['environment', 'entranceRoomId'],
      message: `Entrance room "${scene.environment.entranceRoomId}" was not found in the scene.`,
    });
  }

  for (const room of scene.environment.rooms) {
    if (room.parentId && !roomIds.has(room.parentId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['environment', 'rooms', room.id, 'parentId'],
        message: `Room parentId "${room.parentId}" was not found in the scene.`,
      });
    }
  }

  const reportParentCycles = (
    items: Array<{ id: string; parentId?: string }>,
    path: string[],
  ) => {
    const reported = new Set<string>();
    for (const item of items) {
      const chain = new Set<string>();
      let current: string | undefined = item.id;
      while (current) {
        if (chain.has(current)) {
          if (!reported.has(current)) {
            reported.add(current);
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [...path, item.id, 'parentId'],
              message: `Parent references form a cycle containing "${current}".`,
            });
          }
          break;
        }
        chain.add(current);
        current = items.find((candidate) => candidate.id === current)?.parentId;
      }
    }
  };
  reportParentCycles(scene.environment.rooms, ['environment', 'rooms']);
  reportParentCycles(scene.objects, ['objects']);

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
      for (const [index, opening] of (room.openings ?? []).entries()) {
        if (opening.assetId && !registry[opening.assetId]) {
          errors.push({
            path: `environment.rooms.${room.id}.openings.${index}.assetId`,
            message: `Asset ID "${opening.assetId}" is not present in the asset registry.`,
          });
        }
      }
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
