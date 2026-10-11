// A Hero / Atlas-style black roadster bicycle: 1.77 x 0.6 x 1.05 m, wheelbase 1.02 m, 28 x 1 1/2 inch
// (40-635) tyres on 36-spoke wheels. A steel diamond frame, rod brakes, a sprung saddle, a rear
// carrier, full mudguards, a half chain guard and the drive on the right (+z). No lamps, just
// reflectors; no number plates.
import * as THREE from 'three';
import { box as roundedBox, curve, helix, indexed, loft, place, rod, roundTyre, spokedWheel, stations, tube } from './geometry.mjs';

const box = (...args) => indexed(roundedBox(...args));

const xF = 0.51;
const xR = -0.51;
const R = 0.355;
const rimR = 0.3175;

// Frame geometry (side view): bottom bracket, seat cluster, head tube and the steering axis.
const BB = new THREE.Vector3(-0.07, 0.29, 0);
const seatTop = new THREE.Vector3(-0.275, 0.8, 0);
const headDir = new THREE.Vector3(Math.cos((68 * Math.PI) / 180), -Math.sin((68 * Math.PI) / 180), 0);
const headTop = new THREE.Vector3(xF - 0.065, R, 0).addScaledVector(headDir, -(0.83 - R) / Math.sin((68 * Math.PI) / 180));
const headBot = headTop.clone().addScaledVector(headDir, 0.16);
const v3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);

function buildFrame(asm) {
  const paint = 'paint';
  // Main triangle and the rear triangle.
  asm.add(paint, rod(seatTop.clone().add(v3(0.02, 0.0)), headTop.clone().add(v3(0, -0.015)), 0.0145, { radial: 12 }));
  asm.add(paint, rod(headBot.clone().add(v3(-0.005, 0.02)), BB, 0.0155, { radial: 12 }));
  asm.add(paint, rod(BB, seatTop.clone().add(v3(0, 0.03)), 0.0145, { radial: 12 }));
  asm.add(paint, rod(headTop.clone().add(v3(0, 0.02)), headBot.clone().add(v3(0, -0.02)), 0.018, { radial: 14 }));
  for (const s of [1, -1]) {
    asm.add(paint, tube([BB.clone().setZ(s * 0.03), v3(-0.3, 0.32, s * 0.05), v3(xR + 0.03, R, s * 0.06)], 0.009, { segments: 14, radial: 8 }));
    asm.add(paint, tube([seatTop.clone().add(v3(-0.01, -0.02, s * 0.022)), v3(-0.4, 0.58, s * 0.045), v3(xR + 0.02, R + 0.01, s * 0.058)], 0.008, { segments: 14, radial: 8 }));
    asm.add('chrome', box(0.03, 0.04, 0.006, xR, R, s * 0.062, 0.004, 1));
  }
  asm.add(paint, place(new THREE.CylinderGeometry(0.022, 0.022, 0.075, 16), BB.x, BB.y, 0, Math.PI / 2, 0, 0));
  asm.add('chrome', box(0.012, 0.05, 0.03, headTop.x + 0.03, (headTop.y + headBot.y) / 2, 0, 0.004, 1));

  // Fork: crown under the head tube and two blades curving forward to the hub.
  const crown = headBot.clone().addScaledVector(headDir, 0.03);
  asm.add('chrome', place(box(0.04, 0.03, 0.11, 0, 0, 0, 0.008, 1), crown.x, crown.y, 0, 0, 0, (22 * Math.PI) / 180));
  // Each blade follows the steering axis and bends forward towards the bottom, putting the hub 65 mm ahead of it.
  const axisX = (y) => xF - 0.065 - (y - R) * (headDir.x / -headDir.y);
  for (const s of [1, -1]) {
    const z = s * 0.046;
    const pts = [[crown.y, 0], [0.56, 0.003], [0.47, 0.016], [0.41, 0.036], [R, 0.065]].map(([y, off]) => v3(axisX(y) + off, y, z));
    asm.add(paint, tube(pts, 0.011, { segments: 18, radial: 8 }));
  }

  // Seat post and saddle with its springs.
  const post = seatTop.clone().add(v3(-0.065, 0.15));
  asm.add('chrome', rod(seatTop, post, 0.0125, { radial: 10 }));
  asm.add('chrome', rod(v3(post.x - 0.03, post.y + 0.01), v3(post.x + 0.07, post.y + 0.025), 0.007, { radial: 6 }));
  for (const s of [1, -1]) {
    asm.add('chrome', rod(v3(post.x - 0.02, post.y + 0.005, 0), v3(-0.44, post.y - 0.005, s * 0.065), 0.006, { radial: 6 }));
    asm.add('chrome', helix(v3(-0.44, post.y - 0.005, s * 0.065), v3(-0.445, post.y + 0.055, s * 0.065), 0.016, 6, 0.0035));
  }
  const saddle = {
    top: curve([[-0.47, 0.99], [-0.42, 1.005], [-0.32, 1.002], [-0.24, 0.995], [-0.19, 0.99]]),
    bot: curve([[-0.47, 0.955], [-0.19, 0.97]]),
    w: curve([[-0.47, 0.08], [-0.44, 0.12], [-0.38, 0.115], [-0.3, 0.07], [-0.22, 0.035], [-0.19, 0.02]])
  };
  const sxs = stations(-0.47, -0.19, 0.012, [{ at: -0.47, span: 0.015, step: 0.004 }]);
  const section = (x) => {
    const pts = [];
    const n = 12;
    const top = saddle.top(x);
    const bot = saddle.bot(x);
    const w = saddle.w(x);
    for (let k = 0; k <= n; k += 1) {
      const phi = -Math.PI / 2 + (Math.PI * k) / n;
      const c = Math.cos(phi);
      const sn = Math.sin(phi);
      const yc = bot + (top - bot) * 0.35;
      pts.push({ z: w * Math.pow(Math.max(c, 0), 0.6), y: sn >= 0 ? yc + (top - yc) * Math.pow(sn, 0.6) : yc - (yc - bot) * Math.pow(-sn, 0.6), m: 'seat' });
    }
    return pts;
  };
  for (const [m, g] of Object.entries(loft(sxs, section, { capStart: 'seat', capEnd: 'seat' }))) asm.add(m, g);
}

