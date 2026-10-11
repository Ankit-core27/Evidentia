// A white Maruti Swift-style hatchback (3rd generation): 3.845 x 1.735 x 1.53 m,
// wheelbase 2.45 m, 185/65 R15 tyres. Right-hand drive, so the driver sits on +z.
import * as THREE from 'three';
import { alloyWheel, box, curve, loft, mirrorZ, patch, place, smooth, stations, tyre } from './geometry.mjs';

/** A roof spoiler: a thin rounded wedge across the car. */
class RoundedSpoiler extends THREE.ExtrudeGeometry {
  constructor(width) {
    const s = new THREE.Shape();
    s.moveTo(0.06, 0);
    s.quadraticCurveTo(0.02, 0.03, -0.12, 0.012);
    s.lineTo(-0.12, -0.004);
    s.quadraticCurveTo(0, 0.0, 0.06, -0.012);
    s.closePath();
    super(s, { depth: width, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.004, bevelSegments: 2 });
    this.translate(0, 0, -width / 2);
  }
}

const L = 3.845;
const hx = L / 2;
const wMax = 1.735 / 2;
const xf = hx - 0.74;
const xr = xf - 2.45;
const tyreR = 0.311;
const tyreW = 0.185;
const rimR = 0.19;
const zw = 1.52 / 2;
const archR = 0.375;

const frontStart = 1.5;
const rearStart = -1.66;

const flare = (x) =>
  [xf, xr].reduce((acc, xc) => acc + 0.016 * Math.exp(-(((x - xc) / 0.42) ** 2)), 0) - 0.008;

function halfWidth(x) {
  return halfWidthPlan(x) * (1 + flare(x));
}

function halfWidthPlan(x) {
  if (x > frontStart) {
    const u = Math.min((x - frontStart) / (hx - frontStart), 1) * 0.985;
    return wMax * Math.pow(1 - Math.pow(u, 2.6), 1 / 2.6);
  }
  if (x < rearStart) {
    const u = Math.min((rearStart - x) / (rearStart + hx), 1) * 0.985;
    return wMax * Math.pow(1 - Math.pow(u, 3.4), 1 / 3.4);
  }
  return wMax;
}

export const topLine = curve([
  [-hx, 0.84], [-1.905, 0.95], [-1.875, 1.01], [-1.8, 1.035], [-1.5, 1.045], [-1.0, 1.025], [-0.2, 0.995],
  [0.4, 0.98], [0.8, 0.965], [1.1, 0.93], [1.4, 0.885], [1.65, 0.845], [1.78, 0.81], [1.83, 0.785],
  [1.87, 0.745], [1.9, 0.7], [hx, 0.66]
]);
const sill = curve([[-hx, 0.42], [-1.87, 0.36], [-1.7, 0.31], [-1.5, 0.29], [1.45, 0.28], [1.7, 0.27], [1.88, 0.29], [hx, 0.33]]);
const under = curve([[-hx, 0.42], [-1.86, 0.34], [-1.72, 0.22], [-1.5, 0.17], [1.5, 0.17], [1.72, 0.23], [1.88, 0.29], [hx, 0.33]]);

function archTop(x) {
  let y = -Infinity;
  for (const xc of [xf, xr]) {
    const d = x - xc;
    if (Math.abs(d) < archR) y = Math.max(y, tyreR + Math.sqrt(archR * archR - d * d));
  }
  return y;
}

// Tucked under at the sill, widest at a crisp shoulder line, then tumbling in to the glass.
const shoulderY = 0.84;
function profile(y, yBot) {
  if (y < shoulderY) return 0.945 + 0.055 * Math.pow(smooth((y - yBot) / Math.max(shoulderY - yBot, 1e-3)), 0.7);
  return 1 - 0.075 * Math.pow(Math.min((y - shoulderY) / (1.08 - shoulderY), 1), 1.2);
}

/** Cross-section dimensions at x, shared by the loft and by anything placed on the body. */
function frame(x) {
  const w = halfWidth(x);
  const yT = topLine(x);
  const yS = sill(x);
  const yBo = Math.max(yS, archTop(x));
  const rcBase = 0.065;
  const zTopRaw = w * profile(yT - rcBase, yS);
  const rc = Math.min(rcBase, zTopRaw * 0.5);
  const ySideTop = yT - rc;
  const zTop = w * profile(ySideTop, yS);
  return { w, yT, yS, yBo, rc, ySideTop, zTop, zFlat: zTop - rc };
}

