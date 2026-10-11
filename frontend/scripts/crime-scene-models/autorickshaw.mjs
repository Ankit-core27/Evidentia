// A Bajaj RE-style auto-rickshaw: 2.65 x 1.3 x 1.74 m, wheelbase 2.0 m, 4.00-8 tyres. Green below
// the waist and yellow above (the Delhi livery), with a black canvas hood on a tubular frame, open
// sides, the driver in front on the centre line and a bench for three behind.
import * as THREE from 'three';
import { box as roundedBox, curve, indexed, loft, mirrorZ, patch, place, rod, smooth, stations, steelWheel, tube, tyre } from './geometry.mjs';

const box = (...args) => indexed(roundedBox(...args));

const hx = 1.325;
const xf = 1.0;
const xr = -1.0;
const tyreR = 0.2;
const tyreW = 0.1;
const rimR = 0.102;
const zwR = 0.575;
const archR = 0.26;
const splitY = 0.62;
// The cowl's split runs a little lower, below the top of its nose.
const splitAt = (x) => (x > 0.7 ? 0.56 : splitY);

// Plan: a narrow rounded nose, the driver's section 1.0 m wide, widening to 1.3 m behind the driver.
function halfWidth(x) {
  const w = 0.5 + 0.15 * smooth((0.05 - x) / 0.4);
  if (x > 0.62) {
    const u = Math.min((x - 0.62) / (hx - 0.62), 1) * 0.985;
    return w * Math.pow(1 - Math.pow(u, 2.3), 1 / 2.3);
  }
  if (x < -1.18) {
    const u = Math.min((-1.18 - x) / (hx - 1.18), 1) * 0.985;
    return w * Math.pow(1 - Math.pow(u, 3), 1 / 3);
  }
  return w;
}

// The top of the lower body: the front cowl and dashboard, the driver's footwell and seat box, the
// passengers' footwell and seat box, and the deck over the engine.
const topLine = curve([
  [-hx, 0.62], [-1.31, 0.84], [-1.28, 0.9], [-1.2, 0.93], [-1.06, 0.93], [-1.02, 0.6], [-0.98, 0.56], [-0.5, 0.56],
  [-0.46, 0.33], [-0.42, 0.32], [-0.04, 0.32], [0.0, 0.55], [0.04, 0.57], [0.34, 0.57], [0.38, 0.35], [0.42, 0.34],
  [0.7, 0.34], [0.74, 0.62], [0.76, 0.94], [0.8, 1.0], [1.0, 1.01], [1.14, 0.995], [1.24, 0.96], [1.29, 0.89],
  [1.315, 0.78], [hx, 0.62]
]);
const under = curve([[-hx, 0.34], [-1.27, 0.26], [-1.1, 0.24], [0.66, 0.24], [0.72, 0.3], [0.78, 0.44], [0.84, 0.46], [1.24, 0.46], [hx, 0.5]]);

function topMaterial(x) {
  if (x > 0.72) return topLine(x) > splitAt(x) ? 'paint_secondary' : 'paint';
  if (x < -1.04) return 'paint_secondary';
  return (x > 0.38 && x < 0.72) || (x > -0.46 && x < -0.02) ? 'rubber' : 'trim';
}

function archTop(x) {
  const d = x - xr;
  return Math.abs(d) < archR ? tyreR + Math.sqrt(archR * archR - d * d) : -Infinity;
}

function frame(x) {
  const w = halfWidth(x);
  const yT = topLine(x);
  const yU = under(x);
  const yS = yU + 0.02;
  const yBo = Math.min(Math.max(yS, archTop(x)), yT - 0.04);
  const rc = Math.min(0.035, (yT - yBo) * 0.4, w * 0.3);
  return { w, yT, yU, yS, yBo, rc };
}

// Sides tuck in slightly at the bottom; the split between the green and the yellow runs at splitY.
const profile = (y, yBot) => 0.965 + 0.035 * smooth((y - yBot) / 0.18);

