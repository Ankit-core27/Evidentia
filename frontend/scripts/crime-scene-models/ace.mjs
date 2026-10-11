// A Tata Ace-style mini truck with a closed cargo box, the case's "delivery van":
// 3.80 x 1.58 x 2.12 m, wheelbase 2.10 m, 145 R12 tyres on steel wheels.
import * as THREE from 'three';
import { box, curve, loft, mirrorZ, patch, place, smooth, stations, steelWheel, tyre } from './geometry.mjs';

const hx = 1.9;
const cabRear = 0.72;
const wCab = 0.75;
const xf = 1.42;
const xr = -0.68;
const tyreR = 0.268;
const tyreW = 0.145;
const rimR = 0.152;
const zwF = 0.65;
const zwR = 0.66;
const archR = 0.32;

const frontStart = 1.66;
function halfWidth(x) {
  if (x <= frontStart) return wCab;
  const u = Math.min((x - frontStart) / (hx - frontStart), 1) * 0.985;
  return wCab * Math.pow(1 - Math.pow(u, 3), 1 / 3);
}

const topLine = curve([
  [cabRear, 1.835], [0.8, 1.86], [1.3, 1.865], [1.47, 1.85], [1.56, 1.8], [1.66, 1.5], [1.76, 1.18], [1.8, 1.07],
  [1.86, 1.0], [hx, 0.94]
]);
const sill = () => 0.52;
const under = () => 0.48;

function archTop(x) {
  const d = x - xf;
  return Math.abs(d) < archR ? tyreR + Math.sqrt(archR * archR - d * d) : -Infinity;
}

function profile(y) {
  if (y < 1.25) return 1;
  return 1 - 0.06 * smooth((y - 1.25) / (1.86 - 1.25));
}

function frame(x) {
  const w = halfWidth(x);
  const yT = topLine(x);
  const yS = sill(x);
  const yBo = Math.max(yS, archTop(x));
  const rc = Math.min(0.07, w * profile(yT) * 0.5);
  const ySideTop = yT - rc;
  const zTop = w * profile(ySideTop);
  return { w, yT, yS, yBo, rc, ySideTop, zTop, zFlat: zTop - rc };
}

function bodyZ(x, y) {
  const f = frame(x);
  if (y > f.yT) return -1;
  if (y <= f.ySideTop) return f.w * profile(Math.max(y, f.yS));
  const dy = y - f.ySideTop;
  return f.zTop - f.rc + Math.sqrt(Math.max(f.rc * f.rc - dy * dy, 0));
}