/** Distance of the body surface from the centre line at (x, y), or -1 above the body. */
export function bodyZ(x, y) {
  const f = frame(x);
  if (y > f.yT) return -1;
  if (y <= f.ySideTop) return f.w * profile(Math.max(y, f.yS), f.yS);
  const dy = y - f.ySideTop;
  return f.zTop - f.rc + Math.sqrt(Math.max(f.rc * f.rc - dy * dy, 0));
}

/** The most forward (sign 1) or rearward (sign -1) x where the body reaches (z, y). */
function faceX(z, y, sign) {
  let lo = sign > 0 ? 0.8 : -0.8;
  let hi = sign > 0 ? hx : -hx;
  if (bodyZ(hi, y) >= z) return hi;
  for (let k = 0; k < 40; k += 1) {
    const mid = (lo + hi) / 2;
    if (bodyZ(mid, y) >= z) lo = mid;
    else hi = mid;
  }
  return lo;
}

function bodySection(x) {
  const f = frame(x);
  const yU = under(x);
  const zIn = Math.min(zw - tyreW / 2 - 0.035, f.w * 0.72);
  const pts = [
    { z: 0, y: yU, m: 'under' },
    { z: zIn, y: yU, m: 'under' },
    { z: zIn, y: f.yBo, m: 'under' }
  ];
  const K = 10;
  for (let k = 0; k <= K; k += 1) {
    const y = f.yBo + (f.ySideTop - f.yBo) * (k / K);
    pts.push({ z: f.w * profile(y, f.yS), y, m: 'paint' });
  }
  for (let k = 1; k <= 5; k += 1) {
    const a = (k / 5) * (Math.PI / 2);
    pts.push({ z: f.zTop - f.rc + f.rc * Math.cos(a), y: f.ySideTop + f.rc * Math.sin(a), m: 'paint' });
  }
  for (let k = 1; k <= 5; k += 1) {
    const z = f.zFlat * (1 - k / 5);
    const t = z / Math.max(f.zFlat, 1e-3);
    pts.push({ z, y: f.yT + 0.022 * (1 - t * t), m: 'paint' });
  }
  return pts;
}

// Greenhouse: windscreen, side glass and rear glass, on top of the body.
const gx0 = -1.835;
const gx1 = 0.8;
const roofKeys = curve([
  [-1.835, 1.03], [-1.815, 1.09], [-1.77, 1.17], [-1.68, 1.28], [-1.56, 1.39], [-1.44, 1.455], [-1.2, 1.5],
  [-0.9, 1.522], [-0.5, 1.528], [-0.2, 1.505], [0.0, 1.455], [0.25, 1.335], [0.55, 1.145], [0.8, 0.965]
]);
function glassFrame(x) {
  const f = frame(x);
  const base = f.yT - 0.004;
  const top = Math.max(roofKeys(x), base);
  const wb = Math.max(f.zFlat - 0.012, 0.05);
  const wt = Math.max(Math.min(0.64, wb - 0.075), 0.04);
  return { base, top, wb, wt };
}
function glassSection(x) {
  const g = glassFrame(x);
  const h = g.top - g.base;
  const rg = Math.min(0.06, h * 0.4);
  const pts = [{ z: 0, y: g.base, m: 'glass' }, { z: g.wb, y: g.base, m: 'glass' }];
  const K = 6;
  for (let k = 1; k <= K; k += 1) {
    const t = k / K;
    pts.push({ z: g.wb + (g.wt - g.wb) * t, y: g.base + (h - rg) * t, m: 'glass' });
  }
  for (let k = 1; k <= 4; k += 1) {
    const a = (k / 4) * (Math.PI / 2);
    pts.push({ z: g.wt - rg + rg * Math.cos(a), y: g.top - rg + rg * Math.sin(a), m: 'glass' });
  }
  for (let k = 1; k <= 3; k += 1) {
    const z = (g.wt - rg) * (1 - k / 3);
    pts.push({ z, y: g.top + 0.012 * (1 - (z / Math.max(g.wt - rg, 1e-3)) ** 2), m: 'glass' });
  }
  return pts;
}

