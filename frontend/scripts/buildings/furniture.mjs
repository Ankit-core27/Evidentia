// Simple furniture built from boxes. Each returns a `furniture` component placed with its
// footprint centre at (x, z) on a floor whose top is y, rotated by `rot` quarter turns.
import { box, component } from './geometry.mjs';

const builders = {
  counter: ({ w, d, h = 1.0 }, m) => [box('top', [-w / 2, h - 0.05, -d / 2], [w / 2, h, d / 2], m.wood), box('body', [-w / 2 + 0.03, 0, -d / 2 + 0.03], [w / 2 - 0.03, h - 0.05, d / 2 - 0.03], m.fabricDark)],
  shelf: ({ w, d, h = 2.0 }, m) => {
    const parts = [box('side_l', [-w / 2, 0, -d / 2], [-w / 2 + 0.04, h, d / 2], m.metal), box('side_r', [w / 2 - 0.04, 0, -d / 2], [w / 2, h, d / 2], m.metal)];
    for (let i = 0; i < 5; i++) {
      const y = 0.1 + i * ((h - 0.15) / 4);
      parts.push(box(`board${i}`, [-w / 2, y, -d / 2], [w / 2, y + 0.03, d / 2], m.metal));
      if (i < 4) parts.push(box(`goods${i}`, [-w / 2 + 0.08, y + 0.03, -d / 2 + 0.05], [w / 2 - 0.08, y + 0.28, d / 2 - 0.05], m.goods));
    }
    return parts;
  },
  fridge: ({ w, d, h = 1.9 }, m) => [box('body', [-w / 2, 0, -d / 2], [w / 2, h, d / 2], m.white), box('door', [-w / 2 + 0.03, 0.1, d / 2], [w / 2 - 0.03, h - 0.05, d / 2 + 0.02], m.glass)],
  table: ({ w, d, h = 0.75 }, m) => [
    box('top', [-w / 2, h - 0.04, -d / 2], [w / 2, h, d / 2], m.wood),
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => box(`leg${i}`, [sx * (w / 2 - 0.05) - 0.03, 0, sz * (d / 2 - 0.05) - 0.03], [sx * (w / 2 - 0.05) + 0.03, h - 0.04, sz * (d / 2 - 0.05) + 0.03], m.wood))
  ],
  desk: ({ w, d, h = 0.75 }, m) => [box('top', [-w / 2, h - 0.04, -d / 2], [w / 2, h, d / 2], m.wood), box('pedestal', [w / 2 - 0.45, 0, -d / 2 + 0.05], [w / 2 - 0.05, h - 0.04, d / 2 - 0.05], m.metal), box('leg', [-w / 2 + 0.05, 0, -d / 2 + 0.05], [-w / 2 + 0.1, h - 0.04, d / 2 - 0.05], m.metal), box('monitor', [-0.25, h, -d / 2 + 0.1], [0.25, h + 0.35, -d / 2 + 0.14], m.fabricDark)],
  chair: ({ w = 0.48, d = 0.48 }, m) => [box('seat', [-w / 2, 0.42, -d / 2], [w / 2, 0.47, d / 2], m.fabric), box('back', [-w / 2, 0.47, -d / 2], [w / 2, 0.9, -d / 2 + 0.05], m.fabric), box('post', [-0.03, 0, -0.03], [0.03, 0.42, 0.03], m.metal)],
  bed: ({ w, d }, m) => [box('frame', [-w / 2, 0, -d / 2], [w / 2, 0.3, d / 2], m.wood), box('mattress', [-w / 2 + 0.04, 0.3, -d / 2 + 0.04], [w / 2 - 0.04, 0.5, d / 2 - 0.04], m.white), box('pillow', [-w / 2 + 0.15, 0.5, -d / 2 + 0.1], [w / 2 - 0.15, 0.6, -d / 2 + 0.45], m.fabric), box('headboard', [-w / 2, 0, -d / 2 - 0.05], [w / 2, 1.0, -d / 2], m.wood)],
  sofa: ({ w, d }, m) => [box('base', [-w / 2, 0, -d / 2], [w / 2, 0.42, d / 2], m.fabric), box('back', [-w / 2, 0.42, -d / 2], [w / 2, 0.85, -d / 2 + 0.2], m.fabric), box('arm_l', [-w / 2, 0.42, -d / 2], [-w / 2 + 0.15, 0.62, d / 2], m.fabric), box('arm_r', [w / 2 - 0.15, 0.42, -d / 2], [w / 2, 0.62, d / 2], m.fabric)],
  cabinet: ({ w, d, h = 0.9 }, m) => [box('body', [-w / 2, 0, -d / 2], [w / 2, h, d / 2], m.wood)],
  wardrobe: ({ w, d, h = 2.1 }, m) => [box('body', [-w / 2, 0, -d / 2], [w / 2, h, d / 2], m.wood)],
  kitchen: ({ w, d }, m) => [box('base', [-w / 2, 0, -d / 2], [w / 2, 0.86, d / 2], m.wood), box('worktop', [-w / 2, 0.86, -d / 2], [w / 2, 0.9, d / 2], m.stone), box('hob', [-0.3, 0.9, -0.2], [0.3, 0.95, 0.2], m.fabricDark)],
  toilet: ({ w = 0.4, d = 0.65 }, m) => [box('bowl', [-w / 2, 0, -d / 2 + 0.15], [w / 2, 0.42, d / 2], m.white), box('cistern', [-w / 2, 0, -d / 2], [w / 2, 0.8, -d / 2 + 0.18], m.white)],
  basin: ({ w = 0.5, d = 0.4 }, m) => [box('basin', [-w / 2, 0.78, -d / 2], [w / 2, 0.88, d / 2], m.white), box('post', [-0.06, 0, -0.06], [0.06, 0.78, 0.06], m.white)],
  rack: ({ w, d, h = 2.0 }, m) => [box('frame', [-w / 2, 0, -d / 2], [w / 2, h, d / 2], m.fabricDark), box('front', [-w / 2 + 0.03, 0.05, d / 2], [w / 2 - 0.03, h - 0.05, d / 2 + 0.01], m.metal)],
  boxes: ({ w, d, h = 0.9 }, m) => [box('stack0', [-w / 2, 0, -d / 2], [0, h * 0.6, 0], m.cardboard), box('stack1', [0.02, 0, -d / 2], [w / 2, h, d / 2], m.cardboard), box('stack2', [-w / 2, 0, 0.02], [-0.02, h * 0.45, d / 2], m.cardboard)],
  reception: ({ w, d, h = 1.1 }, m) => [box('front', [-w / 2, 0, d / 2 - 0.1], [w / 2, h, d / 2], m.wood), box('desk', [-w / 2, 0, -d / 2], [w / 2, 0.75, d / 2 - 0.1], m.stone)],
  cctv: (_, m) => [box('mount', [-0.04, -0.1, -0.04], [0.04, 0, 0.04], m.metal), box('body', [-0.07, -0.2, -0.04], [0.07, -0.1, 0.22], m.white), box('lens', [-0.04, -0.18, 0.22], [0.04, -0.12, 0.24], m.fabricDark)],
  tank: ({ w = 1.2, d = 1.2, h = 1.3 }, m) => [box('tank', [-w / 2, 0, -d / 2], [w / 2, h, d / 2], m.tank)]
};

/** f: { id, label, type, room, x, z, w, d, h?, rot?, y? } */
export function furniture(f, floorTop, mats, kind = 'furniture') {
  const parts = builders[f.type](f, mats);
  parts.forEach((p) => (p.name = `${f.id}_${p.name}`));
  const g = component(f.id, { kind, label: f.label, furniture_type: f.type, room: f.room }, parts);
  g.position.set(f.x, floorTop + (f.y ?? 0), f.z);
  g.rotation.y = ((f.rot ?? 0) * Math.PI) / 2;
  return g;
}
