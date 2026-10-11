// A Hero Splendor-style 100 cc commuter motorcycle: 2.05 x 0.73 x 1.1 m (to the mirrors), wheelbase
// 1.25 m, 2.75-18 tyres on spoked wheels with drum brakes. A forward-inclined single-cylinder engine
// hung from a tubular frame, telescopic forks, twin rear shocks, the chain on the left (-z) and the
// silencer on the right (+z). Parked upright, with no rider.
import * as THREE from 'three';
import { box as roundedBox, curve, doubleSided, helix, indexed, loft, patch, place, rod, roundTyre, spokedWheel, stations, tube } from './geometry.mjs';

const box = (...args) => indexed(roundedBox(...args));

const xF = 0.72;
const xR = -0.53;
const R = 0.295;
const rimR = 0.229;

// Steering axis, raked 25 degrees: points along it are measured from the front axle.
const rake = (25 * Math.PI) / 180;
const up = new THREE.Vector3(-Math.sin(rake), Math.cos(rake), 0);
const onFork = (d, z = 0) => new THREE.Vector3(xF, R, z).addScaledVector(up, d);

/** A point on a superellipse section between heights bot and top, half-width w, at angle phi (-pi/2 at the bottom, pi/2 at the top). */
function ovalPoint(top, bot, w, p, mid, phi) {
  const yc = bot + (top - bot) * mid;
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  const z = w * Math.pow(Math.max(c, 0), 2 / p);
  const y = s >= 0 ? yc + (top - yc) * Math.pow(s, 2 / p) : yc - (yc - bot) * Math.pow(-s, 2 / p);
  return { z, y };
}

/** A loft section shaped as a superellipse between a bottom and a top height, half-width w. */
function ovalSection(top, bot, w, p, { mid = 0.45, n = 14, m = 'paint', mBottom = m } = {}) {
  const pts = [];
  for (let k = 0; k <= n; k += 1) {
    const { z, y } = ovalPoint(top, bot, w, p, mid, -Math.PI / 2 + (Math.PI * k) / n);
    pts.push({ z, y, m: k < n / 4 ? mBottom : m });
  }
  return pts;
}

// Fuel tank, seat and tail cowl: top line, bottom line and half-width along x.
const tank = {
  top: curve([[-0.1, 0.81], [-0.02, 0.87], [0.1, 0.91], [0.25, 0.925], [0.36, 0.905], [0.43, 0.86]]),
  bot: curve([[-0.1, 0.71], [0.1, 0.67], [0.3, 0.7], [0.43, 0.75]]),
  w: curve([[-0.1, 0.1], [-0.02, 0.145], [0.1, 0.16], [0.25, 0.155], [0.36, 0.12], [0.43, 0.06]])
};
const seat = {
  top: curve([[-0.79, 0.785], [-0.74, 0.808], [-0.5, 0.802], [-0.2, 0.8], [-0.1, 0.81], [-0.05, 0.8]]),
  bot: curve([[-0.79, 0.73], [-0.05, 0.72]]),
  w: curve([[-0.79, 0.07], [-0.72, 0.115], [-0.4, 0.125], [-0.15, 0.13], [-0.05, 0.09]])
};
const tail = {
  top: curve([[-0.9, 0.735], [-0.4, 0.735]]),
  bot: curve([[-0.9, 0.665], [-0.7, 0.64], [-0.4, 0.6]]),
  w: curve([[-0.9, 0.06], [-0.8, 0.095], [-0.55, 0.115], [-0.4, 0.12]])
};

function lofted(asm, part, x0, x1, p, opts) {
  const xs = stations(x0, x1, 0.02, [{ at: x0, span: 0.03, step: 0.006 }, { at: x1, span: 0.03, step: 0.006 }]);
  const parts = loft(xs, (x) => ovalSection(part.top(x), part.bot(x), part.w(x), p, opts), { capStart: opts.m, capEnd: opts.m });
  for (const [m, g] of Object.entries(parts)) asm.add(m, g);
}