function faceX(z, y) {
  let lo = 1.2;
  let hi = hx;
  if (bodyZ(hi, y) >= z) return hi;
  for (let k = 0; k < 40; k += 1) {
    const mid = (lo + hi) / 2;
    if (bodyZ(mid, y) >= z) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** The x where the cab's top line reaches height y, on the windscreen slope. */
function slopeX(y) {
  let lo = 1.5;
  let hi = hx;
  for (let k = 0; k < 40; k += 1) {
    const mid = (lo + hi) / 2;
    if (topLine(mid) >= y) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** The top surface height at (x, z), including the roof's crown. */
function topY(x, z) {
  const f = frame(x);
  const t = Math.min(Math.abs(z) / Math.max(f.zFlat, 1e-3), 1);
  return f.yT + 0.018 * (1 - t * t);
}

function cabSection(x) {
  const f = frame(x);
  const zIn = Math.min(zwF - tyreW / 2 - 0.03, f.w * 0.75);
  const pts = [
    { z: 0, y: under(x), m: 'under' },
    { z: zIn, y: under(x), m: 'under' },
    { z: zIn, y: f.yBo, m: 'under' }
  ];
  const K = 12;
  for (let k = 0; k <= K; k += 1) {
    const y = f.yBo + (f.ySideTop - f.yBo) * (k / K);
    pts.push({ z: f.w * profile(y), y, m: 'paint' });
  }
  for (let k = 1; k <= 5; k += 1) {
    const a = (k / 5) * (Math.PI / 2);
    pts.push({ z: f.zTop - f.rc + f.rc * Math.cos(a), y: f.ySideTop + f.rc * Math.sin(a), m: 'paint' });
  }
  for (let k = 1; k <= 5; k += 1) {
    const z = f.zFlat * (1 - k / 5);
    pts.push({ z, y: topY(x, z), m: 'paint' });
  }
  return pts;
}

export function buildAce(asm) {
  // Cab.
  const xs = stations(cabRear, hx, 0.025, [
    { at: hx, span: 0.1, step: 0.005 },
    { at: xf, span: archR + 0.02, step: 0.01 },
    { at: 1.68, span: 0.16, step: 0.008 }
  ]);
  for (const [m, g] of Object.entries(loft(xs, cabSection, { capStart: 'paint', capEnd: 'paint' }))) asm.add(m, g);

  // Windscreen on the sloped front, side windows on the doors.
  const wsY0 = 1.1;
  const wsY1 = 1.77;
  const windscreen = patch(
    (u, v) => {
      const y = wsY0 + (wsY1 - wsY0) * v;
      const x = slopeX(y);
      const zf = frame(x).zFlat;
      const z = -(zf - 0.035) * (2 * u - 1);
      return new THREE.Vector3(x, topY(x, z), z);
    },
    { nu: 20, nv: 12, offset: 0.004 }
  );
  asm.add('glass', windscreen);
  const sideWindow = patch(
    (u, v) => {
      const y = 1.13 + (1.72 - 1.13) * v;
      const xFront = slopeX(y + 0.12) - 0.05;
      const x = 0.86 + (xFront - 0.86) * u;
      return new THREE.Vector3(x, y, bodyZ(x, y));
    },
    { nu: 16, nv: 8, offset: 0.004 }
  );
  asm.addMirrored('glass', sideWindow);
  // Rear window in the cab's back wall.
  asm.add('glass', box(0.01, 0.34, 0.9, cabRear - 0.004, 1.52, 0, 0.03, 2));

  // Front: grille, emblem, headlamps, indicators, bumper and plate.
  const front = (zOf, yOf, opts) =>
    patch((u, v) => {
      const z = zOf(u, v);
      const y = yOf(u, v);
      return new THREE.Vector3(faceX(Math.abs(z), y), y, z);
    }, opts);
  asm.add('trim_gloss', front((u) => -0.42 * (2 * u - 1), (_u, v) => 0.62 + 0.24 * v, { nu: 24, nv: 6 }));
  for (let k = 0; k < 4; k += 1) {
    const y = 0.66 + k * 0.055;
    asm.add('chrome', place(new THREE.BoxGeometry(0.01, 0.012, 0.8), faceX(0, y) + 0.008, y, 0));
  }
  const logo = place(new THREE.TorusGeometry(0.05, 0.009, 8, 28), faceX(0, 0.8) + 0.012, 0.8, 0, 0, Math.PI / 2, 0);
  logo.scale(1, 0.62, 1);
  asm.add('chrome', logo);
  const lamp = front((u) => 0.72 - 0.25 * u, (_u, v) => 0.71 + 0.15 * v, { nu: 18, nv: 6, offset: 0.005 });
  asm.add('headlight', lamp);
  asm.add('headlight', mirrorZ(lamp));
  const ind = front((u) => 0.7 - 0.2 * u, (_u, v) => 0.63 + 0.05 * v, { nu: 12, nv: 3, offset: 0.005 });
  asm.add('indicator', ind);
  asm.add('indicator', mirrorZ(ind));
  asm.add('trim', box(0.07, 0.17, 1.47, hx - 0.005, 0.47, 0, 0.025, 3));
  asm.plate('plate_front', hx + 0.034, 0.47, 1);

  // Mirrors on stalks, door handles, wipers and door shut lines.
  for (const s of [1, -1]) {
    const stalk = new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8);
    asm.add('trim', place(stalk, 1.58, 1.33, s * 0.84, Math.PI / 2, 0, 0));
    asm.add('trim', box(0.06, 0.25, 0.16, 1.6, 1.38, s * 0.97, 0.02, 2));
    asm.add('glass', box(0.008, 0.21, 0.13, 1.567, 1.38, s * 0.97, 0.004, 1));
  }
  asm.addMirrored('trim', box(0.14, 0.03, 0.02, 0.98, 1.05, wCab + 0.008, 0.008, 2));
  for (const z of [0.18, -0.32]) {
    const y = 1.12;
    const x = slopeX(y);
    asm.add('trim', place(new THREE.BoxGeometry(0.012, 0.012, 0.48), x + 0.02, y + 0.01, z, 0, 0, 0.1));
  }
  const seamV = (x, y0, y1) =>
    patch((u, v) => {
      const xx = x - 0.0025 + 0.005 * u;
      const y = y0 + (y1 - y0) * v;
      return new THREE.Vector3(xx, y, bodyZ(xx, y));
    }, { nu: 1, nv: 16, offset: 0.0015 });
  asm.addMirrored('seam', seamV(0.8, 0.56, 1.8));
  asm.addMirrored('seam', seamV(1.72, archTop(1.72) + 0.03, 1.1));
  asm.addMirrored(
    'seam',
    patch((u, v) => {
      const x = 0.8 + (1.72 - 0.8) * u;
      const y = Math.max(archTop(x), 0.56) + 0.03 + 0.004 * v;
      return new THREE.Vector3(x, y, bodyZ(x, y));
    }, { nu: 40, nv: 1, offset: 0.0015 })
  );

  // Chassis: frame rails, cross members, axle, leaf springs and fuel tank.
  for (const s of [1, -1]) {
    asm.add('under', box(3.4, 0.14, 0.06, -0.15, 0.49, s * 0.42, 0.01, 1));
    asm.add('under', box(1.0, 0.05, 0.06, xr, 0.34, s * 0.42, 0.01, 1));
  }
  for (const x of [-1.7, -0.68, 0.3]) asm.add('under', box(0.06, 0.08, 0.84, x, 0.49, 0, 0.01, 1));
  asm.add('under', place(new THREE.CylinderGeometry(0.045, 0.045, 1.24, 12), xr, tyreR, 0, Math.PI / 2, 0, 0));
  asm.add('under', place(new THREE.SphereGeometry(0.11, 16, 10), xr, tyreR, 0));
  asm.add('trim', box(0.5, 0.22, 0.3, 0.15, 0.44, 0.58, 0.04, 2));

  // Load bed and closed cargo box.
  const bx0 = -1.88;
  const bx1 = 0.64;
  const bLen = bx1 - bx0;
  const bc = (bx0 + bx1) / 2;
  const hw = 0.785;
  const bTop = 2.12;
  const bBot = 0.66;
  asm.add('trim', box(bLen + 0.04, 0.08, 2 * hw + 0.02, bc, bBot - 0.04, 0, 0.01, 1));
  asm.add('paint', box(bLen, bTop - bBot, 2 * hw, bc, (bTop + bBot) / 2, 0, 0.035, 3));
  for (let x = bx0 + 0.22; x < bx1 - 0.1; x += 0.315) {
    asm.addMirrored('paint', box(0.04, bTop - bBot - 0.16, 0.02, x, (bTop + bBot) / 2, hw + 0.008, 0.008, 2));
  }
  for (const y of [bTop - 0.02, bBot + 0.03]) {
    asm.addMirrored('alu', box(bLen + 0.01, 0.045, 0.03, bc, y, hw + 0.005, 0.01, 2));
  }
  asm.add('alu', box(0.03, 0.045, 2 * hw + 0.02, bx1 + 0.002, bTop - 0.02, 0, 0.01, 2));
  // Rear doors: shut line, hinges, lock rods, handles.
  const rearX = bx0 - 0.004;
  asm.add('seam', box(0.006, bTop - bBot - 0.08, 0.008, rearX, (bTop + bBot) / 2, 0, 0.002, 1));
  asm.add('alu', box(0.03, 0.05, 2 * hw + 0.02, rearX, bTop - 0.02, 0, 0.01, 2));
  for (const s of [1, -1]) {
    for (const y of [0.92, 1.4, 1.88]) asm.add('alu', box(0.04, 0.06, 0.1, rearX - 0.01, y, s * (hw - 0.04), 0.01, 1));
    for (const z of [0.2, 0.55]) {
      asm.add('alu', place(new THREE.CylinderGeometry(0.012, 0.012, bTop - bBot - 0.14, 10), rearX - 0.025, (bTop + bBot) / 2, s * z));
      asm.add('alu', box(0.05, 0.03, 0.1, rearX - 0.04, 1.2, s * (z - 0.04), 0.01, 1));
    }
  }
  // Rear bumper, lamps and plate.
  asm.add('trim', box(0.08, 0.1, 1.4, bx0 - 0.02, 0.5, 0, 0.015, 2));
  for (const s of [1, -1]) {
    asm.add('taillight', box(0.04, 0.08, 0.15, bx0 - 0.065, 0.6, s * 0.6, 0.01, 2));
    asm.add('indicator', box(0.04, 0.08, 0.07, bx0 - 0.065, 0.6, s * 0.48, 0.01, 2));
  }
  asm.plate('plate_rear', bx0 - 0.067, 0.5, -1);

  // Rear mudguards.
  for (const s of [1, -1]) {
    // The upper half of an open cylinder whose axis runs along z.
    const guard = new THREE.CylinderGeometry(archR, archR, 0.2, 24, 1, true, Math.PI / 2, Math.PI);
    guard.rotateX(Math.PI / 2);
    asm.add('trim', place(guard, xr, tyreR, s * zwR));
  }

  // Steel wheels, outer face outward.
  for (const [name, x, z, side] of [['wheel_fl', xf, zwF, -1], ['wheel_fr', xf, zwF, 1], ['wheel_rl', xr, zwR, -1], ['wheel_rr', xr, zwR, 1]]) {
    const w = steelWheel(rimR, tyreW * 0.9);
    asm.wheel(name, { tyre: tyre(tyreR, tyreW, rimR + 0.004, { grooves: 3 }), rim: w.rim, rim_inner: w.rimInner, chrome: w.chrome }, x, tyreR, side * z, side);
  }
}