// The white roof panel over the glass (the Swift's floating roof).
function roofSection(x) {
  const g = glassFrame(x);
  const rg = 0.06;
  const pts = [
    { z: 0, y: g.top - 0.004, m: 'paint' },
    { z: g.wt - rg, y: g.top - 0.004, m: 'paint' }
  ];
  for (let k = 0; k <= 6; k += 1) {
    const a = -0.3 + (k / 6) * (Math.PI / 2 + 0.3);
    pts.push({ z: g.wt - rg + (rg + 0.008) * Math.cos(a), y: g.top - rg + (rg + 0.008) * Math.sin(a), m: 'paint' });
  }
  for (let k = 1; k <= 3; k += 1) {
    const z = (g.wt - rg) * (1 - k / 3);
    pts.push({ z, y: g.top + 0.02 * (1 - (z / (g.wt - rg)) ** 2) + 0.008, m: 'paint' });
  }
  return pts;
}

/** A patch on the right side of the body; u runs forward along x, v upward. */
function sidePatch(xOf, yOf, opts) {
  return patch((u, v) => {
    const x = xOf(u, v);
    const y = yOf(x, v);
    return new THREE.Vector3(x, y, Math.max(bodyZ(x, y), 0));
  }, opts);
}

/** A patch on the front (sign 1) or rear (-1) face; u runs across, v upward. */
function facePatch(sign, zOf, yOf, opts) {
  return patch((u, v) => {
    const z = zOf(u, v);
    const y = yOf(u, v);
    return new THREE.Vector3(faceX(Math.abs(z), y, sign), y, z);
  }, opts);
}