/** A flat panel from a side-view outline, thickness t, outer face at z (on the right; mirror for the left). */
function sidePanel(outline, t, z) {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 8 });
  g.deleteAttribute('uv');
  g.translate(0, 0, z - t - 0.004);
  return indexed(g);
}

/** An open arc shell about an axle along z at (x, y): theta runs from below the axle (0) through the front (pi/2) to the top (pi). */
function shell(x, y, r, width, theta0, theta1) {
  const g = new THREE.CylinderGeometry(r, r, width, 32, 1, true, theta0, theta1 - theta0);
  g.rotateX(Math.PI / 2);
  g.deleteAttribute('uv');
  return g.translate(x, y, 0);
}

function buildBodywork(asm) {
  lofted(asm, tank, -0.1, 0.43, 2.4, { m: 'paint', mBottom: 'trim_gloss' });
  lofted(asm, seat, -0.79, -0.05, 4, { m: 'seat', mid: 0.3 });
  lofted(asm, tail, -0.9, -0.4, 3, { m: 'paint', mid: 0.6 });

  // Tank cap, knee pads and the stripe along each side.
  asm.add('chrome', place(new THREE.CylinderGeometry(0.035, 0.038, 0.012, 20), 0.2, 0.926, 0, 0, 0, 0.06));
  for (const s of [1, -1]) {
    const pad = new THREE.SphereGeometry(1, 16, 8);
    pad.scale(0.07, 0.038, 0.01);
    asm.add('rubber', place(pad, 0.03, 0.79, s * 0.146));
  }
  const stripe = patch((u, v) => {
    const x = -0.02 + 0.41 * u;
    const phi = 0.42 + 0.1 * u + 0.09 * v;
    const { z, y } = ovalPoint(tank.top(x), tank.bot(x), tank.w(x), 2.4, 0.45, phi);
    return new THREE.Vector3(x, y, z);
  }, { nu: 30, nv: 2, offset: 0.002 });
  asm.addMirrored('paint_stripe', stripe);

  // Side panels under the seat, with a badge.
  const panel = sidePanel([[-0.05, 0.725], [-0.42, 0.735], [-0.42, 0.63], [-0.26, 0.565], [-0.07, 0.56]], 0.02, 0.135);
  asm.addMirrored('paint', panel);
  asm.addMirrored('chrome', box(0.12, 0.012, 0.004, -0.23, 0.66, 0.137, 0.002, 1));

  // Tail lamp at the end of the cowl, grab rail round the back of the seat.
  asm.add('taillight', place(box(0.04, 0.055, 0.13, 0, 0, 0, 0.014, 2), -0.905, 0.7, 0, 0, 0, -0.25));
  asm.add('trim', place(box(0.03, 0.065, 0.14, 0, 0, 0, 0.01, 1), -0.893, 0.7, 0, 0, 0, -0.25));
  asm.add('alu', tube([[-0.46, 0.755, 0.13], [-0.68, 0.76, 0.128], [-0.8, 0.765, 0.1], [-0.835, 0.77, 0], [-0.8, 0.765, -0.1], [-0.68, 0.76, -0.128], [-0.46, 0.755, -0.13]], 0.011, { segments: 40, radial: 8 }));

  // Mudguards: painted at the front, black plastic at the rear with the plate bracket.
  asm.add('paint', doubleSided(shell(xF, R, 0.325, 0.1, 1.75, 3.55)));
  asm.add('trim', shell(xR, R, 0.33, 0.12, 2.9, 4.3));
  asm.add('trim', place(box(0.24, 0.02, 0.12, 0, 0, 0, 0.006, 1), -0.86, 0.6, 0, 0, 0, -1.0));
  asm.plate('plate_rear', -0.975, 0.56, -1, { width: 0.32, height: 0.085, tilt: 0.2 });
  asm.add('reflector', box(0.01, 0.03, 0.08, -0.93, 0.49, 0, 0.004, 1));

  // Indicators on stalks.
  const lens = () => {
    const g = new THREE.SphereGeometry(1, 14, 8);
    g.scale(0.032, 0.022, 0.022);
    return g;
  };
  for (const s of [1, -1]) {
    asm.add('trim', rod([0.5, 0.81, s * 0.08], [0.53, 0.81, s * 0.17], 0.007, { radial: 6 }));
    asm.add('indicator', place(lens(), 0.545, 0.81, s * 0.18));
    asm.add('trim', rod([-0.8, 0.68, s * 0.07], [-0.82, 0.68, s * 0.15], 0.007, { radial: 6 }));
    asm.add('indicator', place(lens(), -0.835, 0.68, s * 0.16));
  }
}