function buildSteering(asm) {
  // Stem and the swept-back roadster handlebar, grips, bell and the rod-brake levers.
  const stemTop = headTop.clone().addScaledVector(headDir, -0.15);
  asm.add('chrome', rod(headTop, stemTop, 0.012, { radial: 10 }));
  asm.add('chrome', rod(stemTop, stemTop.clone().add(v3(0.06, 0.0)), 0.011, { radial: 10 }));
  const c = stemTop.clone().add(v3(0.06, 0));
  const bar = [];
  for (const s of [-1, 1]) {
    const side = [v3(c.x - 0.18, c.y + 0.05, s * 0.272), v3(c.x - 0.1, c.y + 0.045, s * 0.255), v3(c.x - 0.0, c.y + 0.02, s * 0.19), v3(c.x + 0.01, c.y, s * 0.08)];
    if (s < 0) bar.push(...side);
    else bar.push(v3(c.x + 0.01, c.y, 0), ...side.reverse());
  }
  asm.add('chrome', tube(bar, 0.011, { segments: 48, radial: 8 }));
  for (const s of [1, -1]) {
    asm.add('rubber', rod(v3(c.x - 0.13, c.y + 0.048, s * 0.265), v3(c.x - 0.215, c.y + 0.052, s * 0.282), 0.016, { radial: 12 }));
    // Rod-brake lever under each grip, its rod running down to the brake.
    asm.add('chrome', rod(v3(c.x - 0.04, c.y + 0.03, s * 0.235), v3(c.x - 0.15, c.y + 0.02, s * 0.255), 0.005, { radial: 6 }));
  }
  asm.add('chrome', rod(v3(c.x - 0.02, c.y + 0.02, 0.0), v3(headBot.x + 0.03, headBot.y - 0.02, 0.0), 0.004, { radial: 6 }));
  const bell = new THREE.SphereGeometry(0.03, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  asm.add('chrome', place(bell, c.x - 0.03, c.y + 0.045, -0.16));
  // Front reflector on the head tube.
  asm.add('headlight', place(box(0.012, 0.05, 0.035, 0, 0, 0, 0.006, 1), headTop.x + 0.045, headTop.y - 0.07, 0, 0, 0, 0.38));
  // Front brake: the stirrup pulls its block up against the inside of the rim.
  const stirrup = v3(xF + 0.02, R + rimR + 0.02);
  asm.add('chrome', rod(v3(headBot.x + 0.03, headBot.y - 0.02, 0), v3(stirrup.x, stirrup.y + 0.05, 0), 0.004, { radial: 6 }));
  for (const s of [1, -1]) asm.add('chrome', rod(v3(stirrup.x, stirrup.y + 0.05, 0), v3(stirrup.x - 0.02, R + rimR - 0.02, s * 0.03), 0.004, { radial: 6 }));
}

function buildDrive(asm) {
  // Chainring with its spider, cranks and pedals; the chain to the rear sprocket.
  const zc = 0.06;
  const ring = new THREE.TorusGeometry(0.095, 0.006, 6, 48);
  asm.add('chrome', place(ring, BB.x, BB.y, zc));
  for (let k = 0; k < 5; k += 1) {
    const a = (k / 5) * Math.PI * 2;
    asm.add('chrome', rod(v3(BB.x, BB.y, zc), v3(BB.x + Math.cos(a) * 0.092, BB.y + Math.sin(a) * 0.092, zc), 0.006, { radial: 6 }));
  }
  const crankA = 0.6;
  for (const s of [1, -1]) {
    const a = s > 0 ? crankA : crankA + Math.PI;
    const end = v3(BB.x + Math.cos(a) * 0.165, BB.y + Math.sin(a) * 0.165, s * 0.075);
    asm.add('chrome', rod(v3(BB.x, BB.y, s * 0.07), end, 0.009, { radial: 8 }));
    asm.add('chrome', rod(end, end.clone().setZ(s * 0.16), 0.006, { radial: 6 }));
    asm.add('rubber', box(0.04, 0.02, 0.08, end.x, end.y, s * 0.125, 0.006, 1));
    asm.add('trim', box(0.06, 0.012, 0.09, end.x, end.y, s * 0.125, 0.003, 1));
  }
  const pts = [];
  for (let k = 0; k < 48; k += 1) {
    const a = (k / 48) * Math.PI * 2;
    pts.push(new THREE.Vector2(BB.x + Math.cos(a) * 0.098, BB.y + Math.sin(a) * 0.098));
    pts.push(new THREE.Vector2(xR + Math.cos(a) * 0.04, R + Math.sin(a) * 0.04));
  }
  asm.add('chain', tube(convexHull(pts).map((p) => [p.x, p.y, zc]), 0.004, { segments: 160, radial: 5, closed: true, tension: 0.1 }));
  // Half chain guard over the top run and the top of the chainring.
  const g0 = v3(BB.x + 0.1, BB.y + 0.12);
  const g1 = v3(xR + 0.1, R + 0.06);
  asm.add('paint', place(box(g0.distanceTo(g1), 0.006, 0.05, 0, 0, 0, 0.002, 1), (g0.x + g1.x) / 2, (g0.y + g1.y) / 2, zc + 0.008, 0, 0, Math.atan2(g0.y - g1.y, g0.x - g1.x)));
  const arc = new THREE.CylinderGeometry(0.125, 0.125, 0.05, 24, 1, true, Math.PI * 0.55, Math.PI * 0.75);
  arc.rotateX(Math.PI / 2);
  arc.deleteAttribute('uv');
  asm.add('trim', arc.translate(BB.x, BB.y, zc + 0.008));
}

/** Convex hull of 2D points (monotone chain), counter-clockwise. */
function convexHull(points) {
  const p = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** An open arc shell about an axle along z at (x, y): theta runs from below the axle (0) through the front (pi/2) to the top (pi). */
function shell(x, y, r, width, theta0, theta1) {
  const g = new THREE.CylinderGeometry(r, r, width, 40, 1, true, theta0, theta1 - theta0);
  g.rotateX(Math.PI / 2);
  g.deleteAttribute('uv');
  return g.translate(x, y, 0);
}
const onArc = (x, y, r, theta, z = 0) => v3(x + r * Math.sin(theta), y - r * Math.cos(theta), z);

function buildFittings(asm) {
  // Mudguards with their stays; the 'trim' material is double-sided, so the shells read from inside too.
  const rg = R + 0.025;
  asm.add('trim', shell(xF, R, rg, 0.055, 1.25, 3.75));
  asm.add('trim', shell(xR, R, rg, 0.06, 2.55, 4.42));
  for (const s of [1, -1]) {
    asm.add('chrome', rod(onArc(xF, R, rg - 0.005, 1.4, s * 0.026), v3(xF, R, s * 0.05), 0.0025, { radial: 4 }));
    asm.add('chrome', rod(onArc(xR, R, rg - 0.005, 4.3, s * 0.03), v3(xR, R, s * 0.064), 0.0025, { radial: 4 }));
  }
  asm.add('reflector', place(box(0.012, 0.05, 0.04, 0, 0, 0, 0.006, 1), onArc(xR, R, rg + 0.006, 4.25).x, onArc(xR, R, rg, 4.25).y, 0, 0, 0, -0.1));

  // Rear carrier: a flat rack over the rear wheel on stays to the hub and the seat stays.
  const cy = 0.76;
  const cx0 = -0.31;
  const cx1 = -0.82;
  for (const s of [1, -1]) {
    asm.add('chrome', rod(v3(cx0, cy, s * 0.07), v3(cx1, cy, s * 0.07), 0.006, { radial: 6 }));
    asm.add('chrome', rod(v3(cx1 + 0.04, cy, s * 0.07), v3(xR, R, s * 0.07), 0.005, { radial: 6 }));
    asm.add('chrome', rod(v3(-0.66, cy, s * 0.07), v3(xR + 0.02, R, s * 0.07), 0.005, { radial: 6 }));
    asm.add('chrome', rod(v3(cx0, cy, s * 0.07), v3(-0.36, 0.67, s * 0.04), 0.005, { radial: 6 }));
  }
  for (const x of [cx0, -0.45, -0.58, -0.7, cx1]) asm.add('chrome', rod(v3(x, cy, -0.075), v3(x, cy, 0.075), 0.005, { radial: 6 }));
  asm.add('paint', box(0.5, 0.004, 0.1, (cx0 + cx1) / 2, cy + 0.006, 0, 0.002, 1));

  // Rear stand, folded up under the carrier.
  for (const s of [1, -1]) asm.add('paint', rod(v3(xR, R, s * 0.075), v3(xR - 0.3, R + 0.16, s * 0.08), 0.006, { radial: 6 }));
  asm.add('paint', rod(v3(xR - 0.3, R + 0.16, -0.08), v3(xR - 0.3, R + 0.16, 0.08), 0.006, { radial: 6 }));

  // Rear brake rod along the top tube to the stirrup behind the seat stays.
  asm.add('chrome', rod(v3(headTop.x - 0.02, headTop.y - 0.04, 0.02), v3(seatTop.x + 0.02, seatTop.y - 0.04, 0.02), 0.004, { radial: 6 }));
  asm.add('chrome', rod(v3(seatTop.x + 0.02, seatTop.y - 0.04, 0.02), v3(-0.37, R + rimR + 0.02, 0.0), 0.004, { radial: 6 }));
}

function wheel(rear) {
  const w = spokedWheel(rimR, 0.026, { spokes: 36, hubRadius: 0.018, hubWidth: rear ? 0.12 : 0.09, flange: 0.028, spokeRadius: 0.0011, cross: 0.32, segments: 64 });
  const parts = { tyre: roundTyre(R, 0.04, rimR + 0.002, { segments: 72 }), chrome: w.rim, rim: w.spokes, alu: w.hub };
  if (rear) {
    const sprocket = new THREE.CylinderGeometry(0.042, 0.042, 0.004, 24);
    sprocket.rotateX(Math.PI / 2);
    sprocket.translate(0, 0, 0.06);
    sprocket.deleteAttribute('uv');
    parts.chain = sprocket;
  }
  return parts;
}

export function buildBicycle(asm) {
  buildFrame(asm);
  buildSteering(asm);
  buildDrive(asm);
  buildFittings(asm);
  asm.wheel('wheel_front', wheel(false), xF, R, 0, 1);
  asm.wheel('wheel_rear', wheel(true), xR, R, 0, 1);
}
