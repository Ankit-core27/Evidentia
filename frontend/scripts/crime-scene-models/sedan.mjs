// A silver Honda City-style sedan (5th generation; the Hyundai Verna is close): 4.55 x 1.75 x 1.49 m,
// wheelbase 2.60 m, 185/55 R16 tyres on 16-inch alloys. Right-hand drive, so the driver sits on +z.
// Built like the hatchback: a lofted body, a greenhouse with the roof and pillars in body colour,
// and lamps, glass and seams laid on the surfaces as patches.
import * as THREE from 'three';
import { alloyWheel, box as roundedBox, curve, indexed, loft, mirrorZ, patch, place, smooth, stations, tyre } from './geometry.mjs';

const box = (...args) => indexed(roundedBox(...args));

const L = 4.55;
const hx = L / 2;
const wMax = 1.75 / 2;
const xf = hx - 0.93;
const xr = xf - 2.6;
const tyreR = 0.305;
const tyreW = 0.185;
const rimR = 0.203;
const zw = 1.5 / 2;
const archR = 0.37;

const frontStart = 1.78;
const rearStart = -1.92;

const flare = (x) =>
  [xf, xr].reduce((acc, xc) => acc + 0.014 * Math.exp(-(((x - xc) / 0.45) ** 2)), 0) - 0.007;

function halfWidthPlan(x) {
  if (x > frontStart) {
    const u = Math.min((x - frontStart) / (hx - frontStart), 1) * 0.985;
    return wMax * Math.pow(1 - Math.pow(u, 2.6), 1 / 2.6);
  }
  if (x < rearStart) {
    const u = Math.min((rearStart - x) / (rearStart + hx), 1) * 0.985;
    return wMax * Math.pow(1 - Math.pow(u, 3.6), 1 / 3.6);
  }
  return wMax;
}

const halfWidth = (x) => halfWidthPlan(x) * (1 + flare(x));

// Body top: boot lid, the waist rising gently to the rear, then the bonnet falling to the nose.
const topLine = curve([
  [-hx, 0.86], [-2.262, 0.95], [-2.246, 1.012], [-2.218, 1.048], [-2.16, 1.066], [-2.0, 1.074], [-1.8, 1.072],
  [-1.6, 1.066], [-1.2, 1.052], [-0.6, 1.028], [0.0, 1.004], [0.5, 0.988], [0.92, 0.97], [1.2, 0.952], [1.5, 0.92],
  [1.8, 0.88], [2.0, 0.856], [2.12, 0.834], [2.2, 0.814], [2.25, 0.792], [hx, 0.762]
]);
const sill = curve([[-hx, 0.42], [-2.2, 0.37], [-2.05, 0.32], [-1.8, 0.295], [1.6, 0.285], [1.85, 0.28], [2.12, 0.3], [hx, 0.34]]);
const under = curve([[-hx, 0.42], [-2.2, 0.34], [-2.05, 0.24], [-1.8, 0.175], [1.6, 0.17], [1.85, 0.22], [2.12, 0.29], [hx, 0.34]]);

function archTop(x) {
  let y = -Infinity;
  for (const xc of [xf, xr]) {
    const d = x - xc;
    if (Math.abs(d) < archR) y = Math.max(y, tyreR + Math.sqrt(archR * archR - d * d));
  }
  return y;
}

// Tucked under at the sill, widest at the shoulder crease, then tumbling in to the glass.
const shoulderY = 0.86;
function profile(y, yBot) {
  if (y < shoulderY) return 0.945 + 0.055 * Math.pow(smooth((y - yBot) / Math.max(shoulderY - yBot, 1e-3)), 0.7);
  return 1 - 0.075 * Math.pow(Math.min((y - shoulderY) / (1.09 - shoulderY), 1), 1.2);
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
function bodyZ(x, y) {
  const f = frame(x);
  if (y > f.yT) return -1;
  if (y <= f.ySideTop) return f.w * profile(Math.max(y, f.yS), f.yS);
  const dy = y - f.ySideTop;
  return f.zTop - f.rc + Math.sqrt(Math.max(f.rc * f.rc - dy * dy, 0));
}

/** Height of the body's top surface (bonnet or boot lid) at (x, z), with its crown. */
function deckY(x, z) {
  const f = frame(x);
  const t = Math.min(Math.abs(z) / Math.max(f.zFlat, 1e-3), 1);
  return f.yT + 0.022 * (1 - t * t);
}

/** The most forward (sign 1) or rearward (sign -1) x where the body reaches (z, y). */
function faceX(z, y, sign) {
  let lo = sign > 0 ? 1.0 : -1.0;
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
  const K = 12;
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
    pts.push({ z, y: deckY(x, z), m: 'paint' });
  }
  return pts;
}