function buildFrontEnd(asm) {
  // Forks: chrome stanchions into aluminium sliders, triple clamps, and the head tube behind.
  for (const s of [1, -1]) {
    const z = s * 0.075;
    asm.add('chrome', rod(onFork(0.24, z), onFork(0.6, z), 0.016, { radial: 12 }));
    asm.add('alu', rod(onFork(-0.015, z), onFork(0.27, z), 0.022, { radial: 12 }));
    asm.add('chrome', rod(onFork(0.6, z), onFork(0.625, z), 0.019, { radial: 12 }));
  }
  const clamp = (d, h) => {
    const p = onFork(d);
    return place(box(0.06, h, 0.21, 0, 0, 0, 0.015, 2), p.x - 0.01, p.y, 0, 0, 0, rake);
  };
  asm.add('cast', clamp(0.46, 0.03));
  asm.add('cast', clamp(0.6, 0.025));
  asm.add('trim_gloss', rod(onFork(0.43).add(new THREE.Vector3(-0.065, 0, 0)), onFork(0.6).add(new THREE.Vector3(-0.065, 0, 0)), 0.026, { radial: 12 }));
  for (const s of [1, -1]) asm.add('alu', rod([xF, 0.39, s * 0.075], [xF + 0.08, 0.5, s * 0.06], 0.006, { radial: 6 }));
  asm.add('alu', rod([xF - 0.02, R, -0.075], [xF + 0.1, R + 0.1, -0.075], 0.008, { radial: 6 }));

  // Headlamp in its painted cowl, with the speedometer behind and a plate below.
  const cowl = new THREE.SphereGeometry(1, 24, 14);
  cowl.scale(0.09, 0.095, 0.11);
  const head = onFork(0.6);
  asm.add('paint', place(cowl, head.x + 0.04, head.y - 0.02, 0));
  // The lens: a shallow dome whose rim sits just ahead of the cowl, tipped down a little, in a chrome ring.
  const dip = 0.1;
  const lensCap = new THREE.SphereGeometry(0.12, 28, 8, 0, Math.PI * 2, 0, 0.7);
  lensCap.translate(0, -0.12 * Math.cos(0.7), 0);
  lensCap.rotateZ(-Math.PI / 2 - dip);
  asm.add('headlight', place(lensCap, head.x + 0.115, head.y - 0.02, 0));
  const ring = new THREE.TorusGeometry(0.079, 0.009, 8, 32);
  ring.rotateY(Math.PI / 2);
  ring.rotateZ(-dip);
  asm.add('chrome', place(ring, head.x + 0.115, head.y - 0.02, 0));
  const visor = place(box(0.12, 0.02, 0.17, 0, 0, 0, 0.01, 2), head.x + 0.08, head.y + 0.065, 0, 0, 0, -0.35);
  asm.add('paint', visor);
  const speedo = new THREE.CylinderGeometry(0.06, 0.065, 0.04, 24);
  asm.add('trim', place(speedo.clone(), head.x - 0.01, head.y + 0.085, 0, 0, 0, 0.45));
  asm.add('glass', place(new THREE.CylinderGeometry(0.052, 0.052, 0.004, 24), head.x - 0.019, head.y + 0.104, 0, 0, 0, 0.45));
  asm.plate('plate_front', head.x + 0.115, head.y - 0.165, 1, { width: 0.2, height: 0.055 });
  asm.add('trim', box(0.012, 0.07, 0.21, head.x + 0.105, head.y - 0.165, 0, 0.004, 1));

  // Handlebar with grips, levers and mirrors on stems.
  const bar = [[0.37, 0.995, -0.355], [0.415, 0.985, -0.2], [0.435, 0.975, 0], [0.415, 0.985, 0.2], [0.37, 0.995, 0.355]];
  asm.add('chrome', tube(bar, 0.011, { segments: 30, radial: 8 }));
  for (const s of [1, -1]) {
    asm.add('rubber', rod([0.39, 0.99, s * 0.25], [0.365, 0.996, s * 0.365], 0.017, { radial: 12 }));
    asm.add('alu', tube([[0.41, 0.99, s * 0.18], [0.45, 0.985, s * 0.25], [0.43, 0.98, s * 0.33]], 0.006, { segments: 10, radial: 6 }));
    asm.add('trim', box(0.05, 0.04, 0.05, 0.41, 0.985, s * 0.17, 0.01, 1));
    asm.add('chrome', rod([0.41, 0.995, s * 0.2], [0.39, 1.06, s * 0.255], 0.006, { radial: 6 }));
    const mirror = new THREE.SphereGeometry(1, 16, 10);
    mirror.scale(0.022, 0.042, 0.065);
    asm.add('trim', place(mirror, 0.39, 1.076, s * 0.27));
    const face = new THREE.CylinderGeometry(1, 1, 0.003, 20);
    face.rotateZ(Math.PI / 2);
    face.scale(1, 0.038, 0.06);
    asm.add('chrome', place(face, 0.368, 1.076, s * 0.27));
  }
}

