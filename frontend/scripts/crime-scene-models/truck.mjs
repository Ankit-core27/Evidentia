// An Indian rigid lorry in the style of the Tata LPT / Ashok Leyland 16-tonners: 8.5 x 2.5 x 3.4 m,
// wheelbase 4.8 m, 10.00-20 tyres, single at the front and twin at the rear. A flat-fronted
// forward-control cab (2.3 m wide) and a high-sided open wooden body whose headboard rises into the
// customary crown over the cab roof.
import * as THREE from 'three';
import { box as roundedBox, heavyWheel, indexed, mirrorZ, patch, place, rod, skin, smooth, tube } from './geometry.mjs';
import { inBand, moulding, planBody, roofInset } from './planbody.mjs';

const box = (...args) => indexed(roundedBox(...args));

const hx = 4.25;
const W = 1.25;
const xf = 3.3;
const xr = -1.5;
const tyreR = 0.52;
const tyreW = 0.275;
const rimR = 0.27;
const zwF = 0.98;
const zwR = 0.92;
const dual = 0.155;
const archY = tyreR;
const archRad = 0.63;

// Cab: from its rear wall to the front panel, sitting on the chassis.
const cabW = 1.15;
const cabX0 = 2.42;
const cabFront = 4.15;
const cabBot = 0.82;
const cabRoof = 2.95;
const rr = 0.12;
const nF = 14;
const nR = 8;
const SCREEN = [1.86, 2.68];
const WINDOW = [1.86, 2.62];
const REAR_WINDOW = [2.08, 2.5];
const winX0 = 2.66;
const winX1 = 3.86;

// The front leans back a little above the grille, so the windscreen is raked.
const tipF = (y) => cabFront - 0.08 * smooth((y - 1.78) / 0.95);
function plan(y) {
  const d = roofInset(y, cabRoof, rr);
  return { w: cabW - 0.03 * smooth((y - 1.8) / 1.05) - d, xF: tipF(y) - d, xR: cabX0 + d };
}
const { endPoint, endNormal, endS, endPatch, ring } = planBody({ plan, front: { D: 0.16, p: 2.6 }, rear: { D: 0.08, p: 2.6 } });

const SIDE_REGIONS = ['pillarA', 'window', 'arch', 'window', 'pillarB'];
function sidePoints(y) {
  const dy = y - archY;
  const dx = dy < 0 ? archRad : dy < archRad ? Math.sqrt(archRad * archRad - dy * dy) : 0;
  return [winX1, xf + dx, xf - dx, winX0];
}

function cabMaterial(y, d) {
  if (d.kind === 'side') {
    if (d.region === 'arch' && y < archY + archRad - 1e-6) return null;
    if (inBand(y, WINDOW) && d.region !== 'pillarA' && d.region !== 'pillarB') return 'glass';
    return 'paint';
  }
  if (d.kind === 'front') return inBand(y, SCREEN) && d.k < nF - 1 ? 'glass' : 'paint';
  return inBand(y, REAR_WINDOW) && d.k < 2 ? 'glass' : 'paint';
}

/** A patch on the cab's right side, x from x0 to x1 and y from y0 to y1. */
const cabSide = (x0, x1, y0, y1, opts) =>
  patch((u, v) => {
    const y = y0 + (y1 - y0) * v;
    return new THREE.Vector3(x0 + (x1 - x0) * u, y, plan(y).w);
  }, opts);