function bodySection(x) {
  const f = frame(x);
  const zIn = Math.min(zwR - tyreW / 2 - 0.04, f.w * 0.8);
  const pts = [
    { z: 0, y: f.yU, m: 'under' },
    { z: zIn, y: f.yU, m: 'under' },
    { z: zIn, y: f.yBo, m: 'under' }
  ];
  // Green up to the waist and yellow above it, with the split on the same point of every section
  // (a section that doesn't reach the split collapses one of the two runs).
  const yTop = f.yT - f.rc;
  const ySplit = Math.min(Math.max(splitAt(x), f.yBo), yTop);
  const edgeM = f.yT < splitAt(x) ? 'paint' : 'paint_secondary';
  const K1 = 4;
  const K2 = 6;
  for (let k = 0; k < K1; k += 1) {
    const y = f.yBo + (ySplit - f.yBo) * (k / K1);
    pts.push({ z: f.w * profile(y, f.yBo), y, m: 'paint' });
  }
  for (let k = 0; k <= K2; k += 1) {
    const y = ySplit + (yTop - ySplit) * (k / K2);
    pts.push({ z: f.w * profile(y, f.yBo), y, m: k === K2 ? edgeM : 'paint_secondary' });
  }
  const zTop = f.w * profile(yTop, f.yBo);
  for (let k = 1; k <= 3; k += 1) {
    const a = (k / 3) * (Math.PI / 2);
    pts.push({ z: zTop - f.rc + f.rc * Math.cos(a), y: yTop + f.rc * Math.sin(a), m: k === 3 ? topMaterial(x) : edgeM });
  }
  for (let k = 1; k <= 4; k += 1) {
    const z = (zTop - f.rc) * (1 - k / 4);
    pts.push({ z, y: f.yT + 0.006 * (1 - (z / Math.max(zTop - f.rc, 1e-3)) ** 2), m: topMaterial(x) });
  }
  return pts;
}

function bodyZ(x, y) {
  const f = frame(x);
  if (y > f.yT) return -1;
  const yTop = f.yT - f.rc;
  if (y <= yTop) return f.w * profile(Math.max(y, f.yBo), f.yBo);
  const dy = y - yTop;
  return f.w * profile(yTop, f.yBo) - f.rc + Math.sqrt(Math.max(f.rc * f.rc - dy * dy, 0));
}

/** The most forward (sign 1) or rearward (-1) x where the body reaches (z, y). */
function faceX(z, y, sign) {
  let lo = sign > 0 ? 0.9 : -1.0;
  let hi = sign > 0 ? hx : -hx;
  if (bodyZ(hi, y) >= z) return hi;
  for (let k = 0; k < 40; k += 1) {
    const mid = (lo + hi) / 2;
    if (bodyZ(mid, y) >= z) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** A patch on the front (sign 1) or rear (-1) face; u runs across, v upward. */
function facePatch(sign, zOf, yOf, opts) {
  return patch((u, v) => {
    const z = zOf(u, v);
    const y = yOf(u, v);
    return new THREE.Vector3(faceX(Math.abs(z), y, sign), y, z);
  }, opts);
}

/** A flat side panel in the x-y plane (a side-view outline), thickness t, its outer face at z. */
function sidePanel(outline, t, z) {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 12 });
  g.deleteAttribute('uv');
  g.translate(0, 0, z - t - 0.006);
  return indexed(g);
}