// Greenhouse: windscreen, roof and rear glass in one loft. The roof and pillars are body colour;
// the side windows are laid on as patches.
const gx0 = -1.66;
const gx1 = 0.92;
const roofX0 = -0.86;
const roofX1 = 0.12;
const roofKeys = curve([
  [-1.66, 1.062], [-1.62, 1.098], [-1.52, 1.168], [-1.36, 1.258], [-1.16, 1.342], [-0.96, 1.41], [-0.76, 1.452],
  [-0.5, 1.474], [-0.2, 1.478], [0.0, 1.467], [0.14, 1.442], [0.3, 1.374], [0.5, 1.262], [0.7, 1.13], [0.84, 1.03],
  [0.92, 0.968]
]);
function glassFrame(x) {
  const f = frame(x);
  const base = f.yT - 0.004;
  const top = Math.max(roofKeys(x), base);
  const wb = Math.max(f.zFlat - 0.012, 0.05);
  const wt = Math.max(Math.min(0.632, wb - 0.08), 0.04);
  const h = top - base;
  return { base, top, wb, wt, rg: Math.min(0.06, h * 0.4) };
}
function glassSection(x) {
  const g = glassFrame(x);
  const e = 1e-6;
  const roof = x >= roofX0 - e && x < roofX1 - e;
  // A black ceramic band where the glass meets the roof and the pillars.
  const frit = (x >= roofX1 - e && x < roofX1 + 0.035 - e) || (x >= roofX0 - 0.035 - e && x < roofX0 - e);
  const topM = roof ? 'paint' : frit ? 'trim_gloss' : 'glass';
  const edgeM = roof ? 'paint' : 'trim_gloss';
  const pts = [{ z: 0, y: g.base, m: 'paint' }, { z: g.wb, y: g.base, m: 'paint' }];
  const K = 6;
  for (let k = 1; k <= K; k += 1) {
    const t = k / K;
    pts.push({ z: g.wb + (g.wt - g.wb) * t, y: g.base + (g.top - g.base - g.rg) * t, m: 'paint' });
  }
  for (let k = 1; k <= 4; k += 1) {
    const a = (k / 4) * (Math.PI / 2);
    pts.push({ z: g.wt - g.rg + g.rg * Math.cos(a), y: g.top - g.rg + g.rg * Math.sin(a), m: k === 4 ? edgeM : 'paint' });
  }
  const N = 7;
  for (let k = 1; k <= N; k += 1) {
    const z = (g.wt - g.rg) * (1 - k / N);
    pts.push({ z, y: g.top + 0.012 * (1 - (z / Math.max(g.wt - g.rg, 1e-3)) ** 2), m: topM });
  }
  return pts;
}

/** Distance of the greenhouse's side from the centre line at (x, y). */
function glassZ(x, y) {
  const g = glassFrame(x);
  const yk = g.top - g.rg;
  if (y <= yk) return g.wb + (g.wt - g.wb) * Math.min(Math.max((y - g.base) / Math.max(yk - g.base, 1e-4), 0), 1);
  const dy = Math.min(y - yk, g.rg);
  return g.wt - g.rg + Math.sqrt(Math.max(g.rg * g.rg - dy * dy, 0));
}