function buildCab(asm) {
  const ys = new Set([cabBot, ...SCREEN, ...WINDOW, ...REAR_WINDOW, 1.2, 1.5, 1.78, 2.2]);
  for (let k = 0; k <= 10; k += 1) {
    const y = archY + archRad * Math.sin((k / 10) * (Math.PI / 2));
    if (y > cabBot) ys.add(+y.toFixed(5));
  }
  for (let k = 0; k <= 6; k += 1) ys.add(+(cabRoof - rr + rr * Math.sin((k / 6) * (Math.PI / 2))).toFixed(5));
  const yList = [...ys].sort((a, b) => a - b);
  const rings = yList.map((y) => ring(y, nF, nR, sidePoints(y), SIDE_REGIONS));
  const parts = skin(rings.map((r) => r.pts), (s, i) => cabMaterial(yList[s], rings[s].desc[i]), { capStart: 'under', capEnd: 'paint' });
  for (const [m, g] of Object.entries(parts)) asm.add(m, g);

  // Front wheel house: liner, inner wall and a rubber flare round the arch.
  const arcFrom = Math.asin(Math.max(-1, Math.min(1, (cabBot - archY) / archRad)));
  const arch = (u) => {
    const a = arcFrom + (Math.PI - 2 * arcFrom) * u;
    return [xf + archRad * Math.cos(a), archY + archRad * Math.sin(a)];
  };
  asm.addMirrored('under', patch((u, v) => {
    const [x, y] = arch(u);
    return new THREE.Vector3(x, y, cabW - (cabW - 0.8) * v);
  }, { nu: 30, nv: 1, offset: 0 }));
  const wall = new THREE.Shape();
  const [ax0, ay0] = arch(0);
  wall.moveTo(xf - (ax0 - xf), ay0);
  wall.lineTo(ax0, ay0);
  wall.absarc(xf, archY, archRad, arcFrom, Math.PI - arcFrom, false);
  asm.addMirrored('under', new THREE.ShapeGeometry(wall, 20).translate(0, 0, 0.8));
  asm.addMirrored('rubber', patch((u, v) => {
    const a = arcFrom + (Math.PI - 2 * arcFrom) * u;
    const r = archRad + 0.06 * v;
    return new THREE.Vector3(xf + r * Math.cos(a), archY + r * Math.sin(a), cabW + 0.006 + 0.012 * Math.sin(Math.PI * v));
  }, { nu: 30, nv: 3, offset: 0, flip: true }));
  asm.addMirrored('rubber', box(0.014, 0.42, 0.3, xf - archRad - 0.06, 0.42, zwF, 0.004, 1));

  // Windscreen: rubber surround and the centre bar of the split screen, wipers and a sun visor.
  const [sy0, sy1] = SCREEN;
  const sEdge = (nF - 1) / nF;
  for (const [y0, y1] of [[sy0 - 0.014, sy0 + 0.014], [sy1 - 0.014, sy1 + 0.014]]) {
    asm.add('rubber', endPatch(1, sEdge, -sEdge, y0, y1, { offset: 0.004, nu: 40, nv: 1 }));
  }
  for (const s of [sEdge, 0.02, -sEdge]) {
    const w = s === 0.02 ? 0.04 : 0.012 * Math.sign(s);
    asm.add('rubber', endPatch(1, s, s - w, sy0, sy1, { offset: 0.005, nu: 1, nv: 10 }));
  }
  for (const z of [0.62, -0.1]) {
    const p0 = endPoint(1.9, endS(1.9, z, 1), 1).add(new THREE.Vector3(0.03, 0, 0));
    const p1 = endPoint(2.45, endS(2.45, z - 0.22, 1), 1).add(new THREE.Vector3(0.03, 0, 0));
    asm.add('trim', rod(p0, p1, 0.008, { radial: 6 }));
    asm.add('trim', box(0.03, 0.04, 0.04, p0.x - 0.005, p0.y - 0.02, p0.z, 0.008, 1));
  }
  asm.add('trim', endPatch(1, 0.98, -0.98, 2.7, 2.8, { bulge: moulding(0.09, 0.3, 0.04), nu: 40, nv: 4 }));

  // Front panel: grille with chrome bars, badge, headlamps, indicators and the marker lamps on the roof.
  asm.add('trim_gloss', endPatch(1, 0.6, -0.6, 1.16, 1.7, { offset: 0.004, nu: 24, nv: 3 }));
  for (let k = 0; k < 6; k += 1) {
    const y = 1.2 + k * 0.085;
    asm.add('chrome', endPatch(1, 0.58, -0.58, y, y + 0.03, { bulge: () => 0.014, nu: 20, nv: 1 }));
  }
  const badge = place(new THREE.TorusGeometry(0.07, 0.013, 8, 28), endPoint(1.77, 0, 1).x + 0.014, 1.77, 0, 0, Math.PI / 2, 0);
  badge.scale(1, 0.6, 1);
  asm.add('chrome', badge);
  for (const s of [1, -1]) {
    const lamp = (s0, s1, y0, y1, m, off) => {
      const g = endPatch(1, s0, s1, y0, y1, { offset: off, nu: 8, nv: 3 });
      asm.add(m, s > 0 ? g : mirrorZ(g));
    };
    lamp(0.64, 0.95, 1.12, 1.5, 'trim_gloss', 0.004);
    lamp(0.67, 0.92, 1.25, 1.46, 'headlight', 0.008);
    lamp(0.67, 0.92, 1.15, 1.22, 'indicator', 0.008);
    const marker = box(0.05, 0.05, 0.1, endPoint(2.9, 0.75, 1).x - 0.03, cabRoof + 0.02, 0.75 * s, 0.012, 1);
    asm.add('indicator', marker);
  }
  for (const sc of [0.74, 0.86]) {
    const p = endPoint(1.355, sc, 1);
    const n = endNormal(1.355, sc, 1);
    const bowl = new THREE.SphereGeometry(0.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(-Math.PI / 2);
    bowl.scale(0.3, 1, 1);
    bowl.rotateY(Math.atan2(-n.z, n.x));
    asm.addMirrored('chrome', place(bowl, p.x + n.x * 0.005, p.y, p.z + n.z * 0.005));
  }

  // Steel bumper with the plate, fog lamps and tow hooks.
  const bx = cabFront + 0.03;
  asm.add('steel', box(0.14, 0.28, 2.32, bx, 0.74, 0, 0.03, 2));
  asm.add('trim', box(0.02, 0.06, 2.2, bx + 0.07, 0.8, 0, 0.01, 1));
  asm.plate('plate_front', bx + 0.075, 0.68, 1);
  for (const s of [1, -1]) {
    asm.add('headlight', place(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 20), bx + 0.07, 0.68, s * 0.8, 0, 0, Math.PI / 2));
    asm.add('trim', box(0.06, 0.06, 0.06, bx + 0.08, 0.62, s * 0.42, 0.01, 1));
  }

  // Door shut lines, handles, grab rails and steps.
  const seam = (x0, x1, y0, y1) => asm.addMirrored('seam', cabSide(x0, x1, y0, y1, { nu: Math.max(1, Math.round((x1 - x0) * 10)), nv: Math.max(1, Math.round((y1 - y0) * 10)), offset: 0.0015 }));
  seam(2.56, 2.565, 1.2, 2.74);
  seam(3.9, 3.905, 1.2, 2.74);
  seam(2.56, 3.905, 1.2, 1.205);
  seam(2.56, 3.905, 2.735, 2.74);
  asm.addMirrored('chrome', box(0.16, 0.03, 0.03, 2.72, 1.88, cabW + 0.01, 0.01, 1));
  asm.addMirrored('chrome', rod([2.48, 1.3, cabW + 0.05], [2.48, 2.3, cabW + 0.05], 0.014, { radial: 8 }));
  for (const y of [1.3, 2.3]) asm.addMirrored('chrome', rod([2.48, y, cabW + 0.05], [2.48, y, cabW - 0.01], 0.012, { radial: 6 }));
  for (const [y, z] of [[0.52, 1.02], [0.86, 1.04]]) asm.addMirrored('alu', box(0.3, 0.03, 0.22, 2.6, y, z, 0.006, 1));
  asm.addMirrored('steel', box(0.03, 0.4, 0.22, 2.46, 0.68, 1.03, 0.006, 1));

  // Mirrors on tubular arms from the A-pillars.
  for (const s of [1, -1]) {
    const arm = tube([[3.98, 1.95, s * 1.1], [4.04, 2.0, s * 1.2], [4.06, 2.1, s * 1.22], [4.06, 2.2, s * 1.21]], 0.014, { segments: 16, radial: 8 });
    asm.add('trim', arm);
    asm.add('trim', rod([3.98, 2.62, s * 1.08], [4.06, 2.5, s * 1.21], 0.012, { radial: 8 }));
    asm.add('trim', box(0.06, 0.36, 0.13, 4.06, 2.3, s * 1.205, 0.02, 2));
    asm.add('glass', box(0.01, 0.31, 0.1, 4.026, 2.3, s * 1.205, 0.004, 1));
  }
}