function buildBody(asm) {
  const steps = [-1.04, -1.0, -0.48, -0.44, -0.02, 0.02, 0.36, 0.4, 0.72, 0.76];
  const xs = stations(-hx, hx, 0.03, [
    { at: hx, span: 0.1, step: 0.006 },
    { at: -hx, span: 0.06, step: 0.006 },
    { at: xr, span: archR + 0.02, step: 0.012 },
    ...steps.map((at) => ({ at, span: 0.03, step: 0.008 }))
  ]);
  for (const [m, g] of Object.entries(loft(xs, bodySection, { capStart: 'paint', capEnd: 'paint' }))) asm.add(m, g);

  // Rear quarter panels round the passenger bench, standing on the body sides: green up to the waist,
  // yellow above it with a rounded front edge, and a black rubbing strip along the joint.
  const lower = sidePanel([[-1.3, 0.53], [-0.56, 0.53], [-0.56, splitY], [-1.3, splitY]], 0.03, 0.654);
  const upper = sidePanel([[-1.3, splitY], [-0.56, splitY], [-0.56, 0.72], [-0.6, 0.86], [-0.7, 0.95], [-0.86, 0.98], [-1.3, 0.98]], 0.03, 0.654);
  asm.addMirrored('paint', lower);
  asm.addMirrored('paint_secondary', upper);
  asm.addMirrored('trim', box(0.74, 0.026, 0.016, -0.93, splitY, 0.656, 0.006, 1));
}

function buildCanopy(asm) {
  const roofY = 1.7;
  const rx0 = -1.31;
  const rx1 = 0.99;
  const rw = 0.64;
  // Canvas hood: the roof, a valance down each side and the back with a small window.
  asm.add('canvas', box(rx1 - rx0, 0.07, 2 * rw, (rx0 + rx1) / 2, roofY, 0, 0.03, 3));
  for (let x = rx0 + 0.35; x < rx1 - 0.2; x += 0.55) asm.add('canvas', box(0.04, 0.02, 2 * rw - 0.02, x, roofY + 0.037, 0, 0.008, 1));
  asm.add('canvas', box(0.08, 0.035, 2 * rw + 0.02, rx1 - 0.02, roofY - 0.02, 0, 0.012, 2));
  for (const s of [1, -1]) {
    asm.add('canvas', box(rx1 - 0.35 - rx0, 0.1, 0.012, (rx0 + rx1 - 0.35) / 2, roofY - 0.08, s * (rw - 0.005), 0.004, 1));
    asm.add('canvas', box(0.4, 0.72, 0.012, -1.1, 1.3, s * (rw - 0.006), 0.004, 1));
  }
  const back = box(0.02, roofY - 0.93, 2 * rw - 0.02, -1.29, (roofY + 0.93) / 2, 0, 0.006, 1);
  asm.add('canvas', back);
  asm.add('glass', box(0.012, 0.16, 0.5, -1.305, 1.42, 0, 0.004, 1));

  // Tubular frame: windscreen pillars, the pillars behind the driver, the rear corner posts and roof bows.
  const black = 'trim_gloss';
  for (const s of [1, -1]) {
    asm.add('paint_secondary', rod([0.93, 1.0, s * 0.45], [0.86, 1.66, s * 0.55], 0.022, { radial: 10 }));
    asm.add(black, tube([[-0.06, 0.57, s * 0.52], [-0.06, 1.1, s * 0.58], [-0.07, 1.66, s * 0.61]], 0.018, { segments: 12, radial: 8 }));
    asm.add(black, rod([-0.86, 0.97, s * 0.62], [-0.86, 1.66, s * 0.62], 0.016, { radial: 8 }));
    asm.add(black, rod([0.86, 1.65, s * 0.58], [-1.28, 1.65, s * 0.6], 0.014, { radial: 8 }));
    // Grab handle on the pillar behind the driver, for passengers climbing in.
    asm.add('chrome', rod([-0.11, 0.9, s * 0.56], [-0.11, 1.35, s * 0.59], 0.012, { radial: 8 }));
  }
  for (const x of [0.86, -0.07, -1.28]) asm.add(black, rod([x, 1.65, -0.6], [x, 1.65, 0.6], 0.014, { radial: 8 }));
  // Rail across behind the driver.
  asm.add('chrome', rod([-0.06, 0.98, -0.55], [-0.06, 0.98, 0.55], 0.014, { radial: 8 }));

  // Windscreen: glass in a yellow frame, a wiper and the mirrors on the pillars.
  const ws0 = new THREE.Vector3(0.93, 1.0, 0);
  const ws1 = new THREE.Vector3(0.865, 1.6, 0);
  const tilt = Math.atan2(ws0.x - ws1.x, ws1.y - ws0.y);
  const glassAt = (u, v) => {
    const p = ws0.clone().lerp(ws1, v);
    return new THREE.Vector3(p.x, p.y, (0.44 + 0.1 * v) * (1 - 2 * u));
  };
  asm.add('glass', patch(glassAt, { nu: 1, nv: 1, offset: 0.004 }));
  asm.add('glass', patch(glassAt, { nu: 1, nv: 1, offset: 0.004, flip: true }));
  asm.add('paint_secondary', place(box(0.035, 0.045, 1.12, 0, 0, 0, 0.01, 1), ws1.x, ws1.y + 0.02, 0, 0, 0, tilt));
  asm.add('paint_secondary', place(box(0.04, 0.04, 0.92, 0, 0, 0, 0.01, 1), ws0.x + 0.005, ws0.y + 0.015, 0, 0, 0, tilt));
  asm.add('trim', place(new THREE.BoxGeometry(0.012, 0.42, 0.012), 0.915, 1.22, 0.1, 0.35, 0, tilt));
  asm.add('trim', place(new THREE.CylinderGeometry(0.015, 0.015, 0.03, 10), 0.935, 1.03, 0.02, 0, 0, Math.PI / 2));
  for (const s of [1, -1]) {
    asm.add('trim', rod([0.9, 1.3, s * 0.5], [0.95, 1.37, s * 0.57], 0.008, { radial: 6 }));
    const head = new THREE.CylinderGeometry(0.06, 0.06, 0.025, 20);
    head.rotateZ(Math.PI / 2);
    head.scale(1, 0.8, 1);
    asm.add('trim', place(head, 0.955, 1.41, s * 0.6));
    asm.add('chrome', place(new THREE.CylinderGeometry(0.052, 0.052, 0.006, 20).rotateZ(Math.PI / 2).scale(1, 0.8, 1), 0.94, 1.41, s * 0.6));
  }
}