function buildEngine(asm) {
  // Crankcase with the clutch cover on the right and the magneto cover on the left.
  asm.add('cast', box(0.34, 0.24, 0.22, 0.02, 0.36, 0, 0.05, 3));
  asm.add('cast', place(new THREE.CylinderGeometry(0.105, 0.11, 0.04, 28), 0.05, 0.35, 0.12, Math.PI / 2, 0, 0));
  asm.add('alu', place(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 16), 0.07, 0.36, 0.142, Math.PI / 2, 0, 0));
  asm.add('cast', place(new THREE.CylinderGeometry(0.09, 0.095, 0.035, 28), -0.04, 0.37, -0.12, Math.PI / 2, 0, 0));
  asm.add('cast', box(0.12, 0.1, 0.03, -0.02, 0.32, -0.125, 0.02, 2));

  // The cylinder, leaning forward 12 degrees above horizontal, with its cooling fins and head.
  const tilt = (12 * Math.PI) / 180;
  const axis = new THREE.Vector3(Math.cos(tilt), Math.sin(tilt), 0);
  const base = new THREE.Vector3(0.15, 0.42, 0);
  const at = (d) => base.clone().addScaledVector(axis, d);
  asm.add('cast', rod(at(0), at(0.2), 0.048, { radial: 16 }));
  for (let k = 0; k < 8; k += 1) {
    const p = at(0.035 + k * 0.02);
    asm.add('cast', place(box(0.007, 0.15, 0.15, 0, 0, 0, 0.003, 1), p.x, p.y, 0, 0, 0, tilt));
  }
  const hp = at(0.225);
  asm.add('cast', place(box(0.06, 0.17, 0.16, 0, 0, 0, 0.02, 2), hp.x, hp.y, 0, 0, 0, tilt));
  for (let k = 0; k < 3; k += 1) {
    const p = at(0.2 + k * 0.018);
    asm.add('cast', place(box(0.006, 0.19, 0.18, 0, 0, 0, 0.003, 1), p.x, p.y, 0, 0, 0, tilt));
  }
  asm.add('rubber', rod(hp.clone().add(new THREE.Vector3(-0.02, 0.08, 0.03)), hp.clone().add(new THREE.Vector3(-0.03, 0.12, 0.05)), 0.012, { radial: 8 }));
  // Carburettor and intake behind the cylinder.
  asm.add('cast', box(0.07, 0.06, 0.07, 0.1, 0.54, 0.05, 0.015, 2));
  asm.add('rubber', rod([0.06, 0.54, 0.05], [-0.06, 0.58, 0.07], 0.022, { radial: 10 }));

  // Exhaust: header under the engine to the chrome silencer on the right, with its heat shield.
  const ex = hp.clone().add(new THREE.Vector3(0.02, -0.05, 0.03));
  asm.add('chrome', tube([ex, [ex.x + 0.04, 0.3, 0.06], [0.3, 0.21, 0.1], [0.05, 0.19, 0.13], [-0.18, 0.25, 0.165], [-0.28, 0.3, 0.17]], 0.018, { segments: 40, radial: 10 }));
  const silencer = rod([-0.26, 0.3, 0.17], [-0.84, 0.43, 0.17], 0.052, { r1: 0.044, radial: 20 });
  asm.add('chrome', silencer);
  asm.add('trim', rod([-0.84, 0.43, 0.17], [-0.87, 0.437, 0.17], 0.03, { radial: 14 }));
  const shield = new THREE.CylinderGeometry(0.06, 0.06, 0.24, 20, 1, true, 0.2, 2.2);
  shield.deleteAttribute('uv');
  shield.rotateZ(Math.PI / 2 + Math.atan2(0.13, 0.58));
  asm.add('trim', shield.translate(-0.42, 0.335, 0.17));

  // Foot pegs, brake pedal, gear lever, kick-start and the folded side stand.
  for (const s of [1, -1]) {
    asm.add('rubber', rod([0.0, 0.33, s * 0.1], [0.0, 0.33, s * 0.21], 0.016, { radial: 10 }));
    asm.add('rubber', rod([-0.4, 0.42, s * 0.11], [-0.4, 0.42, s * 0.19], 0.013, { radial: 10 }));
    asm.add('trim_gloss', rod([-0.35, 0.5, s * 0.1], [-0.4, 0.42, s * 0.12], 0.01, { radial: 6 }));
  }
  asm.add('trim_gloss', rod([0.03, 0.33, 0.15], [0.18, 0.29, 0.16], 0.009, { radial: 6 }));
  asm.add('trim_gloss', rod([0.02, 0.4, -0.15], [0.16, 0.35, -0.165], 0.008, { radial: 6 }));
  asm.add('chrome', rod([-0.06, 0.4, 0.15], [-0.24, 0.5, 0.165], 0.009, { radial: 6 }));
  asm.add('trim_gloss', rod([-0.08, 0.22, -0.11], [-0.33, 0.21, -0.13], 0.011, { radial: 6 }));
}