/** n wooden planks stacked from y0 to y1; place3(height, y, dz) makes each one, dz staggering their faces. */
function planks(asm, n, y0, y1, place3) {
  const h = (y1 - y0) / n;
  for (let k = 0; k < n; k += 1) {
    const y = y0 + h * (k + 0.5);
    asm.add('wood', place3(h - 0.009, y, (k % 3) * 0.002));
  }
}

function buildBody(asm) {
  const bx0 = -hx + 0.03;
  const bx1 = 2.3;
  const len = bx1 - bx0;
  const bc = (bx0 + bx1) / 2;
  const floorY = 1.25;
  const sideTop = 2.86;

  // Platform: plank floor on steel cross-bearers and long sills.
  asm.add('wood', box(len, 0.07, 2 * W - 0.02, bc, floorY - 0.035, 0, 0.006, 1));
  for (let x = bx0 + 0.15; x < bx1; x += 0.52) asm.add('steel', box(0.08, 0.1, 2 * W - 0.04, x, floorY - 0.12, 0, 0.006, 1));
  asm.addMirrored('steel', box(len, 0.1, 0.1, bc, 1.08, 0.45, 0.006, 1));
  asm.addMirrored('steel', box(len, 0.08, 0.04, bc, floorY - 0.1, W - 0.02, 0.006, 1));

  // Sides: planks behind steel posts, a capping rail and a middle rail, rope hooks under the floor.
  const posts = [bx1 - 0.04, 0.72, -0.86, -2.44, bx0 + 0.04];
  planks(asm, 9, floorY, sideTop, (h, y, dz) => box(len - 0.06, h, 0.035, bc, y, W - 0.035 - dz, 0.006, 1));
  planks(asm, 9, floorY, sideTop, (h, y, dz) => box(len - 0.06, h, 0.035, bc, y, -(W - 0.035 - dz), 0.006, 1));
  for (const x of posts) asm.addMirrored('steel', box(0.09, sideTop - floorY + 0.06, 0.05, x, (sideTop + floorY) / 2, W - 0.025, 0.008, 1));
  for (const y of [sideTop + 0.03, (sideTop + floorY) / 2 + 0.1]) {
    asm.addMirrored('steel', box(len, y > sideTop ? 0.07 : 0.05, 0.05, bc, y, W - 0.025, 0.008, 1));
  }
  for (let x = bx0 + 0.4; x < bx1 - 0.2; x += 0.8) asm.addMirrored('alu', box(0.06, 0.05, 0.03, x, floorY - 0.14, W - 0.005, 0.008, 1));

  // Headboard, rising into the crown that overhangs the cab roof.
  planks(asm, 9, floorY, sideTop, (h, y, dz) => box(0.035, h, 2 * W - 0.1, bx1 - 0.035 - dz, y, 0, 0.006, 1));
  const crownX1 = 3.62;
  const crownY0 = 2.99;
  const crownY1 = 3.4;
  asm.add('steel', box(0.08, crownY1 - floorY, 0.08, bx1 - 0.04, (crownY1 + floorY) / 2, W - 0.04, 0.01, 1));
  asm.add('steel', box(0.08, crownY1 - floorY, 0.08, bx1 - 0.04, (crownY1 + floorY) / 2, -(W - 0.04), 0.01, 1));
  planks(asm, 2, sideTop + 0.06, crownY1, (h, y, dz) => box(0.035, h, 2 * W - 0.1, bx1 - 0.035 - dz, y, 0, 0.006, 1));
  asm.add('wood', box(crownX1 - bx1, 0.05, 2 * cabW, (crownX1 + bx1) / 2, crownY0 + 0.025, 0, 0.008, 1));
  planks(asm, 2, crownY0 + 0.05, crownY1 - 0.05, (h, y, dz) => box(crownX1 - bx1, h, 0.035, (crownX1 + bx1) / 2, y, cabW - 0.02 - dz, 0.006, 1));
  planks(asm, 2, crownY0 + 0.05, crownY1 - 0.05, (h, y, dz) => box(crownX1 - bx1, h, 0.035, (crownX1 + bx1) / 2, y, -(cabW - 0.02 - dz), 0.006, 1));
  // The crown's painted front board, with chrome edging and marker lamps.
  const front = box(0.04, crownY1 - crownY0, 2 * cabW + 0.06, crownX1, (crownY0 + crownY1) / 2, 0, 0.012, 2);
  asm.add('paint', front);
  asm.add('paint_stripe', box(0.01, 0.12, 2 * cabW - 0.2, crownX1 + 0.022, (crownY0 + crownY1) / 2, 0, 0.004, 1));
  for (const y of [crownY0 + 0.02, crownY1 - 0.02]) asm.add('chrome', box(0.05, 0.025, 2 * cabW + 0.08, crownX1 + 0.005, y, 0, 0.008, 1));
  for (const z of [-0.85, -0.3, 0.3, 0.85]) asm.add('indicator', box(0.03, 0.05, 0.08, crownX1 + 0.03, crownY1 - 0.08, z, 0.01, 1));
  asm.add('wood', box(0.04, 0.06, 2 * cabW, crownX1 - 0.02, crownY1 - 0.03, 0, 0.008, 1));

  // Tailgate: planks in a steel frame, hinged at the floor, with chains and latches.
  const tx = bx0 - 0.02;
  planks(asm, 9, floorY, sideTop, (h, y, dz) => box(0.035, h, 2 * W - 0.1, tx + dz, y, 0, 0.006, 1));
  for (const y of [floorY + 0.02, sideTop + 0.02, (floorY + sideTop) / 2]) asm.add('steel', box(0.05, 0.06, 2 * W - 0.06, tx - 0.02, y, 0, 0.008, 1));
  for (const z of [-0.55, 0.55]) asm.add('steel', box(0.05, sideTop - floorY, 0.07, tx - 0.02, (sideTop + floorY) / 2, z, 0.008, 1));
  for (const s of [1, -1]) {
    asm.add('alu', box(0.06, 0.12, 0.05, tx - 0.04, sideTop - 0.1, s * (W - 0.08), 0.01, 1));
    asm.add('chain', tube([[tx - 0.03, sideTop - 0.12, s * (W - 0.05)], [tx - 0.06, sideTop - 0.5, s * (W - 0.03)], [bx0 + 0.05, sideTop - 0.75, s * (W - 0.01)]], 0.008, { segments: 12, radial: 5 }));
    for (const x of [-hx + 0.12]) asm.add('steel', box(0.08, 0.08, 0.12, x, floorY + 0.02, s * (W - 0.3), 0.01, 1));
  }
}

