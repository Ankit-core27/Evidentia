import { Box3, Material, Mesh, Object3D, Vector3 } from 'three';

/**
 * Dissection works only on the components the model actually contains. Each component is a
 * node whose glTF extras carry `kind` (see frontend/scripts/buildings/build.mjs). Nodes
 * without extras are classified by name prefix, so a model exported from Blender with
 * names like `roof`, `floor_1`, `wall_ext_north_f0` or `room_f0_kitchen` works too.
 */
export type ComponentKind = 'roof' | 'floor' | 'slab' | 'wall' | 'room' | 'door' | 'stairs' | 'furniture' | 'fixture';

export const COMPONENT_KINDS: { kind: ComponentKind; label: string }[] = [
  { kind: 'roof', label: 'Roof' },
  { kind: 'slab', label: 'Slabs' },
  { kind: 'wall', label: 'Walls' },
  { kind: 'door', label: 'Doors' },
  { kind: 'room', label: 'Rooms' },
  { kind: 'stairs', label: 'Stairs' },
  { kind: 'furniture', label: 'Furniture' },
  { kind: 'fixture', label: 'Roof fixtures' }
];

const NAME_RULES: [RegExp, ComponentKind][] = [
  [/^roof/i, 'roof'],
  [/^floor[_-]?\d+$/i, 'floor'],
  [/^(slab|ceiling)/i, 'slab'],
  [/^wall/i, 'wall'],
  [/^room/i, 'room'],
  [/^door/i, 'door'],
  [/^stair/i, 'stairs'],
  [/^(fur|furniture)[_-]/i, 'furniture']
];

/**
 * A model that carries `kind` extras is read from them alone. Otherwise names decide, and
 * only the outermost matching node counts (so `wall_north` is a part, `wall_north_seg0` not).
 */
export function componentKind(o: Object3D, usesExtras: boolean): ComponentKind | null {
  const k = o.userData?.kind;
  if (usesExtras) return typeof k === 'string' && k !== 'building' ? (k as ComponentKind) : null;
  const byName = (n: Object3D) => NAME_RULES.find(([re]) => re.test(n.name))?.[1] ?? null;
  const kind = byName(o);
  if (!kind) return null;
  for (let p = o.parent; p; p = p.parent) {
    const outer = byName(p);
    if (outer && outer !== 'floor') return null;
  }
  return kind;
}

export interface Part {
  name: string;
  object: Object3D;
  kind: ComponentKind;
  label: string;
  level: number | null;
  /** Local position before any dissection offset, restored exactly on reset. */
  base: Vector3;
  /** Unit direction a wall moves in; zero for anything else. */
  dir: Vector3;
  wallType: 'exterior' | 'interior' | null;
}

export interface Dissection {
  parts: Part[];
  byName: Map<string, Part>;
  floors: { level: number; label: string; part: Part }[];
  floorHeight: number;
  size: Vector3;
  center: Vector3;
  /** Original material of every mesh, so highlights can be undone. */
  materials: Map<Mesh, Material | Material[]>;
}

function levelOf(o: Object3D): number | null {
  for (let p: Object3D | null = o; p; p = p.parent) {
    if (typeof p.userData?.level === 'number') return p.userData.level;
    const m = /^floor[_-]?(\d+)$/i.exec(p.name) ?? /_f(\d+)(?:_|$)/.exec(p.name);
    if (m) return Number(m[1]);
  }
  return null;
}

export function analyse(root: Object3D): Dissection {
  root.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(root);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const parts: Part[] = [];
  const materials = new Map<Mesh, Material | Material[]>();
  let usesExtras = false;
  root.traverse((o) => {
    if (typeof o.userData?.kind === 'string') usesExtras = true;
  });
  root.traverse((o) => {
    if ((o as Mesh).isMesh) materials.set(o as Mesh, (o as Mesh).material);
    const kind = componentKind(o, usesExtras);
    if (!kind) return;
    const dir = new Vector3();
    let wallType: Part['wallType'] = null;
    if (kind === 'wall') {
      wallType = o.userData?.wall_type === 'interior' || /int/i.test(o.name) ? 'interior' : 'exterior';
      const e = o.userData?.explode;
      if (Array.isArray(e) && e.length === 3) {
        dir.set(e[0], e[1], e[2]);
      } else {
        // No authored direction: push the wall away from the building's vertical axis.
        const c = new Box3().setFromObject(o).getCenter(new Vector3()).sub(center);
        c.y = 0;
        if (Math.abs(c.x) > Math.abs(c.z)) dir.set(Math.sign(c.x), 0, 0);
        else dir.set(0, 0, Math.sign(c.z) || 1);
      }
      dir.normalize();
    }
    parts.push({
      name: o.name,
      object: o,
      kind,
      label: typeof o.userData?.label === 'string' ? o.userData.label : o.name.replace(/_/g, ' '),
      level: kind === 'roof' ? null : levelOf(o),
      base: o.position.clone(),
      dir,
      wallType
    });
  });
  const floors = parts
    .filter((p) => p.kind === 'floor' && p.level !== null)
    .map((p) => ({ level: p.level as number, label: p.label, part: p }))
    .sort((a, b) => a.level - b.level);
  const declared = root.getObjectByName('building')?.userData?.floor_height_m;
  const floorHeight = typeof declared === 'number' ? declared : size.y / Math.max(floors.length, 1);
  return { parts, byName: new Map(parts.map((p) => [p.name, p])), floors, floorHeight, size, center, materials };
}