function buildFrame(asm) {
  const black = 'trim_gloss';
  asm.add(black, tube([onFork(0.45).add(new THREE.Vector3(-0.07, 0, 0)), [0.42, 0.6, 0], [0.34, 0.49, 0]], 0.021, { segments: 16, radial: 10 }));
  asm.add(black, tube([onFork(0.58).add(new THREE.Vector3(-0.08, 0, 0)), [0.3, 0.69, 0], [0.0, 0.66, 0], [-0.2, 0.63, 0]], 0.024, { segments: 24, radial: 10 }));
  for (const s of [1, -1]) {
    const z = s * 0.06;
    asm.add(black, tube([[0.34, 0.49, 0], [0.3, 0.3, z], [0.2, 0.2, z], [-0.15, 0.2, z], [-0.18, 0.4, z], [-0.2, 0.63, s * 0.05]], 0.016, { segments: 30, radial: 8 }));
    // Seat rails and the rear subframe.
    asm.add(black, tube([[-0.2, 0.63, s * 0.06], [-0.6, 0.7, s * 0.1], [-0.86, 0.72, s * 0.07]], 0.014, { segments: 16, radial: 8 }));
    asm.add(black, rod([-0.16, 0.42, s * 0.08], [-0.6, 0.69, s * 0.1], 0.013, { radial: 8 }));
  }

  // Swing arm and the twin shock absorbers with chrome springs.
  for (const s of [1, -1]) {
    asm.add(black, rod([-0.14, 0.4, s * 0.085], [xR, R, s * 0.1], 0.02, { radial: 10 }));
    const lower = new THREE.Vector3(xR + 0.04, R + 0.04, s * 0.12);
    const upper = new THREE.Vector3(-0.63, 0.71, s * 0.115);
    asm.add(black, rod(lower, upper, 0.014, { radial: 10 }));
    asm.add('chrome', helix(lower.clone().lerp(upper, 0.12), lower.clone().lerp(upper, 0.82), 0.026, 9, 0.0045));
    asm.add(black, rod(lower.clone().lerp(upper, 0.78), upper, 0.03, { radial: 14 }));
  }
  asm.add(black, rod([-0.2, 0.36, -0.085], [-0.2, 0.36, 0.085], 0.015, { radial: 8 }));

  // Chain on the left round both sprockets, under its guard.
  const F = new THREE.Vector2(0.03, 0.33);
  const Rr = new THREE.Vector2(xR, R);
  const pts = [];
  for (let k = 0; k < 48; k += 1) {
    const a = (k / 48) * Math.PI * 2;
    pts.push(new THREE.Vector2(F.x + Math.cos(a) * 0.045, F.y + Math.sin(a) * 0.045));
    pts.push(new THREE.Vector2(Rr.x + Math.cos(a) * 0.1, Rr.y + Math.sin(a) * 0.1));
  }
  const hull = convexHull(pts);
  const zc = -0.085;
  asm.add('chain', tube(hull.map((p) => [p.x, p.y, zc]), 0.006, { segments: 160, radial: 5, closed: true, tension: 0.1 }));
  const slope = Math.atan2(R + 0.1 - 0.375, xR - 0.03);
  asm.add('trim', place(box(0.6, 0.012, 0.06, 0, 0, 0, 0.004, 1), (0.03 + xR) / 2 - 0.02, (0.375 + R + 0.1) / 2 + 0.025, zc, 0, 0, slope + Math.PI));
  asm.add('trim', place(box(0.56, 0.06, 0.008, 0, 0, 0, 0.003, 1), (0.03 + xR) / 2 - 0.02, (0.375 + R + 0.1) / 2 + 0.0, zc - 0.03, 0, 0, slope + Math.PI));
  asm.add('cast', place(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 20), F.x, F.y, -0.115, Math.PI / 2, 0, 0));
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