function buildChassis(asm) {
  // Frame rails and cross members.
  asm.addMirrored('under', box(8.1, 0.24, 0.08, -0.12, 0.93, 0.43, 0.01, 1));
  for (const x of [3.9, 2.0, 0.2, -1.5, -3.0, -4.05]) asm.add('under', box(0.08, 0.16, 0.86, x, 0.93, 0, 0.01, 1));
  // Leaf springs, axles and the differential.
  for (const x of [xf, xr]) {
    for (let k = 0; k < 4; k += 1) {
      const l = 1.4 - k * 0.25;
      asm.addMirrored('under', box(l, 0.025, 0.08, x, 0.78 - k * 0.028, 0.6, 0.006, 1));
    }
  }
  asm.add('under', box(0.12, 0.12, 1.75, xf, archY - 0.04, 0, 0.01, 1));
  asm.add('under', place(new THREE.CylinderGeometry(0.09, 0.09, 1.6, 12), xr, archY, 0, Math.PI / 2, 0, 0));
  asm.add('under', place(new THREE.SphereGeometry(0.22, 16, 10), xr, archY - 0.04, 0));
  asm.add('under', rod([2.3, 0.78, 0], [xr + 0.2, archY + 0.02, 0], 0.045, { radial: 10 }));
  // Engine sump and gearbox under the cab.
  asm.add('under', box(1.1, 0.35, 0.6, 3.25, 0.82, 0, 0.04, 2));
  asm.add('under', box(0.7, 0.3, 0.4, 2.3, 0.8, 0, 0.04, 2));

  // Fuel tank on the left, battery box on the right, air tanks between the rails.
  asm.add('alu', box(0.9, 0.5, 0.5, 1.65, 0.86, -0.82, 0.08, 3));
  asm.add('chrome', place(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16), 1.95, 1.125, -0.82));
  for (const s of [-1, 1]) asm.add('steel', box(0.04, 0.06, 0.55, 1.65 + s * 0.3, 0.86, -0.82, 0.01, 1));
  asm.add('steel', box(0.6, 0.42, 0.42, 1.75, 0.84, 0.85, 0.02, 2));
  asm.add('steel', place(new THREE.CylinderGeometry(0.13, 0.13, 1.1, 14), 0.4, 0.8, 0, 0, 0, Math.PI / 2));
  // Exhaust from under the cab to a tail pipe ahead of the rear wheels, on the right.
  asm.add('chrome', tube([[2.9, 0.7, 0.3], [2.4, 0.66, 0.62], [1.0, 0.64, 0.72], [-0.6, 0.62, 0.75], [-0.75, 0.55, 0.95]], 0.05, { segments: 30, radial: 10 }));
  asm.add('steel', place(new THREE.CylinderGeometry(0.13, 0.13, 0.7, 16), 0.2, 0.64, 0.72, 0, 0, Math.PI / 2));

  // Side guards between the axles and the rear under-run bar.
  const g0 = xr + 0.72;
  const g1 = cabX0 - 0.05;
  for (const y of [0.58, 0.86]) asm.addMirrored('alu', box(g1 - g0, 0.08, 0.04, (g0 + g1) / 2, y, W - 0.06, 0.01, 1));
  for (const x of [g0 + 0.1, (g0 + g1) / 2, g1 - 0.1]) asm.addMirrored('steel', box(0.05, 0.42, 0.05, x, 0.84, W - 0.12, 0.008, 1));
  const rx = -hx + 0.1;
  asm.add('steel', box(0.12, 0.12, 2.3, rx, 0.56, 0, 0.012, 2));
  for (let k = 0; k < 8; k += 1) {
    const z = -1.0 + k * 0.286;
    asm.add(k % 2 ? 'reflector' : 'paint_stripe', box(0.01, 0.07, 0.24, rx - 0.062, 0.56, z, 0.004, 1));
  }
  for (const s of [1, -1]) asm.add('steel', box(0.08, 0.5, 0.08, rx + 0.05, 0.8, s * 0.43, 0.01, 1));

  // Rear lamps and plate on a cross bar under the tailgate, mud flaps behind the twin wheels.
  const lx = -hx + 0.08;
  asm.add('steel', box(0.08, 0.16, 2.3, lx + 0.04, 1.0, 0, 0.01, 1));
  for (const s of [1, -1]) {
    asm.add('taillight', box(0.04, 0.1, 0.18, lx - 0.005, 1.0, s * 0.95, 0.012, 2));
    asm.add('indicator', box(0.04, 0.1, 0.1, lx - 0.005, 1.0, s * 0.76, 0.012, 2));
    asm.add('headlight', box(0.04, 0.06, 0.08, lx - 0.005, 1.0, s * 0.62, 0.01, 1));
  }
  asm.plate('plate_rear', lx - 0.01, 0.99, -1);
  asm.addMirrored('rubber', box(0.014, 0.55, 0.62, xr - archRad - 0.12, 0.62, zwR, 0.004, 1));
  asm.addMirrored('steel', box(0.9, 0.025, 0.66, xr, 1.06, zwR, 0.006, 1));
}

export function buildTruck(asm) {
  buildCab(asm);
  buildBody(asm);
  buildChassis(asm);
  for (const [name, x, z, side, twin] of [
    ['wheel_fl', xf, zwF, -1, 0],
    ['wheel_fr', xf, zwF, 1, 0],
    ['wheel_rl', xr, zwR, -1, dual],
    ['wheel_rr', xr, zwR, 1, dual]
  ]) {
    asm.wheel(name, heavyWheel(tyreR, tyreW, rimR, { twin }), x, tyreR, side * z, side);
  }
}