function buildCabin(asm) {
  // Driver's seat with a small backrest, and the passengers' bench.
  asm.add('seat', box(0.32, 0.1, 0.6, 0.21, 0.62, 0, 0.04, 3));
  const driverBack = box(0.07, 0.22, 0.5, 0, 0, 0, 0.03, 2);
  asm.add('seat', place(driverBack, 0.04, 0.8, 0, 0, 0, 0.12));
  for (const z of [0.18, -0.18]) asm.add('trim_gloss', rod([0.02, 0.57, z], [-0.04, 0.98, z], 0.012, { radial: 8 }));
  asm.add('seat', box(0.46, 0.12, 1.16, -0.74, 0.62, 0, 0.05, 3));
  const benchBack = box(0.09, 0.46, 1.16, 0, 0, 0, 0.04, 3);
  asm.add('seat', place(benchBack, -0.99, 0.92, 0, 0, 0, 0.2));

  // Handlebar on its steering column behind the dashboard, with grips and levers.
  asm.add('trim', rod([0.8, 0.9, 0], [0.7, 1.04, 0], 0.025, { radial: 10 }));
  asm.add('chrome', tube([[0.6, 1.0, -0.33], [0.66, 1.035, -0.16], [0.69, 1.045, 0], [0.66, 1.035, 0.16], [0.6, 1.0, 0.33]], 0.012, { segments: 24, radial: 8 }));
  for (const s of [1, -1]) {
    asm.add('rubber', rod([0.62, 1.01, s * 0.28], [0.59, 0.995, s * 0.37], 0.019, { radial: 10 }));
    asm.add('alu', rod([0.64, 1.03, s * 0.24], [0.57, 1.02, s * 0.33], 0.006, { radial: 6 }));
  }
  asm.add('trim', box(0.1, 0.07, 0.16, 0.74, 1.04, 0, 0.02, 2));
}