// Side windows: from the waist up to the roof rail, cut by the A-pillar (which follows the windscreen)
// and by the broad C-pillar (parallel to the rear glass, 0.3 m further forward).
const softMin = (a, b, k = 0.02) => -k * Math.log(Math.exp(-a / k) + Math.exp(-b / k));
const winLow = (x) => topLine(x) + 0.03;
function winHigh(x) {
  const g = glassFrame(x);
  const top = g.top - g.rg - 0.014;
  const gc = glassFrame(x + 0.3);
  const cLine = gc.top - gc.rg - 0.014;
  return softMin(top, cLine);
}
function winEnds() {
  let x0 = gx0;
  let x1 = gx1;
  for (let x = gx0; x < gx1; x += 0.002) if (winHigh(x) > winLow(x)) { x0 = x; break; }
  for (let x = gx1; x > gx0; x -= 0.002) if (winHigh(x) > winLow(x)) { x1 = x; break; }
  return [x0, x1];
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

/** A patch on the bonnet or boot lid; u runs along x, v across (towards -z), facing up. */
function deckPatch(xOf, zOf, opts) {
  return patch((u, v) => {
    const x = xOf(u, v);
    const z = zOf(x, v);
    return new THREE.Vector3(x, deckY(x, z), z);
  }, { ...opts, flip: false });
}

export function buildSedan(asm) {
  const xs = stations(-hx, hx, 0.03, [
    { at: hx, span: 0.14, step: 0.006 },
    { at: -hx, span: 0.1, step: 0.006 },
    { at: xf, span: archR + 0.02, step: 0.012 },
    { at: xr, span: archR + 0.02, step: 0.012 }
  ]);
  for (const [m, g] of Object.entries(loft(xs, bodySection, { capStart: 'paint', capEnd: 'paint' }))) asm.add(m, g);

  const gxs = stations(gx0, gx1, 0.025, [
    { at: gx0, span: 0.06, step: 0.006 },
    { at: gx1, span: 0.05, step: 0.006 },
    { at: roofX0, span: 0.04, step: 0.005 },
    { at: roofX1, span: 0.04, step: 0.005 }
  ]);
  for (const x of [roofX0, roofX1, roofX0 - 0.035, roofX1 + 0.035]) gxs.push(x);
  gxs.sort((a, b) => a - b);
  for (const [m, g] of Object.entries(loft([...new Set(gxs)], glassSection, { capStart: null, capEnd: null }))) asm.add(m, g);

  // Side windows: a black surround, the front and rear door glass, the B-pillar and the quarter-glass bar.
  const [wx0, wx1] = winEnds();
  const xB0 = -0.245;
  const xB1 = -0.15;
  const xQ = -0.93;
  const pane = (xa, xb, grow, offset, nu = 40) =>
    patch((u, v) => {
      const x = xa + (xb - xa) * u;
      const lo = winLow(x) - grow;
      const hi = Math.max(winHigh(x) + grow, lo + 1e-4);
      const y = lo + (hi - lo) * v;
      return new THREE.Vector3(x, y, glassZ(x, y));
    }, { nu, nv: 4, offset });
  asm.addMirrored('trim_gloss', pane(wx0 - 0.012, wx1 + 0.012, 0.014, 0.003, 60));
  asm.addMirrored('glass', pane(xB1 + 0.008, wx1, 0, 0.005));
  asm.addMirrored('glass', pane(wx0, xB0 - 0.008, 0, 0.005));
  asm.addMirrored('trim_gloss', pane(xQ - 0.013, xQ + 0.013, 0.004, 0.006, 2));
  asm.addMirrored('trim_gloss', pane(xB0 - 0.006, xB1 + 0.006, 0.006, 0.0042, 4));
  asm.addMirrored('chrome', patch((u, v) => {
    const x = wx0 + 0.02 + (wx1 - wx0 - 0.07) * u;
    const y = winLow(x) - 0.024 + 0.012 * v;
    return new THREE.Vector3(x, y, glassZ(x, y));
  }, { nu: 50, nv: 1, offset: 0.006 }));

  // Roof aerial (shark fin).
  const fin = new THREE.SphereGeometry(0.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  fin.scale(1.0, 0.55, 0.3);
  asm.add('trim_gloss', place(fin, roofX0 + 0.11, roofKeys(roofX0 + 0.11) + 0.006, 0));

  // Headlamps: slim, swept back along the front corners under the bonnet line.
  const hlX0 = 1.9;
  const hlX1 = 2.248;
  const headlamp = sidePatch(
    (u) => hlX0 + (hlX1 - hlX0) * (1 - Math.pow(1 - u, 2.2)),
    (x, v) => {
      const t = (x - hlX0) / (hlX1 - hlX0);
      const lo = 0.83 + (0.69 - 0.83) * Math.pow(t, 0.75);
      const hi = Math.min(0.862 + (0.762 - 0.862) * t, topLine(x) - 0.016);
      return lo + (hi - lo) * v;
    },
    { nu: 30, nv: 6, offset: 0.004 }
  );
  asm.addMirrored('headlight', headlamp);
  // LED projector lenses and a daytime-running strip inside each headlamp.
  for (const [x, y] of [[2.19, 0.738], [2.12, 0.765]]) {
    const z = bodyZ(x, y) + 0.004;
    asm.addMirrored('chrome', place(new THREE.SphereGeometry(0.028, 16, 8), x, y, z - 0.012));
  }
  const drl = sidePatch(
    (u) => 1.97 + (2.24 - 1.97) * u,
    (x, v) => {
      const t = (x - 1.97) / (2.24 - 1.97);
      return 0.818 + (0.705 - 0.818) * Math.pow(t, 0.75) + 0.008 * v;
    },
    { nu: 24, nv: 1, offset: 0.007 }
  );
  asm.addMirrored('chrome', drl);

  // Front: chrome wing across the nose, grille, lower intake, fog lamps, emblem and plate.
  asm.add('chrome', facePatch(1, (u) => -0.47 * (2 * u - 1), (_u, v) => 0.722 + 0.024 * v, { nu: 40, nv: 2, offset: 0.006 }));
  asm.add('trim_gloss', facePatch(1, (u, v) => -(0.38 + 0.05 * v) * (2 * u - 1), (_u, v) => 0.57 + 0.145 * v, { nu: 30, nv: 6, offset: 0.004 }));
  for (let k = 0; k < 3; k += 1) {
    const y = 0.6 + k * 0.04;
    asm.add('trim', facePatch(1, (u) => -0.37 * (2 * u - 1), (_u, v) => y + 0.006 * v, { nu: 24, nv: 1, offset: 0.006 }));
  }
  asm.add('trim', facePatch(1, (u) => -0.56 * (2 * u - 1), (_u, v) => 0.29 + 0.13 * v, { nu: 30, nv: 4, offset: 0.004 }));
  for (const s of [1, -1]) {
    const z = s * 0.66;
    const x = faceX(0.66, 0.42, 1);
    asm.add('trim_gloss', place(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 24), x - 0.012, 0.42, z, 0, 0, Math.PI / 2));
    asm.add('headlight', place(new THREE.CylinderGeometry(0.036, 0.036, 0.012, 20), x - 0.006, 0.42, z, 0, 0, Math.PI / 2));
  }
  const emblem = new THREE.TorusGeometry(0.05, 0.009, 8, 28).scale(1, 0.72, 1);
  asm.add('chrome', place(emblem, faceX(0, 0.734, 1) + 0.014, 0.734, 0, 0, Math.PI / 2, 0));
  asm.plate('plate_front', faceX(0, 0.5, 1) + 0.007, 0.5, 1);

  // Tail lamps: wedge-shaped, on the boot lid and wrapping round the rear quarters, joined by a chrome bar.
  const tlLo = (z) => 0.915 - 0.035 * ((z - 0.3) / 0.36);
  const tlHi = (z) => 0.975 + 0.01 * ((z - 0.3) / 0.36);
  asm.addMirrored('taillight', facePatch(-1, (u) => 0.3 + 0.37 * u, (u, v) => {
    const z = 0.3 + 0.37 * u;
    return tlLo(z) + (tlHi(z) - tlLo(z)) * v;
  }, { nu: 16, nv: 5, offset: 0.004 }));
  const tlX0 = -2.248;
  const tlX1 = -2.02;
  asm.addMirrored('taillight', sidePatch(
    (u) => tlX0 + (tlX1 - tlX0) * Math.pow(u, 1.4),
    (x, v) => {
      const t = (x - tlX0) / (tlX1 - tlX0);
      const lo = 0.878 + 0.075 * Math.pow(t, 1.3);
      const hi = Math.min(0.986 - 0.008 * t, topLine(x) - 0.025);
      return lo + (hi - lo) * v;
    },
    { nu: 20, nv: 5, offset: 0.004 }
  ));
  asm.add('chrome', facePatch(-1, (u) => 0.31 * (2 * u - 1), (_u, v) => 0.932 + 0.016 * v, { nu: 30, nv: 1, offset: 0.006 }));
  asm.add('chrome', place(new THREE.BoxGeometry(0.01, 0.03, 0.14), faceX(0, 0.86, -1) - 0.006, 0.86, 0));

  // Rear bumper: plate recess, reflectors and a dark diffuser.
  asm.plate('plate_rear', faceX(0, 0.6, -1) - 0.007, 0.6, -1);
  asm.add('trim', facePatch(-1, (u) => 0.62 * (2 * u - 1), (_u, v) => 0.4 + 0.075 * v, { nu: 30, nv: 4, offset: 0.004 }));
  for (const s of [1, -1]) asm.add('reflector', place(new THREE.BoxGeometry(0.012, 0.022, 0.13), faceX(0.6, 0.51, -1) - 0.006, 0.51, s * 0.6));

  // Boot lid shut lines: across the deck behind the rear glass, along its sides, and round the rear face.
  const seam = 'seam';
  asm.add(seam, deckPatch((u) => -1.672 + 0.004 * u, (_x, v) => 0.6 - 1.2 * v, { nu: 1, nv: 30, offset: 0.0015 }));
  for (const s of [1, -1]) {
    asm.add(seam, deckPatch((u) => -2.17 + (-1.672 + 2.17) * u, (_x, v) => s * 0.6 - 0.004 * v, { nu: 30, nv: 1, offset: 0.0015 }));
    asm.add(seam, facePatch(-1, (u) => s * 0.6 + 0.004 * u, (_u, v) => 0.72 + (1.04 - 0.72) * v, { nu: 1, nv: 16, offset: 0.0015 }));
  }
  asm.add(seam, facePatch(-1, (u) => 0.6 * (2 * u - 1), (_u, v) => 0.718 + 0.004 * v, { nu: 30, nv: 1, offset: 0.0015 }));
  // Bonnet shut line, just ahead of the windscreen, and down the front of each front wing.
  asm.add(seam, deckPatch((u) => 0.985 + 0.004 * u, (_x, v) => 0.64 - 1.28 * v, { nu: 1, nv: 30, offset: 0.0015 }));
  for (const s of [1, -1]) asm.add(seam, deckPatch((u) => 0.985 + (2.1 - 0.985) * u, (x, v) => s * (frame(x).zFlat - 0.02) - 0.004 * v, { nu: 30, nv: 1, offset: 0.0015 }));

  // Door shut lines, handles and the fuel flap.
  const doorSeam = (x, yFrom) =>
    sidePatch(
      (u) => x - 0.0025 + 0.005 * u,
      (xx, v) => yFrom(xx) + (topLine(xx) - 0.03 - yFrom(xx)) * v,
      { nu: 1, nv: 16, offset: 0.0015 }
    );
  for (const x of [0.88, -0.2, -0.97]) asm.addMirrored(seam, doorSeam(x, (xx) => Math.max(sill(xx), archTop(xx)) + 0.02));
  asm.addMirrored(seam, sidePatch((u) => -0.97 + (0.88 + 0.97) * u, (_x, v) => 0.34 + 0.004 * v, { nu: 40, nv: 1, offset: 0.0015 }));
  for (const x of [-0.08, -0.86]) {
    asm.addMirrored('chrome', box(0.14, 0.024, 0.02, x, 0.935, bodyZ(x, 0.935) + 0.007, 0.009, 2));
  }
  const flap = sidePatch((u) => -1.6 + 0.16 * u, (_x, v) => 0.84 + 0.13 * v, { nu: 6, nv: 6, offset: 0.0012 });
  const flapIn = sidePatch((u) => -1.596 + 0.152 * u, (_x, v) => 0.844 + 0.122 * v, { nu: 6, nv: 6, offset: 0.0018 });
  asm.add(seam, mirrorZ(flap));
  asm.add('paint', mirrorZ(flapIn));

  // Door mirrors with turn-signal repeaters, and wipers parked at the base of the windscreen.
  const mx = 0.7;
  const mz = glassZ(mx, 1.05) + 0.13;
  asm.addMirrored('paint', box(0.13, 0.11, 0.21, mx, 1.06, mz, 0.04, 4));
  asm.addMirrored('trim', box(0.11, 0.04, 0.12, mx + 0.03, 1.0, mz - 0.08, 0.012, 1));
  asm.addMirrored('glass', box(0.012, 0.085, 0.17, mx - 0.068, 1.06, mz, 0.004, 1));
  asm.addMirrored('indicator', box(0.03, 0.014, 0.09, mx + 0.05, 1.022, mz + 0.05, 0.005, 1));
  for (const z of [0.12, -0.42]) {
    const wiper = place(new THREE.BoxGeometry(0.014, 0.012, 0.56), 0.89, 0.99, z, 0, 0.1, 0.42);
    asm.add('trim', wiper);
  }

  // Wheels, outer face outward.
  for (const [name, x, side] of [['wheel_fl', xf, -1], ['wheel_fr', xf, 1], ['wheel_rl', xr, -1], ['wheel_rr', xr, 1]]) {
    const w = alloyWheel(rimR, tyreW * 0.92, { spokes: 5 });
    asm.wheel(name, { tyre: tyre(tyreR, tyreW, rimR + 0.005), rim: w.rim, rim_inner: w.rimInner, chrome: w.chrome, brake: w.brake }, x, tyreR, side * zw, side);
  }
}