function wheel(rear) {
  const w = spokedWheel(rimR, 0.045, { spokes: 36, hubRadius: rear ? 0.07 : 0.06, hubWidth: rear ? 0.13 : 0.11, flange: rear ? 0.075 : 0.065, cross: 0.5 });
  const parts = { tyre: roundTyre(R, 0.072, rimR + 0.002, { segments: 56 }), rim: w.rim, chrome: w.spokes, alu: w.hub };
  // Drum brake plate on the right; the rear sprocket on the left.
  const plate = new THREE.CylinderGeometry(rear ? 0.085 : 0.075, rear ? 0.085 : 0.075, 0.02, 24);
  plate.rotateX(Math.PI / 2);
  plate.translate(0, 0, rear ? 0.07 : -0.06);
  plate.deleteAttribute('uv');
  parts.cast = plate;
  if (rear) {
    const sprocket = new THREE.CylinderGeometry(0.103, 0.103, 0.006, 40);
    sprocket.rotateX(Math.PI / 2);
    sprocket.translate(0, 0, -0.085);
    sprocket.deleteAttribute('uv');
    parts.chain = sprocket;
  }
  return parts;
}

export function buildMotorcycle(asm) {
  buildBodywork(asm);
  buildFrontEnd(asm);
  buildEngine(asm);
  buildFrame(asm);
  asm.wheel('wheel_front', wheel(false), xF, R, 0, 1);
  asm.wheel('wheel_rear', wheel(true), xR, R, 0, 1);
}

