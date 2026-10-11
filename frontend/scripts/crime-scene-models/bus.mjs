// An Indian city bus in the style of the Tata Starbus / Ashok Leyland city buses: 11.5 x 2.5 x 3.2 m
// (3.0 m to the roof plus a 0.2 m roof AC unit), wheelbase 6.0 m, 10.00 R20 tyres, single at the front
// and dual at the rear. Red with a white waist stripe and roof. Traffic keeps left, so both passenger
// doors are on the left (-z): one ahead of the front axle and one between the axles.
//
// The body is a stack of horizontal plan sections from the skirt to the roof (skin), so the bands of
// the livery, the glazing and the wheel-arch and door openings are cut straight into the surface.
import * as THREE from 'three';
import { box as roundedBox, heavyWheel, indexed, mirrorZ, patch, place, rod, skin, smooth, tube } from './geometry.mjs';
import { inBand, moulding, planBody, roofInset } from './planbody.mjs';

const box = (...args) => indexed(roundedBox(...args));

const hx = 5.75;
const W = 1.25;
const xf = 3.3;
const xr = -2.7;
const tyreR = 0.52;
const tyreW = 0.275;
const rimR = 0.27;
const zwF = 1.03;
const zwR = 0.92;
const dual = 0.155;
const archY = tyreR;
const archRad = 0.63;

const yBot = 0.4;
const yRoof = 3.0;
const rr = 0.16;
const DF = 0.32;
const pF = 2.4;
const DR = 0.26;
const pR = 2.8;
const nF = 16;
const nR = 12;

// Heights of the bands on the body.
const SKIRT = [0.4, 0.47];
const STRIPE = [1.3, 1.42];
const WINDOW = [1.6, 2.56];
const SCREEN = [1.22, 2.52];
const DEST = [2.58, 2.82];
const REAR_WINDOW = [1.92, 2.56];
const REAR_DEST = [2.62, 2.8];
const ROOF_WHITE = 2.84;

const doors = [
  { x0: 4.15, x1: 5.13 },
  { x0: -1.3, x1: -0.3 }
];
const doorTop = 2.56;

// The front leans back a little above the headlamps, so the windscreen is raked.
const tipF = (y) => hx - 0.07 - 0.08 * smooth((y - 1.15) / 1.4);
const tipR = () => -hx + 0.07;
function plan(y) {
  const d = roofInset(y, yRoof, rr);
  return { w: W - d, xF: tipF(y) - d, xR: tipR(y) + d };
}
const { endPoint, endNormal, endS, endPatch, ring } = planBody({ plan, front: { D: DF, p: pF }, rear: { D: DR, p: pR } });

// Points along the right side, front to rear, between the two ends. The left side mirrors them, so
// each opening is cut on one side only by the material function.
const SIDE_REGIONS = ['pillarA', 'door0', null, 'arch', null, 'door1', null, 'arch', null];
function sidePoints(y) {
  const dy = y - archY;
  const dx = dy < 0 ? archRad : dy < archRad ? Math.sqrt(archRad * archRad - dy * dy) : 0;
  return [doors[0].x1, doors[0].x0, xf + dx, xf - dx, doors[1].x1, doors[1].x0, xr + dx, xr - dx];
}

function bodyMaterial(y, d) {
  if (d.kind === 'side') {
    if (d.region === 'arch' && y < archY + archRad - 1e-6) return null;
    if (d.side < 0 && (d.region === 'door0' || d.region === 'door1') && y < doorTop - 1e-6) return null;
  }
  if (y >= ROOF_WHITE - 1e-6) return 'paint_stripe';
  if (inBand(y, SKIRT)) return 'trim';
  if (inBand(y, STRIPE)) return 'paint_stripe';
  if (d.kind === 'front') {
    if (inBand(y, SCREEN) && d.k < nF - 1) return 'glass';
    if (inBand(y, DEST) && d.k < nF - 4) return 'dest_board';
    return 'paint';
  }
  if (d.kind === 'rear') {
    if (inBand(y, REAR_WINDOW) && d.k < nR - 3) return 'glass';
    if (inBand(y, REAR_DEST) && d.k < nR - 6) return 'dest_board';
    return 'paint';
  }
  if (inBand(y, WINDOW) && d.region !== 'pillarA') return 'glass';
  return 'paint';
}

