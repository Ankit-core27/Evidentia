// Downloads the Poly Haven models (CC0) used for furniture and items and prepares them
// for the crime-scene library: keeps the wanted parts, turns them to face +x (tilting
// items that should lie flat), bakes the transforms, puts the origin on the ground at
// the footprint centre and compresses the textures to WebP. Writes
// assets/3d/crime-scenes/library/props/<name>.glb.
//
// Its tools aren't app dependencies; install them without saving, then run from frontend/:
//   npm install --no-save @gltf-transform/core@4.1.1 @gltf-transform/functions@4.1.1 @gltf-transform/extensions@4.1.1 sharp@0.33.5 meshoptimizer@0.21.0
//   node scripts/crime-scene-models/props.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { center, clearNodeTransform, dedup, flatten, getBounds, prune, quantize, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../assets/3d/crime-scenes/library/props');
const SRC = fs.mkdtempSync(path.join(os.tmpdir(), 'polyhaven-'));

const deg = Math.PI / 180;
// Output name, Poly Haven id, yaw (degrees about y), tilt about x and z, and the
// nodes to keep when the download holds more than one object, and how far to simplify
// models drawn many times over (a share of their triangles to keep).
const MODELS = [
  ['sofa', 'sofa_03', 90],
  ['table', 'dining_table', 0],
  ['chair', 'dining_chair_02', 90],
  ['plastic-chair', 'plastic_monobloc_chair_01', 90],
  ['cupboard', 'drawer_cabinet', 90],
  ['bed-frame', 'old_bed_frame', 90],
  ['nightstand', 'ClassicNightstand_01', 90],
  ['shelf', 'steel_frame_shelves_02', 90],
  ['bookshelf', 'wooden_bookshelf_worn', 90],
  ['electrical-panel', 'power_box_01', 90],
  ['utility-box', 'utility_box_01', 90],
  ['cardboard-box', 'cardboard_box_01', 0, 0, 0, null, 0.08],
  ['crate', 'wooden_crate_01', 0],
  ['generator', 'portable_generator', 90],
  ['pistol', 'service_pistol', 0, 90, 0, /_(a)$/],
  ['bat', 'baseball_bat', 0, 0, -90],
  ['crowbar', 'crowbar_01', 0, 0, -90],
  ['knife', 'fish_knife', 0, 0, -90],
  ['suitcase', 'vintage_suitcase', 90, 0, 0, /suitcase_02/],
  ['papers', 'office_notepads', 0],
  ['cctv-camera', 'security_camera_01', 0],
  ['television', 'television_02', 90]
];

/** Tilt first (about x, then z), then yaw: q = qy * qz * qx. */
function quat(x, y, z) {
  const q = (ax, a) => { const s = Math.sin(a / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(a / 2)]; };
  const mul = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
  ];
  return mul(q([0, 1, 0], y * deg), mul(q([0, 0, 1], z * deg), q([1, 0, 0], x * deg)));
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
fs.mkdirSync(OUT, { recursive: true });

/** Downloads a model's 1k glTF and its textures from Poly Haven. */
async function download(id) {
  const files = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
  const gltf = files.gltf['1k'].gltf;
  const dir = path.join(SRC, id);
  const jobs = [[gltf.url, path.join(dir, path.basename(new URL(gltf.url).pathname))]];
  for (const [rel, f] of Object.entries(gltf.include ?? {})) jobs.push([f.url, path.join(dir, rel)]);
  for (const [url, file] of jobs) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(await (await fetch(url)).arrayBuffer()));
  }
  return dir;
}

await MeshoptSimplifier.ready;
for (const [out, id, yaw, tx = 0, tz = 0, keep, ratio] of MODELS) {
  const dir = await download(id);
  const file = fs.readdirSync(dir).find((f) => f.endsWith('.gltf'));
  const doc = await io.read(path.join(dir, file));
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  if (keep) for (const n of doc.getRoot().listNodes()) if (n.getMesh() && !keep.test(n.getName())) n.dispose();
  const wrap = doc.createNode('root').setRotation(quat(tx, yaw, tz));
  for (const child of scene.listChildren()) { scene.removeChild(child); wrap.addChild(child); }
  scene.addChild(wrap);
  await doc.transform(flatten());
  for (const n of doc.getRoot().listNodes()) if (n.getMesh()) clearNodeTransform(n);
  wrap.dispose();
  if (ratio) await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002 }));
  await doc.transform(
    prune(),
    dedup(),
    center({ pivot: 'below' }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 88 }),
    quantize()
  );
  const b = getBounds(scene);
  const size = [0, 1, 2].map((i) => +(b.max[i] - b.min[i]).toFixed(3));
  await io.write(path.join(OUT, `${out}.glb`), doc);
  const kb = Math.round(fs.statSync(path.join(OUT, `${out}.glb`)).size / 1024);
  console.log(`${out}.glb (${id}): ${size.join(' x ')} m, ${kb} KB`);
}
fs.rmSync(SRC, { recursive: true, force: true });