export function buildHatchback(asm) {
  const xs = stations(-hx, hx, 0.03, [
    { at: hx, span: 0.12, step: 0.006 },
    { at: -hx, span: 0.1, step: 0.006 },
    { at: xf, span: archR + 0.02, step: 0.012 },
    { at: xr, span: archR + 0.02, step: 0.012 }
  ]);
  for (const [m, g] of Object.entries(loft(xs, bodySection, { capStart: 'paint', capEnd: 'paint' }))) asm.add(m, g);

  const gxs = stations(gx0, gx1, 0.025, [{ at: gx0, span: 0.06, step: 0.006 }, { at: gx1, span: 0.05, step: 0.006 }]);
  for (const [m, g] of Object.entries(loft(gxs, glassSection, { capStart: null, capEnd: null }))) asm.add(m, g);
  const rxs = stations(-1.4, -0.16, 0.03, [{ at: -1.4, span: 0.02, step: 0.005 }, { at: -0.16, span: 0.02, step: 0.005 }]);
  for (const [m, g] of Object.entries(loft(rxs, roofSection))) asm.add(m, g);

  // Roof spoiler with the high-mounted stop lamp.
  const sp = glassFrame(-1.42);
  asm.add('paint', place(new RoundedSpoiler(2 * sp.wt + 0.02), -1.44, sp.top + 0.004, 0, 0, 0, 0.22));
  asm.add('taillight', place(new THREE.BoxGeometry(0.02, 0.016, 0.3), -1.51, sp.top - 0.012, 0, 0, 0, 0.22));

  // Headlamps: swept back along the front corners, below the hood line.
  const hlX0 = 1.58;
  const hlX1 = 1.885;
  const headlamp = sidePatch(
    (u) => hlX0 + (hlX1 - hlX0) * (1 - Math.pow(1 - u, 2.2)),
    (x, v) => {
      const t = (x - hlX0) / (hlX1 - hlX0);
      const lo = 0.81 + (0.645 - 0.81) * Math.pow(t, 0.8);
      const hi = Math.min(0.84 + (0.795 - 0.84) * t, topLine(x) - 0.022);
      return lo + (hi - lo) * v;
    },
    { nu: 30, nv: 6, offset: 0.004 }
  );
  asm.addMirrored('headlight', headlamp);
  // Projector lenses and a chrome strip inside each headlamp.
  for (const [x, y] of [[1.8, 0.735], [1.71, 0.77]]) {
    const z = bodyZ(x, y) + 0.003;
    const lens = place(new THREE.SphereGeometry(0.032, 16, 8), x, y, z - 0.012);
    lens.scale(1, 1, 1);
    asm.addMirrored('chrome', lens);
  }
  // Tail lamps: tall, on the rear corners, wrapping onto the tailgate.
  const tlX0 = -1.906;
  const tlX1 = -1.73;
  const tail = sidePatch(
    (u) => tlX0 + (tlX1 - tlX0) * Math.pow(u, 1.8),
    (x, v) => {
      const t = (x - tlX0) / (tlX1 - tlX0);
      const lo = 0.79 + 0.04 * t;
      const hi = Math.min(1.045 - 0.02 * t, topLine(x) - 0.02);
      return lo + (hi - lo) * v;
    },
    { nu: 24, nv: 8, offset: 0.004 }
  );
  asm.addMirrored('taillight', tail);

  // Front: grille, lower intake, emblem and plate.
  const grille = facePatch(
    1,
    (u, v) => -(0.33 + 0.07 * v) * (2 * u - 1),
    (_u, v) => 0.56 + 0.15 * v,
    { nu: 30, nv: 6, offset: 0.004 }
  );
  asm.add('trim_gloss', grille);
  const intake = facePatch(1, (u) => -0.56 * (2 * u - 1), (_u, v) => 0.275 + 0.12 * v, { nu: 30, nv: 4, offset: 0.004 });
  asm.add('trim', intake);
  for (const s of [1, -1]) {
    const fog = place(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 20), faceX(0.64, 0.34, 1) - 0.01, 0.34, s * 0.64, 0, 0, Math.PI / 2);
    asm.add('headlight', fog);
  }
  // Squashed to an oval before it is placed, so the scale doesn't move it.
  const emblem = place(new THREE.TorusGeometry(0.045, 0.008, 8, 28).scale(1, 0.75, 1), faceX(0, 0.635, 1) + 0.008, 0.635, 0, 0, Math.PI / 2, 0);
  asm.add('chrome', emblem);
  asm.plate('plate_front', faceX(0, 0.485, 1) + 0.007, 0.485, 1);

  // Rear: bumper diffuser, reflectors and plate.
  asm.add('trim', facePatch(-1, (u) => 0.6 * (2 * u - 1), (_u, v) => 0.37 + 0.09 * v, { nu: 30, nv: 4, offset: 0.004 }));
  for (const s of [1, -1]) asm.add('taillight', place(new THREE.BoxGeometry(0.012, 0.03, 0.14), faceX(0.55, 0.5, -1) - 0.006, 0.5, s * 0.55));
  asm.plate('plate_rear', faceX(0, 0.72, -1) - 0.007, 0.72, -1);
  asm.add('chrome', place(new THREE.BoxGeometry(0.008, 0.012, 0.5), faceX(0, 0.8, -1) - 0.006, 0.8, 0));

  // Side mirrors, door handles and wipers.
  const mz = bodyZ(0.66, 0.97) + 0.11;
  const mirror = box(0.12, 0.1, 0.2, 0.62, 1.05, mz, 0.035, 4);
  asm.addMirrored('paint', mirror);
  asm.addMirrored('trim', box(0.1, 0.04, 0.1, 0.66, 0.995, mz - 0.07, 0.01, 1));
  asm.addMirrored('glass', box(0.012, 0.075, 0.16, 0.555, 1.05, mz, 0.004, 1));
  for (const x of [0.0]) asm.addMirrored('paint', box(0.13, 0.024, 0.02, x, 0.92, bodyZ(x, 0.92) + 0.008, 0.008, 2));
  asm.addMirrored('trim', box(0.035, 0.12, 0.012, -1.33, 1.09, glassFrame(-1.33).wb - 0.005, 0.005, 1));
  for (const z of [0.16, -0.38]) {
    const wiper = place(new THREE.BoxGeometry(0.014, 0.012, 0.52), 0.755, 0.995, z, 0, 0.12, 0.4);
    asm.add('trim', wiper);
  }

  // Door shut lines and the fuel flap.
  const seam = (x, yFrom) =>
    sidePatch(
      (u) => x - 0.0025 + 0.005 * u,
      (xx, v) => yFrom(xx) + (topLine(xx) - 0.03 - yFrom(xx)) * v,
      { nu: 1, nv: 16, offset: 0.0015 }
    );
  for (const x of [0.72, -0.27, -0.9]) asm.addMirrored('seam', seam(x, (xx) => Math.max(sill(xx), archTop(xx)) + 0.02));
  const lowerSeam = sidePatch((u) => -0.9 + (0.72 + 0.9) * u, (_x, v) => 0.33 + 0.004 * v, { nu: 40, nv: 1, offset: 0.0015 });
  asm.addMirrored('seam', lowerSeam);

  // Wheels, outer face outward.
  for (const [name, x, side] of [['wheel_fl', xf, -1], ['wheel_fr', xf, 1], ['wheel_rl', xr, -1], ['wheel_rr', xr, 1]]) {
    const w = alloyWheel(rimR, tyreW * 0.92, { spokes: 10 });
    asm.wheel(name, { tyre: tyre(tyreR, tyreW, rimR + 0.005), rim: w.rim, rim_inner: w.rimInner, chrome: w.chrome, brake: w.brake }, x, tyreR, side * zw, side);
  }
}