// Each dissection stage owns a window of the 0..1 explosion progress.
const WINDOWS = {
  roof: [0, 0.22],
  floors: [0.18, 0.5],
  exterior: [0.46, 0.76],
  interior: [0.62, 0.9]
} as const;

export const STAGES = [
  { n: 1, label: 'Assembled', at: 0 },
  { n: 2, label: 'Roof off', at: 0.22 },
  { n: 3, label: 'Floors apart', at: 0.5 },
  { n: 4, label: 'Walls out', at: 0.9 },
  { n: 5, label: 'Interior', at: 1 }
];

export function stageAt(t: number) {
  let current = STAGES[0];
  for (const s of STAGES) if (t >= s.at - 1e-3) current = s;
  return current;
}

const smooth = (x: number) => x * x * (3 - 2 * x);
const windowed = (t: number, [a, b]: readonly [number, number]) => smooth(Math.min(1, Math.max(0, (t - a) / (b - a))));

/** Applies the explosion at progress t. At t = 0 every part is back at its original position. */
export function applyExplosion(d: Dissection, t: number) {
  const roofT = windowed(t, WINDOWS.roof);
  const floorT = windowed(t, WINDOWS.floors);
  const extT = windowed(t, WINDOWS.exterior);
  const intT = windowed(t, WINDOWS.interior);
  const gap = d.floorHeight * 1.15;
  const extDistance = Math.max(2.5, Math.min(d.size.x, d.size.z) * 0.32);
  const intDistance = extDistance * 0.45;
  const topLevel = d.floors.length;
  for (const p of d.parts) {
    const o = p.object;
    o.position.copy(p.base);
    if (p.kind === 'roof') {
      o.position.y += roofT * d.floorHeight * 1.4 + floorT * gap * topLevel;
    } else if (p.kind === 'floor' && p.level !== null) {
      o.position.y += floorT * gap * p.level;
    } else if (p.kind === 'wall') {
      o.position.addScaledVector(p.dir, p.wallType === 'interior' ? intT * intDistance : extT * extDistance);
    }
  }
}

/** The nearest ancestor (or self) that is a selectable component, below floors. */
export function ownerPart(d: Dissection, o: Object3D | null): Part | null {
  for (let p: Object3D | null = o; p; p = p.parent) {
    const part = d.byName.get(p.name);
    if (part && part.object === p && part.kind !== 'floor') return part;
  }
  return null;
}

function isWithin(o: Object3D, ancestor: Object3D) {
  for (let p: Object3D | null = o; p; p = p.parent) if (p === ancestor) return true;
  return false;
}

export interface VisibilityState {
  level: number | 'all';
  kinds: Record<ComponentKind, boolean>;
  hidden: Set<string>;
  isolated: string | null;
}

/** Sets mesh visibility from the floor filter, kind toggles, hidden parts and isolation. */
export function applyVisibility(d: Dissection, v: VisibilityState) {
  const isolated = v.isolated ? d.byName.get(v.isolated)?.object ?? null : null;
  for (const mesh of d.materials.keys()) {
    const owner = ownerPart(d, mesh);
    let visible = true;
    if (owner) {
      if (!v.kinds[owner.kind]) visible = false;
      if (v.level !== 'all' && (owner.kind === 'roof' || owner.kind === 'fixture' || (owner.level !== null && owner.level !== v.level))) visible = false;
      for (let p: Object3D | null = owner.object; p && visible; p = p.parent) if (v.hidden.has(p.name)) visible = false;
    }
    if (isolated && !isWithin(mesh, isolated)) visible = false;
    mesh.visible = visible;
  }
}

/** Swaps the meshes of a part to a highlight material; restoring puts the originals back. */
export function highlight(d: Dissection, part: Part | null, material: Material) {
  for (const [mesh, original] of d.materials) mesh.material = original;
  if (!part) return;
  part.object.traverse((o) => {
    if ((o as Mesh).isMesh && ownerPart(d, o) === part) (o as Mesh).material = material;
  });
}

export function partSize(part: Part) {
  return new Box3().setFromObject(part.object).getSize(new Vector3());
}

export function dispose(root: Object3D) {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => m.dispose());
  });
}
