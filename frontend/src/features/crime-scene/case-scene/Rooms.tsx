import React, { useMemo, useRef } from 'react';
import { useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoomOpening, RoomSpec, SCENE_ROOT } from './sceneFile';
import { plasterTexture } from './textures';

// Rooms of an indoor scene: textured floors, plastered walls with their doors and
// windows, and no ceiling. Walls between two rooms are drawn once. Outside walls that
// face the camera are cut down to waist height so the rooms can be seen into.

const WALL = 0.14;
const CUT = 1.0;
const SKIRTING = 0.09;

interface Hole {
  at: number;
  opening: RoomOpening;
  /** Which way the door swings: the side of the room it belongs to (+1 or -1 across the wall). */
  inward: number;
}

interface Segment {
  /** The axis the wall runs along, and its position on the other axis. */
  axis: 'x' | 'z';
  c: number;
  a0: number;
  a1: number;
  height: number;
  holes: Hole[];
  /** Outward direction across the wall for an outside wall; 0 for a wall between rooms. */
  outward: number;
}

function segmentsOf(rooms: RoomSpec[]): Segment[] {
  const raw: Segment[] = [];
  for (const r of rooms) {
    const walls = [
      { wall: 'north', axis: 'x', c: r.z - r.depth / 2, a0: r.x - r.width / 2, a1: r.x + r.width / 2, out: -1, mid: r.x },
      { wall: 'south', axis: 'x', c: r.z + r.depth / 2, a0: r.x - r.width / 2, a1: r.x + r.width / 2, out: 1, mid: r.x },
      { wall: 'west', axis: 'z', c: r.x - r.width / 2, a0: r.z - r.depth / 2, a1: r.z + r.depth / 2, out: -1, mid: r.z },
      { wall: 'east', axis: 'z', c: r.x + r.width / 2, a0: r.z - r.depth / 2, a1: r.z + r.depth / 2, out: 1, mid: r.z }
    ] as const;
    for (const w of walls) {
      raw.push({
        axis: w.axis,
        c: w.c,
        a0: w.a0,
        a1: w.a1,
        height: r.height,
        outward: w.out,
        holes: r.openings.filter((o) => o.wall === w.wall).map((o) => ({ at: w.mid + o.offset, opening: o, inward: -w.out }))
      });
    }
  }
  // Merge walls on the same line that overlap: a shared wall, with both rooms' openings.
  const groups = new Map<string, Segment[]>();
  for (const s of raw) {
    const key = `${s.axis}:${s.c.toFixed(2)}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  const out: Segment[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => a.a0 - b.a0);
    let cur: Segment | null = null;
    let sides = new Set<number>();
    for (const s of list) {
      if (cur && s.a0 <= cur.a1 + 0.01) {
        cur.a1 = Math.max(cur.a1, s.a1);
        cur.height = Math.max(cur.height, s.height);
        cur.holes.push(...s.holes);
        sides.add(s.outward);
      } else {
        if (cur) out.push({ ...cur, outward: sides.size > 1 ? 0 : cur.outward });
        cur = { ...s, holes: [...s.holes] };
        sides = new Set([s.outward]);
      }
    }
    if (cur) out.push({ ...cur, outward: sides.size > 1 ? 0 : cur.outward });
  }
  return out;
}

/** A box along a wall: from a0 to a1 along it, y0 to y1 up, `thick` across it. */
function piece(s: Segment, a0: number, a1: number, y0: number, y1: number, thick = WALL, across = 0) {
  const len = a1 - a0;
  const g = new THREE.BoxGeometry(s.axis === 'x' ? len : thick, y1 - y0, s.axis === 'x' ? thick : len);
  const mid = (a0 + a1) / 2;
  const cy = (y0 + y1) / 2;
  if (s.axis === 'x') g.translate(mid, cy, s.c + across);
  else g.translate(s.c + across, cy, mid);
  return g;
}

/** Walls (and skirting) of a segment, cut down to `top` where lower than the wall. */
function wallGeometry(s: Segment, top: number) {
  const walls: THREE.BufferGeometry[] = [];
  const skirting: THREE.BufferGeometry[] = [];
  const h = Math.min(s.height, top);
  const holes = [...s.holes].sort((a, b) => a.at - b.at);
  // Run past each end by half a wall, so corners close.
  let cursor = s.a0 - WALL / 2;
  const end = s.a1 + WALL / 2;
  for (const hole of holes) {
    const o = hole.opening;
    const h0 = Math.max(cursor, hole.at - o.width / 2);
    const h1 = Math.min(end, hole.at + o.width / 2);
    if (h0 > cursor + 0.005) {
      walls.push(piece(s, cursor, h0, 0, h));
      skirting.push(piece(s, cursor, h0, 0, SKIRTING, WALL + 0.024));
    }
    if (o.sill > 0) walls.push(piece(s, h0, h1, 0, Math.min(o.sill, h)));
    const lintel = o.sill + o.height;
    if (lintel < h - 0.005) walls.push(piece(s, h0, h1, lintel, h));
    cursor = Math.max(cursor, h1);
  }
  if (end > cursor + 0.005) {
    walls.push(piece(s, cursor, end, 0, h));
    skirting.push(piece(s, cursor, end, 0, SKIRTING, WALL + 0.024));
  }
  return { walls: walls.length ? mergeGeometries(walls) : null, skirting: skirting.length ? mergeGeometries(skirting) : null };
}

/** World-space uvs in metres / scale, so floors and walls keep their texture scale. */
function worldUvs(g: THREE.BufferGeometry, scale: number) {
  const pos = g.getAttribute('position');
  const nrm = g.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    const ny = Math.abs(nrm.getY(i));
    const nx = Math.abs(nrm.getX(i));
    uv[i * 2] = (ny > 0.5 ? pos.getX(i) : nx > 0.5 ? pos.getZ(i) : pos.getX(i)) / scale;
    uv[i * 2 + 1] = (ny > 0.5 ? pos.getZ(i) : pos.getY(i)) / scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

const FLOOR_FILES: Record<string, { key: 'wood' | 'stone' | 'concrete'; scale: number; tint: string; roughness: number }> = {
  wood: { key: 'wood', scale: 2.4, tint: '#ffffff', roughness: 0.55 },
  tile: { key: 'stone', scale: 1.8, tint: '#f6f4f0', roughness: 0.3 },
  marble: { key: 'stone', scale: 2.6, tint: '#ffffff', roughness: 0.16 },
  concrete: { key: 'concrete', scale: 4.5, tint: '#e2e0dc', roughness: 0.85 },
  carpet: { key: 'wood', scale: 2.4, tint: '#8a7462', roughness: 1 }
};

function configure(tex: THREE.Texture, color = false) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
}

const DOOR = new THREE.MeshStandardMaterial({ color: '#7a5233', roughness: 0.55 });
const FRAME = new THREE.MeshStandardMaterial({ color: '#efe9df', roughness: 0.5 });
const HANDLE = new THREE.MeshStandardMaterial({ color: '#c9ccd0', metalness: 1, roughness: 0.25 });
const GLASS = new THREE.MeshPhysicalMaterial({ color: '#a9c4cf', roughness: 0.04, transparent: true, opacity: 0.28, clearcoat: 1, depthWrite: false });
const RAIL = new THREE.MeshStandardMaterial({ color: '#2a2c2f', metalness: 0.7, roughness: 0.35 });
const SKIRT = new THREE.MeshStandardMaterial({ color: '#5b4636', roughness: 0.6 });

export const Rooms: React.FC<{ rooms: RoomSpec[]; night: boolean }> = ({ rooms, night }) => {
  const tex = useTexture({
    wood: `${SCENE_ROOT}/textures/wood_floor_diff_1k.jpg`,
    woodNormal: `${SCENE_ROOT}/textures/wood_floor_nor_1k.jpg`,
    stone: `${SCENE_ROOT}/textures/marble_01_diff_1k.jpg`,
    stoneNormal: `${SCENE_ROOT}/textures/marble_01_nor_1k.jpg`,
    concrete: `${SCENE_ROOT}/textures/concrete_floor_02_diff_1k.jpg`,
    concreteNormal: `${SCENE_ROOT}/textures/concrete_floor_02_nor_1k.jpg`
  });
  useMemo(() => {
    configure(tex.wood, true);
    configure(tex.stone, true);
    configure(tex.concrete, true);
    configure(tex.woodNormal);
    configure(tex.stoneNormal);
    configure(tex.concreteNormal);
  }, [tex]);

  const floors = useMemo(
    () =>
      rooms.map((r) => {
        const spec = FLOOR_FILES[r.floor] ?? FLOOR_FILES.tile;
        const key = spec.key;
        const g = worldUvs(new THREE.BoxGeometry(r.width, 0.15, r.depth).translate(r.x, -0.075, r.z), spec.scale);
        const m = new THREE.MeshStandardMaterial({
          map: tex[key],
          normalMap: tex[`${key}Normal` as const],
          color: spec.tint,
          roughness: spec.roughness
        });
        return { g, m, room: r };
      }),
    [rooms, tex]
  );

  const segments = useMemo(() => segmentsOf(rooms), [rooms]);
  const built = useMemo(
    () =>
      segments.map((s) => ({
        s,
        full: wallGeometry(s, Infinity),
        cut: s.outward !== 0 ? wallGeometry(s, CUT) : null
      })),
    [segments]
  );
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ece6db', map: plasterTexture(), roughness: 0.92 }), []);
  useMemo(() => {
    for (const b of built) {
      if (b.full.walls) worldUvs(b.full.walls, 6);
      if (b.cut?.walls) worldUvs(b.cut.walls, 6);
    }
  }, [built]);

  // Swap outside walls between full and cut as the camera moves round.
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const fullRefs = useRef<(THREE.Group | null)[]>([]);
  const cutRefs = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    let changed = false;
    built.forEach((b, i) => {
      if (!b.cut) return;
      const across = b.s.axis === 'x' ? camera.position.z : camera.position.x;
      const facing = (across - b.s.c) * b.s.outward > 0.3 && camera.position.y > 0.5;
      const full = fullRefs.current[i];
      const cut = cutRefs.current[i];
      if (full && cut && full.visible === facing) {
        full.visible = !facing;
        cut.visible = facing;
        changed = true;
      }
    });
    if (changed) invalidate();
  });

  return (
    <group name="rooms">
      {floors.map(({ g, m, room }) => (
        <mesh key={room.id} geometry={g} material={m} receiveShadow name={`${room.name} floor`} />
      ))}
      {built.map((b, i) => (
        <group key={i}>
          <group ref={(el) => (fullRefs.current[i] = el)}>
            {/* Walls cast no shadow: with no ceiling drawn, the sun stands in for room lighting. */}
            {b.full.walls && <mesh geometry={b.full.walls} material={wallMat} receiveShadow />}
            {b.full.skirting && <mesh geometry={b.full.skirting} material={SKIRT} receiveShadow />}
            {b.s.holes.map((h, k) => (
              <Opening key={k} s={b.s} hole={h} cut={false} />
            ))}
          </group>
          {b.cut && (
            <group ref={(el) => (cutRefs.current[i] = el)} visible={false}>
              {b.cut.walls && <mesh geometry={b.cut.walls} material={wallMat} receiveShadow />}
              {b.cut.skirting && <mesh geometry={b.cut.skirting} material={SKIRT} receiveShadow />}
              {b.s.holes.map((h, k) => (
                <Opening key={k} s={b.s} hole={h} cut />
              ))}
            </group>
          )}
        </group>
      ))}
      {night &&
        rooms.map((r) => (
          <group key={r.id} position={[r.x, r.height - 0.35, r.z]}>
            <mesh>
              <sphereGeometry args={[0.07, 16, 12]} />
              <meshStandardMaterial color="#fff3d6" emissive="#ffe2a8" emissiveIntensity={6} toneMapped={false} />
            </mesh>
            <pointLight color="#ffdfaa" intensity={Math.min(r.width * r.depth, 60) * 0.9} distance={Math.max(r.width, r.depth) * 1.6} decay={1.6} />
          </group>
        ))}
    </group>
  );
};

/** A door leaf, window or balcony railing in its opening. */
const Opening: React.FC<{ s: Segment; hole: Hole; cut: boolean }> = ({ s, hole, cut }) => {
  const o = hole.opening;
  // Local frame: u along the wall, v across it (towards the room the door opens into).
  const position: [number, number, number] = s.axis === 'x' ? [hole.at, 0, s.c] : [s.c, 0, hole.at];
  const rotY = s.axis === 'x' ? 0 : -Math.PI / 2;
  const v = s.axis === 'x' ? hole.inward : -hole.inward;
  if (o.kind === 'door') {
    const swing = o.state === 'closed' ? 0 : o.state === 'forced' ? 0.62 : o.state === 'broken' ? 1.25 : 1.35;
    const leafH = Math.min(o.height - 0.03, cut ? CUT : Infinity);
    const w = o.width - 0.05;
    return (
      <group position={position} rotation-y={rotY} name={o.label || 'door'}>
        {/* Architrave round the opening, on both faces. */}
        {!cut &&
          [-1, 1].map((side) => (
            <group key={side} position-z={side * (WALL / 2 + 0.01)}>
              <mesh position={[-o.width / 2 - 0.035, o.height / 2, 0]} material={FRAME}>
                <boxGeometry args={[0.07, o.height + 0.07, 0.02]} />
              </mesh>
              <mesh position={[o.width / 2 + 0.035, o.height / 2, 0]} material={FRAME}>
                <boxGeometry args={[0.07, o.height + 0.07, 0.02]} />
              </mesh>
              <mesh position={[0, o.height + 0.035, 0]} material={FRAME}>
                <boxGeometry args={[o.width + 0.14, 0.07, 0.02]} />
              </mesh>
            </group>
          ))}
        {/* The leaf, hinged at its left edge, swinging into the room. */}
        <group position={[-w / 2, 0, 0]} rotation-y={-swing * v}>
          <mesh position={[w / 2, leafH / 2 + 0.01, 0]} material={DOOR} castShadow receiveShadow>
            <boxGeometry args={[w, leafH, 0.04]} />
          </mesh>
          {leafH > 1.1 && (
            <mesh position={[w - 0.08, 1.02, 0]} material={HANDLE}>
              <boxGeometry args={[0.12, 0.025, 0.07]} />
            </mesh>
          )}
        </group>
      </group>
    );
  }
  if (o.kind === 'window') {
    if (cut && o.sill >= CUT) return null;
    const top = Math.min(o.sill + o.height, cut ? CUT : Infinity);
    const h = top - o.sill;
    return (
      <group position={position} rotation-y={rotY} name={o.label || 'window'}>
        {o.state !== 'broken' && (
          <mesh position={[0, o.sill + h / 2, 0]} material={GLASS}>
            <boxGeometry args={[o.width - 0.06, h - 0.06, 0.012]} />
          </mesh>
        )}
        {[-1, 1].map((k) => (
          <mesh key={k} position={[(k * (o.width - 0.03)) / 2, o.sill + h / 2, 0]} material={FRAME}>
            <boxGeometry args={[0.05, h, 0.07]} />
          </mesh>
        ))}
        <mesh position={[0, o.sill + 0.025, 0]} material={FRAME}>
          <boxGeometry args={[o.width, 0.05, WALL + 0.06]} />
        </mesh>
        {!cut && (
          <mesh position={[0, top - 0.025, 0]} material={FRAME}>
            <boxGeometry args={[o.width, 0.05, 0.07]} />
          </mesh>
        )}
      </group>
    );
  }
  // An opening above a parapet, such as a balcony: a steel rail along the top.
  return (
    <group position={position} rotation-y={rotY} name={o.label || 'opening'}>
      <mesh position={[0, o.sill + 0.03, 0]} material={RAIL}>
        <boxGeometry args={[o.width, 0.05, WALL + 0.04]} />
      </mesh>
    </group>
  );
};