function buildLamps(asm) {
  // Headlamp in the middle of the cowl, indicators at its corners, plate below.
  const hy = 0.8;
  const hxp = faceX(0, hy, 1);
  asm.add('chrome', place(new THREE.TorusGeometry(0.085, 0.014, 10, 32), hxp + 0.004, hy, 0, 0, Math.PI / 2, 0));
  const lens = new THREE.SphereGeometry(0.085, 24, 8, 0, Math.PI * 2, 0, 0.6);
  lens.rotateZ(-Math.PI / 2);
  asm.add('headlight', place(lens, hxp - 0.06, hy, 0));
  asm.add('trim', place(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 24), hxp - 0.005, hy, 0, 0, 0, Math.PI / 2));
  for (const s of [1, -1]) {
    const ind = facePatch(1, (u) => (s > 0 ? 0.35 - 0.1 * u : -0.25 - 0.1 * u), (_u, v) => 0.86 + 0.06 * v, { nu: 6, nv: 2, offset: 0.006 });
    asm.add('indicator', ind);
  }
  asm.plate('plate_front', faceX(0, 0.565, 1) + 0.006, 0.565, 1, { width: 0.34, height: 0.1 });

  // Rear: tail lamps and indicators at the corners, plate, bumper bar and the silencer.
  for (const s of [1, -1]) {
    const z = s * 0.46;
    asm.add('taillight', box(0.03, 0.1, 0.13, faceX(0.46, 0.6, -1) - 0.008, 0.62, z, 0.012, 2));
    asm.add('indicator', box(0.03, 0.05, 0.13, faceX(0.46, 0.5, -1) - 0.008, 0.51, z, 0.01, 1));
  }
  asm.plate('plate_rear', faceX(0, 0.55, -1) - 0.006, 0.55, -1, { width: 0.34, height: 0.1 });
  asm.add('trim', rod([-hx - 0.02, 0.33, -0.55], [-hx - 0.02, 0.33, 0.55], 0.022, { radial: 10 }));
  for (const s of [1, -1]) asm.add('trim', rod([-hx - 0.02, 0.33, s * 0.4], [-1.22, 0.3, s * 0.4], 0.015, { radial: 8 }));
  asm.add('trim', place(new THREE.CylinderGeometry(0.055, 0.055, 0.32, 14), -1.12, 0.22, 0.32, 0, 0, Math.PI / 2));
  asm.add('chrome', place(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 10), -1.31, 0.22, 0.32, 0, 0, Math.PI / 2));
}

function buildRunningGear(asm) {
  // Front fork and mudguard; rear axle under the body.
  for (const s of [1, -1]) asm.add('trim_gloss', rod([1.06, 0.47, s * 0.08], [xf, tyreR, s * 0.08], 0.02, { radial: 10 }));
  // An open arc over the front and top of the wheel (theta runs from below the axle, through the front, to the top).
  const guard = new THREE.CylinderGeometry(0.245, 0.245, 0.15, 24, 1, true, 1.75, 1.9);
  guard.rotateX(Math.PI / 2);
  asm.add('paint', indexed(place(guard, xf, tyreR, 0)));
  asm.add('under', place(new THREE.CylinderGeometry(0.035, 0.035, 2 * zwR - 0.1, 10), xr, tyreR, 0, Math.PI / 2, 0, 0));
  asm.add('cast', box(0.35, 0.16, 0.5, -0.82, 0.24, -0.05, 0.03, 2));

  const wheelParts = () => {
    const w = steelWheel(rimR, tyreW * 0.8, { holes: 4, segments: 28 });
    return { tyre: tyre(tyreR, tyreW, rimR + 0.004, { grooves: 3, segments: 36 }), rim: w.rim, rim_inner: w.rimInner, chrome: w.chrome };
  };
  asm.wheel('wheel_front', wheelParts(), xf, tyreR, 0, 1);
  asm.wheel('wheel_rl', wheelParts(), xr, tyreR, -zwR, -1);
  asm.wheel('wheel_rr', wheelParts(), xr, tyreR, zwR, 1);
}

export function buildAutoRickshaw(asm) {
  buildBody(asm);
  buildCanopy(asm);
  buildCabin(asm);
  buildLamps(asm);
  buildRunningGear(asm);
}