export function buildBus(asm) {
  // Stations up the body: every band edge, the arches traced round, the roof edge rounded over.
  const ys = new Set([yBot, ...SKIRT, ...STRIPE, ...WINDOW, ...SCREEN, ...DEST, ...REAR_WINDOW, ...REAR_DEST, ROOF_WHITE, doorTop, 1.9, 2.2]);
  for (let k = 0; k <= 14; k += 1) ys.add(+(archY + archRad * Math.sin((k / 14) * (Math.PI / 2))).toFixed(5));
  for (let k = 0; k <= 8; k += 1) ys.add(+(yRoof - rr + rr * Math.sin((k / 8) * (Math.PI / 2))).toFixed(5));
  const yList = [...ys].sort((a, b) => a - b);
  const rings = yList.map((y) => ring(y, nF, nR, sidePoints(y), SIDE_REGIONS));
  const parts = skin(
    rings.map((r) => r.pts),
    (s, i) => bodyMaterial(yList[s], rings[s].desc[i]),
    { capStart: 'under', capEnd: 'paint_stripe' }
  );
  for (const [m, g] of Object.entries(parts)) asm.add(m, g);

  // Wheel houses: a liner round each arch and an inner wall.
  for (const [xc, zIn] of [[xf, 0.84], [xr, 0.58]]) {
    const path = (u) => {
      // Up the front edge, over the top, down the rear edge.
      const L1 = archY - yBot;
      const L2 = (Math.PI * archRad) / 1;
      const total = 2 * L1 + L2;
      const d = u * total;
      if (d < L1) return [xc + archRad, yBot + d];
      if (d < L1 + L2) {
        const a = ((d - L1) / L2) * Math.PI;
        return [xc + archRad * Math.cos(a), archY + archRad * Math.sin(a)];
      }
      return [xc - archRad, archY - (d - L1 - L2)];
    };
    const liner = patch((u, v) => {
      const [x, y] = path(u);
      return new THREE.Vector3(x, y, W - (W - zIn) * v);
    }, { nu: 40, nv: 1, offset: 0 });
    asm.addMirrored('under', liner);
    const shape = new THREE.Shape();
    shape.moveTo(xc - archRad, yBot);
    shape.lineTo(xc + archRad, yBot);
    shape.lineTo(xc + archRad, archY);
    shape.absarc(xc, archY, archRad, 0, Math.PI, false);
    shape.lineTo(xc - archRad, yBot);
    const wall = new THREE.ShapeGeometry(shape, 24);
    wall.translate(0, 0, zIn);
    asm.addMirrored('under', wall);
    // Mud flaps behind each wheel.
    const zt = xc === xf ? zwF : zwR;
    asm.addMirrored('rubber', box(0.014, 0.4, xc === xf ? 0.34 : 0.62, xc - archRad - 0.04, 0.32, zt, 0.004, 1));
  }

  // Window pillars and the aluminium rails above and below the glass. On the left the doors break them.
  const pillars = [5.18, 4.1, 3.02, 1.94, 0.86, -0.25, -1.35, -2.42, -3.48, -4.54];
  const [wy0, wy1] = WINDOW;
  for (const x of pillars) {
    const g = box(0.1, wy1 - wy0, 0.03, x, (wy0 + wy1) / 2, W, 0.008, 1);
    asm.add('paint', g);
    asm.add('paint', mirrorZ(g));
  }
  const xEnd = plan(wy0).xR + DR;
  const xStart = plan(wy1).xF - DF;
  const rails = (side) => {
    const spans = side > 0 ? [[xEnd, xStart]] : [[xEnd, doors[1].x0], [doors[1].x1, doors[0].x0], [doors[0].x1, xStart]];
    for (const [a, b] of spans) {
      for (const y of [wy0, wy1]) asm.add('alu', box(b - a, 0.035, 0.03, (a + b) / 2, y, side * W, 0.008, 1));
    }
  };
  rails(1);
  rails(-1);

  // Doors on the left: rubber-edged jambs round each opening and two glazed leaves set back inside.
  for (const d of doors) {
    const cx = (d.x0 + d.x1) / 2;
    const zj = -(W - 0.03);
    for (const x of [d.x0, d.x1]) asm.add('trim', box(0.06, doorTop - yBot, 0.1, x, (doorTop + yBot) / 2, zj, 0.01, 1));
    asm.add('trim', box(d.x1 - d.x0 + 0.06, 0.06, 0.1, cx, doorTop, zj, 0.01, 1));
    asm.add('trim', box(d.x1 - d.x0, 0.06, 0.12, cx, yBot + 0.02, -(W - 0.06), 0.01, 1));
    const leaf = (d.x1 - d.x0) / 2;
    for (const k of [0, 1]) {
      const lx = d.x0 + leaf * (k + 0.5);
      const zl = -(W - 0.05);
      asm.add('trim_gloss', box(leaf - 0.01, doorTop - yBot - 0.06, 0.035, lx, (doorTop + yBot) / 2, zl, 0.01, 1));
      asm.add('glass', box(leaf - 0.1, doorTop - 1.05, 0.02, lx, (doorTop - 0.05 + 1.0) / 2, zl - 0.012, 0.006, 1));
      asm.add('paint', box(leaf - 0.1, 0.45, 0.02, lx, 0.72, zl - 0.012, 0.006, 1));
      asm.add('alu', box(0.025, 0.5, 0.02, lx + (k ? -1 : 1) * (leaf / 2 - 0.09), 1.5, zl - 0.03, 0.006, 1));
    }
    asm.add('rubber', box(0.03, doorTop - yBot - 0.06, 0.05, cx, (doorTop + yBot) / 2, -(W - 0.05), 0.01, 1));
  }

  // Route boards: front and rear above the glass, and one in the window behind the front door.
  const leds = (end, y0, y1, s0, s1, groups) => {
    const span = s1 - s0;
    const total = groups.reduce((a, g) => a + g, 0) + groups.length - 1;
    let k = 0;
    for (const g of groups) {
      for (let c = 0; c < g; c += 1) {
        const a = s0 + (span * (k + 0.12)) / total;
        const b = s0 + (span * (k + 0.88)) / total;
        asm.add('dest_led', endPatch(end, a, b, y0, y1, { nu: 2, nv: 1, offset: 0.004 }));
        k += 1;
      }
      k += 1;
    }
  };
  leds(1, 2.63, 2.77, 0.5, -0.5, [3, 6, 4]);
  leds(-1, 2.65, 2.77, -0.32, 0.32, [3]);
  const side0 = doors[0].x0 - 0.08;
  asm.add('dest_board', box(0.9, 0.24, 0.02, side0 - 0.47, 2.33, -(W + 0.012), 0.005, 1));
  for (let c = 0; c < 6; c += 1) asm.add('dest_led', box(0.1, 0.12, 0.01, side0 - 0.12 - c * 0.13, 2.33, -(W + 0.024), 0.002, 1));

  // Front: bumper, plate, headlamp clusters, indicators, fog lamps and the grille.
  asm.add('trim', endPatch(1, 1.25, -1.25, 0.42, 0.74, { bulge: moulding(0.07), nu: 70, nv: 8 }));
  asm.plate('plate_front', endPoint(0.58, 0, 1).x + 0.075, 0.58, 1);
  for (const s of [1, -1]) {
    const lamp = (s0, s1, y0, y1, m, off, nu = 10) => {
      const g = endPatch(1, s0, s1, y0, y1, { offset: off, nu, nv: 3 });
      asm.add(m, s > 0 ? g : mirrorZ(g));
    };
    lamp(0.5, 0.97, 0.84, 1.08, 'trim_gloss', 0.004, 20);
    lamp(0.54, 0.66, 0.87, 1.05, 'headlight', 0.009);
    lamp(0.68, 0.8, 0.87, 1.05, 'headlight', 0.009);
    lamp(0.83, 0.95, 0.87, 1.05, 'indicator', 0.009);
  }
  // Reflector bowls behind the headlamp lenses and a fog lamp in the bumper, built on the right and mirrored.
  const facing = (g, y, s, out) => {
    const p = endPoint(y, s, 1);
    const n = endNormal(y, s, 1);
    g.rotateY(Math.atan2(-n.z, n.x));
    return place(g, p.x + n.x * out, y, p.z + n.z * out);
  };
  for (const sc of [0.6, 0.74]) {
    const bowl = new THREE.SphereGeometry(0.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    bowl.rotateZ(-Math.PI / 2);
    bowl.scale(0.3, 1, 1);
    asm.addMirrored('chrome', facing(bowl, 0.96, sc, 0.004));
  }
  asm.addMirrored('headlight', facing(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20).rotateZ(Math.PI / 2), 0.58, 0.68, 0.078));
  asm.add('trim_gloss', endPatch(1, 0.46, -0.46, 0.8, 1.12, { offset: 0.004, nu: 24, nv: 3 }));
  for (let k = 0; k < 5; k += 1) {
    const y = 0.83 + k * 0.06;
    asm.add('alu', endPatch(1, 0.44, -0.44, y, y + 0.022, { bulge: () => 0.012, nu: 20, nv: 1 }));
  }
  const badge = new THREE.TorusGeometry(0.06, 0.012, 8, 28).scale(1, 0.6, 1);
  asm.add('chrome', place(badge, endPoint(1.17, 0, 1).x + 0.012, 1.17, 0, 0, Math.PI / 2, 0));
  // A rubber seal round the windscreen.
  const [sy0, sy1] = SCREEN;
  const sEdge = (nF - 1) / nF;
  asm.add('rubber', endPatch(1, sEdge, -sEdge, sy0 - 0.012, sy0 + 0.012, { offset: 0.004, nu: 40, nv: 1 }));
  asm.add('rubber', endPatch(1, sEdge, -sEdge, sy1 - 0.012, sy1 + 0.012, { offset: 0.004, nu: 40, nv: 1 }));
  for (const s of [sEdge, -sEdge]) {
    asm.add('rubber', endPatch(1, s + 0.01 * Math.sign(s), s - 0.01 * Math.sign(s), sy0, sy1, { offset: 0.004, nu: 1, nv: 12 }));
  }

  // Wipers parked upright on the windscreen.
  for (const z of [0.55, -0.2]) {
    const s = endS(1.3, z, 1);
    const p0 = endPoint(1.3, s, 1).add(new THREE.Vector3(0.025, 0, 0));
    const p1 = endPoint(2.15, endS(2.15, z - 0.18, 1), 1).add(new THREE.Vector3(0.025, 0, 0));
    asm.add('trim', rod(p0, p1, 0.009, { radial: 6 }));
    asm.add('trim', box(0.03, 0.04, 0.05, p0.x, p0.y - 0.02, p0.z, 0.008, 1));
  }

  // Mirrors on arms reaching forward from the front roof corners.
  for (const s of [1, -1]) {
    const arm = tube([[5.38, 2.86, s * 1.12], [5.6, 2.8, s * 1.22], [5.72, 2.62, s * 1.24], [5.72, 2.45, s * 1.2]], 0.018, { segments: 20, radial: 8 });
    asm.add('trim', arm);
    asm.add('trim', box(0.07, 0.42, 0.22, 5.72, 2.22, s * 1.17, 0.025, 2));
    asm.add('glass', box(0.012, 0.37, 0.18, 5.683, 2.22, s * 1.17, 0.004, 1));
  }

  // Rear: bumper, lamp clusters, plate, reflectors and the exhaust.
  asm.add('trim', endPatch(-1, -1.2, 1.2, 0.42, 0.72, { bulge: moulding(0.07), nu: 70, nv: 8 }));
  for (const s of [1, -1]) {
    const lamp = (y0, y1, m, off) => {
      const g = endPatch(-1, 0.62, 0.95, y0, y1, { offset: off, nu: 10, nv: 3 });
      asm.add(m, s > 0 ? g : mirrorZ(g));
    };
    lamp(0.8, 1.52, 'trim_gloss', 0.004);
    lamp(1.24, 1.49, 'taillight', 0.008);
    lamp(1.04, 1.21, 'indicator', 0.008);
    lamp(0.84, 1.0, 'headlight', 0.008);
    const refl = endPatch(-1, 0.68, 0.86, 0.53, 0.61, { bulge: () => 0.074, nu: 4, nv: 1 });
    asm.add('reflector', s > 0 ? refl : mirrorZ(refl));
  }
  asm.plate('plate_rear', endPoint(0.88, 0, -1).x - 0.008, 0.88, -1);
  // Louvred engine-bay grille between the lamp clusters.
  asm.add('trim_gloss', endPatch(-1, -0.5, 0.5, 1.02, 1.24, { offset: 0.004, nu: 20, nv: 2 }));
  for (let k = 0; k < 4; k += 1) {
    const y = 1.04 + k * 0.05;
    asm.add('paint', endPatch(-1, -0.48, 0.48, y, y + 0.03, { bulge: (_u, v) => 0.006 + 0.012 * v, nu: 16, nv: 1 }));
  }
  asm.add('chrome', box(0.02, 0.05, 0.45, endPoint(1.62, 0, -1).x - 0.01, 1.62, 0, 0.008, 1));
  asm.add('trim', rod([-4.9, 0.34, 0.75], [-5.55, 0.3, 0.75], 0.05, { radial: 12 }));
  asm.add('trim', rod([-5.55, 0.3, 0.75], [-5.62, 0.24, 0.75], 0.05, { radial: 12 }));

  // Side marker lamps and luggage hatches.
  for (const x of [2.0, 0.6, -1.8, -4.0, -5.0]) {
    if (x > doors[1].x0 - 0.1 && x < doors[1].x1 + 0.1) continue;
    asm.addMirrored('indicator', box(0.07, 0.035, 0.02, x, 0.56, W + 0.006, 0.006, 1));
  }
  const hatch = (x0, x1, side) => {
    const y0 = 0.52;
    const y1 = 1.22;
    const z = side * (W + 0.0015);
    for (const x of [x0, x1]) asm.add('seam', box(0.006, y1 - y0, 0.004, x, (y0 + y1) / 2, z, 0.001, 1));
    for (const y of [y0, y1]) asm.add('seam', box(x1 - x0, 0.006, 0.004, (x0 + x1) / 2, y, z, 0.001, 1));
    asm.add('alu', box(0.1, 0.03, 0.025, (x0 + x1) / 2, y1 - 0.12, side * (W + 0.008), 0.006, 1));
  };
  hatch(0.3, 1.5, 1);
  hatch(-1.85, -0.65, 1);
  hatch(0.3, 1.5, -1);
  hatch(1.7, 2.5, -1);

  // Roof: the air-conditioning unit with its condenser fans, and two hatches.
  asm.add('paint_stripe', box(4.0, 0.2, 1.9, 0.4, yRoof + 0.095, 0, 0.07, 3));
  for (const x of [-0.8, 0.0]) {
    asm.add('trim', place(new THREE.CylinderGeometry(0.26, 0.26, 0.01, 28), x, yRoof + 0.196, 0));
    asm.add('alu', place(new THREE.CylinderGeometry(0.07, 0.07, 0.014, 16), x, yRoof + 0.198, 0));
  }
  asm.add('alu', box(1.1, 0.02, 1.5, 1.6, yRoof + 0.2, 0, 0.006, 1));
  for (const x of [3.7, -3.7]) asm.add('trim', box(0.75, 0.06, 0.65, x, yRoof + 0.02, 0, 0.02, 2));

  // Under the floor: axle beams, differential, air tanks and the propeller shaft.
  asm.add('under', box(0.12, 0.12, 1.8, xf, 0.46, 0, 0.01, 1));
  asm.add('under', place(new THREE.CylinderGeometry(0.09, 0.09, 1.7, 12), xr, archY, 0, Math.PI / 2, 0, 0));
  asm.add('under', place(new THREE.SphereGeometry(0.22, 16, 10), xr, 0.44, 0));
  for (const z of [0.45, -0.45]) asm.add('steel', place(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 14), 0.3, 0.33, z, 0, 0, Math.PI / 2));
  asm.add('under', rod([2.4, 0.36, 0], [xr + 0.2, 0.42, 0], 0.045, { radial: 10 }));

  // Wheels: single at the front, twin at the rear, outer face outward.
  for (const [name, x, z, side, rear] of [
    ['wheel_fl', xf, zwF, -1, false],
    ['wheel_fr', xf, zwF, 1, false],
    ['wheel_rl', xr, zwR, -1, true],
    ['wheel_rr', xr, zwR, 1, true]
  ]) {
    asm.wheel(name, heavyWheel(tyreR, tyreW, rimR, { twin: rear ? dual : 0 }), x, tyreR, side * z, side);
  }
}
