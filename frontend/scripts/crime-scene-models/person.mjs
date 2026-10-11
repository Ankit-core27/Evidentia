// A posable forensic mannequin: an adult of 1.72 m in a T-shirt, trousers and shoes.
// Frame: faces +x, y up, metres, origin on the ground midway between the feet; the
// figure's left side is -z. Each body segment is sculpted as an implicit surface (smooth
// unions of anatomical primitives) and polygonised with surface nets, then hung under a
// joint group at its anatomical pivot, so rotating a joint bends the body naturally.
// Every segment overlaps its parent with a rounded cap centred on the shared pivot,
// which keeps bent joints closed.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { curve } from './geometry.mjs';

// ---------------------------------------------------------------------------------------
// Implicit-surface toolkit. A field is f(x, y, z) -> signed distance (negative inside).

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const prof = (keys) => (typeof keys === 'number' ? () => keys : curve(keys));

function sminK(a, b, k) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

// A field may carry `plain`: the same surface without the hidden sink of a joint overlap
// (see split), used for normals so overlapping segments shade as one surface.
const withPlain = (f, fs, make) => {
  if (fs.some((g) => g.plain)) f.plain = make(...fs.map((g) => g.plain ?? g));
  return f;
};

/** Smooth union of fields with blend radius k. */
function union(k, ...fs) {
  const f = (x, y, z) => {
    let d = fs[0](x, y, z);
    for (let i = 1; i < fs.length; i += 1) d = sminK(d, fs[i](x, y, z), k);
    return d;
  };
  return withPlain(f, fs, (...gs) => union(k, ...gs));
}
/** Smooth intersection. */
function inter(k, ...fs) {
  const f = (x, y, z) => {
    let d = -fs[0](x, y, z);
    for (let i = 1; i < fs.length; i += 1) d = sminK(d, -fs[i](x, y, z), k);
    return -d;
  };
  return withPlain(f, fs, (...gs) => inter(k, ...gs));
}
/** a minus b, smoothed. */
function cut(k, a, b) {
  return withPlain((x, y, z) => -sminK(-a(x, y, z), b(x, y, z), k), [a, b], (ga, gb) => cut(k, ga, gb));
}
const grow = (f, r) => (x, y, z) => f(x, y, z) - r;

/** Rotation matrix rows from Euler angles (XYZ, like three), used to take world offsets into a local frame. */
function basis(rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)).elements;
  // Columns of the rotation are the local axes in world space; rows of the transpose map world -> local.
  return [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
}

const sphere = ([cx, cy, cz], r) => (x, y, z) => {
  const dx = x - cx;
  const dy = y - cy;
  const dz = z - cz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
};

/** Ellipsoid (bound-corrected estimate), optionally rotated by Euler angles. */
function ellipsoid([cx, cy, cz], [rx, ry, rz], rot) {
  const m = rot ? basis(...rot) : null;
  return (x, y, z) => {
    let px = x - cx;
    let py = y - cy;
    let pz = z - cz;
    if (m) {
      const lx = px * m[0] + py * m[1] + pz * m[2];
      const ly = px * m[3] + py * m[4] + pz * m[5];
      pz = px * m[6] + py * m[7] + pz * m[8];
      px = lx;
      py = ly;
    }
    const ax = px / rx;
    const ay = py / ry;
    const az = pz / rz;
    const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
    const k1 = Math.sqrt((ax / rx) ** 2 + (ay / ry) ** 2 + (az / rz) ** 2);
    return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
  };
}

/** Cone with spherical ends of radii ra at a and rb at b. */
function cone(a, b, ra, rb) {
  const bx = b[0] - a[0];
  const by = b[1] - a[1];
  const bz = b[2] - a[2];
  const l2 = bx * bx + by * by + bz * bz;
  const rr = ra - rb;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  return (x, y, z) => {
    const px = x - a[0];
    const py = y - a[1];
    const pz = z - a[2];
    const yy = px * bx + py * by + pz * bz;
    const zz = yy - l2;
    const qx = px * l2 - bx * yy;
    const qy = py * l2 - by * yy;
    const qz = pz * l2 - bz * yy;
    const x2 = qx * qx + qy * qy + qz * qz;
    const y2 = yy * yy * l2;
    const z2 = zz * zz * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - rb;
    if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - ra;
    return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - ra;
  };
}

/** Rounded box with half extents h and corner radius r, optionally rotated. */
function roundBox([cx, cy, cz], [hx, hy, hz], r, rot) {
  const m = rot ? basis(...rot) : null;
  return (x, y, z) => {
    let px = x - cx;
    let py = y - cy;
    let pz = z - cz;
    if (m) {
      const lx = px * m[0] + py * m[1] + pz * m[2];
      const ly = px * m[3] + py * m[4] + pz * m[5];
      pz = px * m[6] + py * m[7] + pz * m[8];
      px = lx;
      py = ly;
    }
    const qx = Math.abs(px) - hx + r;
    const qy = Math.abs(py) - hy + r;
    const qz = Math.abs(pz) - hz + r;
    const ox = Math.max(qx, 0);
    const oy = Math.max(qy, 0);
    const oz = Math.max(qz, 0);
    return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - r;
  };
}

/** Signed distance to the plane through p with normal n (positive on the normal side). */
function plane(p, n) {
  const l = Math.hypot(...n);
  const [nx, ny, nz] = n.map((v) => v / l);
  return (x, y, z) => (x - p[0]) * nx + (y - p[1]) * ny + (z - p[2]) * nz;
}

/**
 * A body form lofted along a -> b with super-elliptic cross-sections. Profiles are curves
 * over s, the distance from a in metres: front/back radii along the forward axis, lat/med
 * radii along the lateral axis (f x axis; -z for a left limb hanging down), optional centre
 * offsets du (forward) and dv (lateral), and exponent n (2 = ellipse, higher = boxier).
 * The form spans s = from..to (default 0..L) with flat ends, or ends rounded by `round`.
 */
function tube(a, b, fwd, p) {
  const e = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const L = e.length();
  e.normalize();
  const f = new THREE.Vector3(...fwd).addScaledVector(e, -new THREE.Vector3(...fwd).dot(e)).normalize();
  const l = new THREE.Vector3().crossVectors(f, e);
  const front = prof(p.front);
  const back = prof(p.back ?? p.front);
  const lat = prof(p.lat);
  const med = prof(p.med ?? p.lat);
  const du = prof(p.du ?? 0);
  const dv = prof(p.dv ?? 0);
  const ex = prof(p.n ?? 2);
  const s0 = p.from ?? 0;
  const s1 = p.to ?? L;
  const round = p.round ?? 0;
  return (x, y, z) => {
    const px = x - a[0];
    const py = y - a[1];
    const pz = z - a[2];
    const s = px * e.x + py * e.y + pz * e.z;
    const sc = clamp(s, s0, s1);
    const u = px * f.x + py * f.y + pz * f.z - du(sc);
    const v = px * l.x + py * l.y + pz * l.z - dv(sc);
    const ru = u >= 0 ? front(sc) : back(sc);
    const rv = v >= 0 ? lat(sc) : med(sc);
    const n = ex(sc);
    const U = Math.abs(u) / ru;
    const V = Math.abs(v) / rv;
    const q = (U ** n + V ** n) ** (1 / n);
    let d;
    if (q < 1e-6) d = -Math.min(ru, rv);
    else {
      const gu = U ** (n - 1) / ru;
      const gv = V ** (n - 1) / rv;
      d = (q - 1) / (q ** (1 - n) * Math.sqrt(gu * gu + gv * gv));
    }
    const out = Math.max(s0 - s, s - s1);
    if (round) return -sminK(-d, -out, round);
    if (out <= 0) return Math.max(d, out);
    return d > 0 ? Math.sqrt(d * d + out * out) : out;
  };
}

/** A tube's local frame, for placing details relative to a limb: point(s, u, v). */
function limbFrame(a, b, fwd) {
  const e = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
  const f = new THREE.Vector3(...fwd).addScaledVector(e, -new THREE.Vector3(...fwd).dot(e)).normalize();
  const l = new THREE.Vector3().crossVectors(f, e);
  const at = (s, u = 0, v = 0) => [0, 1, 2].map((i) => a[i] + e.getComponent(i) * s + f.getComponent(i) * u + l.getComponent(i) * v);
  return { e, f, l, at };
}

// ---------------------------------------------------------------------------------------
// Surface nets: polygonises a field on a grid, projects vertices onto the surface and
// takes normals from the field gradient, so even coarse grids shade smoothly.

function polygonize(field, [x0, y0, z0], [x1, y1, z1], h, label) {
  // Snap the grid so it is symmetric about z = 0 when the bounds are.
  const ix0 = Math.floor(x0 / h);
  const iy0 = Math.floor(y0 / h);
  const iz0 = Math.floor(z0 / h);
  const nx = Math.ceil(x1 / h) - ix0 + 1;
  const ny = Math.ceil(y1 / h) - iy0 + 1;
  const nz = Math.ceil(z1 / h) - iz0 + 1;
  const X = (i) => (ix0 + i) * h;
  const Y = (j) => (iy0 + j) * h;
  const Z = (k) => (iz0 + k) * h;
  const vals = new Float32Array(nx * ny * nz);
  const id = (i, j, k) => (k * ny + j) * nx + i;
  let leak = 0;
  for (let k = 0; k < nz; k += 1) {
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const v = field(X(i), Y(j), Z(k));
        vals[id(i, j, k)] = v;
        if (v < 0 && (i === 0 || j === 0 || k === 0 || i === nx - 1 || j === ny - 1 || k === nz - 1)) leak += 1;
      }
    }
  }
  if (leak) console.warn(`${label}: surface touches the grid boundary at ${leak} samples`);

  const corners = [
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]
  ];
  const edges = [
    [0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]
  ];
  const cid = (i, j, k) => (k * (ny - 1) + j) * (nx - 1) + i;
  const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const pos = [];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k += 1) {
    for (let j = 0; j < ny - 1; j += 1) {
      for (let i = 0; i < nx - 1; i += 1) {
        let inside = 0;
        for (let c = 0; c < 8; c += 1) {
          cv[c] = vals[id(i + corners[c][0], j + corners[c][1], k + corners[c][2])];
          if (cv[c] < 0) inside += 1;
        }
        if (inside === 0 || inside === 8) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let n = 0;
        for (const [ca, cb] of edges) {
          const va = cv[ca];
          const vb = cv[cb];
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          sx += corners[ca][0] + (corners[cb][0] - corners[ca][0]) * t;
          sy += corners[ca][1] + (corners[cb][1] - corners[ca][1]) * t;
          sz += corners[ca][2] + (corners[cb][2] - corners[ca][2]) * t;
          n += 1;
        }
        cellVert[cid(i, j, k)] = pos.length / 3;
        pos.push(X(i) + (sx / n) * h, Y(j) + (sy / n) * h, Z(k) + (sz / n) * h);
      }
    }
  }

  const idx = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) [b, d] = [d, b];
    // Split along the shorter diagonal.
    const dist = (p, q) => (pos[3 * p] - pos[3 * q]) ** 2 + (pos[3 * p + 1] - pos[3 * q + 1]) ** 2 + (pos[3 * p + 2] - pos[3 * q + 2]) ** 2;
    if (dist(a, c) <= dist(b, d)) idx.push(a, b, c, a, c, d);
    else idx.push(a, b, d, b, c, d);
  };
  for (let k = 1; k < nz - 1; k += 1) {
    for (let j = 1; j < ny - 1; j += 1) {
      for (let i = 1; i < nx - 1; i += 1) {
        const v0 = vals[id(i, j, k)] < 0;
        if (v0 !== vals[id(i + 1, j, k)] < 0) {
          quad(cellVert[cid(i, j - 1, k - 1)], cellVert[cid(i, j, k - 1)], cellVert[cid(i, j, k)], cellVert[cid(i, j - 1, k)], !v0);
        }
        if (v0 !== vals[id(i, j + 1, k)] < 0) {
          quad(cellVert[cid(i - 1, j, k - 1)], cellVert[cid(i - 1, j, k)], cellVert[cid(i, j, k)], cellVert[cid(i, j, k - 1)], !v0);
        }
        if (v0 !== vals[id(i, j, k + 1)] < 0) {
          quad(cellVert[cid(i - 1, j - 1, k)], cellVert[cid(i, j - 1, k)], cellVert[cid(i, j, k)], cellVert[cid(i - 1, j, k)], !v0);
        }
      }
    }
  }

  project(field, pos, h);
  return { pos, idx };
}

/** Moves vertices onto the surface with damped Newton steps (at most `limit` each). */
function project(field, pos, limit) {
  const eps = 0.0004;
  for (let v = 0; v < pos.length; v += 3) {
    let [x, y, z] = [pos[v], pos[v + 1], pos[v + 2]];
    const [ox, oy, oz] = [x, y, z];
    for (let it = 0; it < 5; it += 1) {
      const f = field(x, y, z);
      if (Math.abs(f) < 1e-5) break;
      const gx = (field(x + eps, y, z) - field(x - eps, y, z)) / (2 * eps);
      const gy = (field(x, y + eps, z) - field(x, y - eps, z)) / (2 * eps);
      const gz = (field(x, y, z + eps) - field(x, y, z - eps)) / (2 * eps);
      const g2 = gx * gx + gy * gy + gz * gz;
      if (g2 < 1e-8) break;
      x -= (f * gx) / g2;
      y -= (f * gy) / g2;
      z -= (f * gz) / g2;
    }
    const moved = Math.hypot(x - ox, y - oy, z - oz);
    const t = moved > limit ? limit / moved : 1;
    pos[v] = ox + (x - ox) * t;
    pos[v + 1] = oy + (y - oy) * t;
    pos[v + 2] = oz + (z - oz) * t;
  }
}

/**
 * Quadric-error edge collapse (Garland-Heckbert) down to `target` triangles, so smooth
 * areas thin out while detailed ones keep their density. Rejects collapses that flip
 * faces or break the mesh's manifold link condition.
 */
function simplify(pos, idx, target) {
  const nv = pos.length / 3;
  let nf = idx.length / 3;
  if (nf <= target) return { pos, idx };
  const P = Float64Array.from(pos);
  const F = Int32Array.from(idx);
  const faceAlive = new Uint8Array(nf).fill(1);
  const Q = new Float64Array(nv * 10);
  const vf = Array.from({ length: nv }, () => []);
  const faceNormal = (f, out, moved = -1, mx = 0, my = 0, mz = 0) => {
    const v = [F[3 * f], F[3 * f + 1], F[3 * f + 2]].map((i) => (i === moved ? [mx, my, mz] : [P[3 * i], P[3 * i + 1], P[3 * i + 2]]));
    const ux = v[1][0] - v[0][0];
    const uy = v[1][1] - v[0][1];
    const uz = v[1][2] - v[0][2];
    const wx = v[2][0] - v[0][0];
    const wy = v[2][1] - v[0][1];
    const wz = v[2][2] - v[0][2];
    out[0] = uy * wz - uz * wy;
    out[1] = uz * wx - ux * wz;
    out[2] = ux * wy - uy * wx;
    out[3] = v[0][0];
    out[4] = v[0][1];
    out[5] = v[0][2];
    return out;
  };
  const tmp = new Float64Array(6);
  for (let f = 0; f < nf; f += 1) {
    const [a, b, c] = [F[3 * f], F[3 * f + 1], F[3 * f + 2]];
    if (a === b || b === c || a === c) {
      faceAlive[f] = 0;
      continue;
    }
    faceNormal(f, tmp);
    const len = Math.hypot(tmp[0], tmp[1], tmp[2]);
    if (len < 1e-14) continue;
    const [x, y, z] = [tmp[0] / len, tmp[1] / len, tmp[2] / len];
    const d = -(x * tmp[3] + y * tmp[4] + z * tmp[5]);
    const w = len / 2;
    const q = [x * x, x * y, x * z, x * d, y * y, y * z, y * d, z * z, z * d, d * d];
    for (const v of [a, b, c]) {
      for (let i = 0; i < 10; i += 1) Q[10 * v + i] += q[i] * w;
      vf[v].push(f);
    }
  }
  const version = new Int32Array(nv);
  const alive = new Uint8Array(nv).fill(1);
  const qerr = (q, x, y, z) =>
    q[0] * x * x + 2 * q[1] * x * y + 2 * q[2] * x * z + 2 * q[3] * x + q[4] * y * y + 2 * q[5] * y * z + 2 * q[6] * y + q[7] * z * z + 2 * q[8] * z + q[9];
  const qs = new Float64Array(10);
  const best = (a, b) => {
    for (let i = 0; i < 10; i += 1) qs[i] = Q[10 * a + i] + Q[10 * b + i];
    const [A, B, C, D, E, Fq, G, H, I] = [qs[0], qs[1], qs[2], qs[4], qs[5], qs[7], qs[3], qs[6], qs[8]];
    // Solve [A B C; B D E; C E F] p = -[G H I].
    const det = A * (D * Fq - E * E) - B * (B * Fq - E * C) + C * (B * E - D * C);
    const cands = [];
    if (Math.abs(det) > 1e-18) {
      const x = (-G * (D * Fq - E * E) + B * (H * Fq - E * I) - C * (H * E - D * I)) / det;
      const y = (A * (-H * Fq + E * I) + G * (B * Fq - E * C) - C * (B * I - H * C)) / det;
      const z = (A * (-D * I + H * E) - B * (-B * I + H * C) - G * (B * E - D * C)) / det;
      const mx = (P[3 * a] + P[3 * b]) / 2;
      const my = (P[3 * a + 1] + P[3 * b + 1]) / 2;
      const mz = (P[3 * a + 2] + P[3 * b + 2]) / 2;
      const span = Math.hypot(P[3 * a] - P[3 * b], P[3 * a + 1] - P[3 * b + 1], P[3 * a + 2] - P[3 * b + 2]);
      if (Math.hypot(x - mx, y - my, z - mz) < span * 1.5) cands.push([x, y, z]);
    }
    cands.push([P[3 * a], P[3 * a + 1], P[3 * a + 2]], [P[3 * b], P[3 * b + 1], P[3 * b + 2]]);
    cands.push([(P[3 * a] + P[3 * b]) / 2, (P[3 * a + 1] + P[3 * b + 1]) / 2, (P[3 * a + 2] + P[3 * b + 2]) / 2]);
    let out = null;
    for (const c of cands) {
      const e = qerr(qs, c[0], c[1], c[2]);
      if (!out || e < out[0]) out = [e, c[0], c[1], c[2]];
    }
    return out;
  };
  // Binary min-heap of [cost, a, b, versionA, versionB].
  const heap = [];
  const push = (item) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const neighbours = (v) => {
    const s = new Set();
    for (const f of vf[v]) if (faceAlive[f]) for (let k = 0; k < 3; k += 1) if (F[3 * f + k] !== v) s.add(F[3 * f + k]);
    return s;
  };
  const enqueue = (a, b) => {
    const [cost] = best(a, b);
    push([Math.max(cost, 0), a, b, version[a], version[b]]);
  };
  for (let v = 0; v < nv; v += 1) for (const u of neighbours(v)) if (u > v) enqueue(v, u);

  const n0 = new Float64Array(6);
  const n1 = new Float64Array(6);
  while (nf > target && heap.length) {
    const [, a, b, va, vb] = pop();
    if (!alive[a] || !alive[b] || version[a] !== va || version[b] !== vb) continue;
    const na = neighbours(a);
    if (!na.has(b)) continue;
    // Link condition: the edge's two wings must be the only shared neighbours.
    const nb = neighbours(b);
    let shared = 0;
    for (const u of na) if (nb.has(u)) shared += 1;
    if (shared !== 2) continue;
    const [, x, y, z] = best(a, b);
    // Reject collapses that flip or crush a face.
    let ok = true;
    for (const v of [a, b]) {
      for (const f of vf[v]) {
        if (!faceAlive[f]) continue;
        const has = [F[3 * f], F[3 * f + 1], F[3 * f + 2]];
        if (has.includes(a) && has.includes(b)) continue;
        faceNormal(f, n0);
        faceNormal(f, n1, v, x, y, z);
        const l0 = Math.hypot(n0[0], n0[1], n0[2]);
        const l1 = Math.hypot(n1[0], n1[1], n1[2]);
        if (l1 < 1e-14 || (n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2]) / (l0 * l1) < 0.3) {
          ok = false;
          break;
        }
      }
      if (!ok) break;
    }
    if (!ok) continue;
    P[3 * a] = x;
    P[3 * a + 1] = y;
    P[3 * a + 2] = z;
    for (let i = 0; i < 10; i += 1) Q[10 * a + i] += Q[10 * b + i];
    for (const f of vf[b]) {
      if (!faceAlive[f]) continue;
      const has = [F[3 * f], F[3 * f + 1], F[3 * f + 2]];
      if (has.includes(a)) {
        faceAlive[f] = 0;
        nf -= 1;
        continue;
      }
      for (let k = 0; k < 3; k += 1) if (F[3 * f + k] === b) F[3 * f + k] = a;
      vf[a].push(f);
    }
    alive[b] = 0;
    vf[a] = vf[a].filter((f) => faceAlive[f]);
    version[a] += 1;
    for (const u of neighbours(a)) {
      version[u] += 1;
    }
    for (const u of neighbours(a)) {
      enqueue(a, u);
      for (const w of neighbours(u)) if (w !== a) enqueue(Math.min(u, w), Math.max(u, w));
    }
  }
  const out = [];
  for (let f = 0; f < F.length / 3; f += 1) if (faceAlive[f]) out.push(F[3 * f], F[3 * f + 1], F[3 * f + 2]);
  return { pos: Array.from(P), idx: out };
}

/** Compacts a mesh, settles it on the surface and takes normals from the field gradient. */
function finish(field, pos, idx, limit) {
  const shade = field.plain ?? field;
  const used = new Int32Array(pos.length / 3).fill(-1);
  const out = [];
  const I = idx.map((v) => {
    if (used[v] < 0) {
      used[v] = out.length / 3;
      out.push(pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]);
    }
    return used[v];
  });
  project(field, out, limit);
  const eps = 0.0008;
  const N = new Float32Array(out.length);
  for (let v = 0; v < out.length; v += 3) {
    const [x, y, z] = [out[v], out[v + 1], out[v + 2]];
    const gx = shade(x + eps, y, z) - shade(x - eps, y, z);
    const gy = shade(x, y + eps, z) - shade(x, y - eps, z);
    const gz = shade(x, y, z + eps) - shade(x, y, z - eps);
    const gl = Math.hypot(gx, gy, gz) || 1;
    N[v] = gx / gl;
    N[v + 1] = gy / gl;
    N[v + 2] = gz / gl;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  geo.setIndex(I);
  return geo;
}

/** Mirrors a geometry across z = 0 (left side to right side), keeping faces outward. */
function mirror(geo) {
  const g = geo.clone();
  const p = g.getAttribute('position');
  const n = g.getAttribute('normal');
  for (let i = 0; i < p.count; i += 1) {
    p.setZ(i, -p.getZ(i));
    n.setZ(i, -n.getZ(i));
  }
  const a = g.getIndex().array;
  for (let i = 0; i < a.length; i += 3) [a[i + 1], a[i + 2]] = [a[i + 2], a[i + 1]];
  return g;
}


/** Evaluates a field authored in a local frame (origin o, orthonormal world axes ax, ay, az). */
function local(o, ax, ay, az, field) {
  return (x, y, z) => {
    const px = x - o[0];
    const py = y - o[1];
    const pz = z - o[2];
    return field(px * ax[0] + py * ax[1] + pz * ax[2], px * ay[0] + py * ay[1] + pz * ay[2], px * az[0] + py * az[1] + pz * az[2]);
  };
}

/** Skips a costly field more than 5 cm outside the sphere (c, r) that holds its shape. */
function bounded(field, [cx, cy, cz], r) {
  return (x, y, z) => {
    const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2) - r;
    return d > 0.05 ? d : field(x, y, z);
  };
}

const smooth01 = (t) => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};

/**
 * One side of a field split at the pivot J, across the plane normal to the axis e. The
 * parent keeps t = (p - J).e < reach and the child t > -reach, each ending in a rounded cut.
 * Across the overlap each side sinks by `sink` where the other takes over, so the rest pose
 * shows one seamless surface and a bent joint still stays closed.
 */
function split(field, J, e, side, { reach = 0.04, sink = 0.002, blend = 0.02, round = 0.012 } = {}) {
  const sg = side === 'parent' ? 1 : -1;
  const make = (base, depth) => (x, y, z) => {
    const t = sg * ((x - J[0]) * e[0] + (y - J[1]) * e[1] + (z - J[2]) * e[2]);
    const d = base(x, y, z) + depth * smooth01(t / blend + 0.5);
    return -sminK(-d, reach - t, round);
  };
  const f = make(field, sink);
  f.plain = make(field.plain ?? field, 0);
  return f;
}

const dir = (a, b) => new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
const bisect = (u, v) => u.clone().add(v).normalize().toArray();

// ---------------------------------------------------------------------------------------
// Anatomy. Everything is authored in world space in the rest pose; the right side mirrors
// the left. Proportions follow a 1.72 m adult male.

/** Joint pivots in world space (rest pose) and their parents. */
const JOINTS = {
  pelvis: [[0, 0.95, 0], null],
  spine: [[-0.035, 1.05, 0], 'pelvis'],
  chest: [[-0.04, 1.25, 0], 'spine'],
  neck: [[-0.04, 1.465, 0], 'chest'],
  head: [[-0.012, 1.585, 0], 'neck'],
  shoulder_l: [[-0.015, 1.405, -0.176], 'chest'],
  elbow_l: [[-0.035, 1.103, -0.213], 'shoulder_l'],
  wrist_l: [[0.01, 0.859, -0.243], 'elbow_l'],
  hip_l: [[0, 0.89, -0.09], 'pelvis'],
  knee_l: [[0.005, 0.49, -0.09], 'hip_l'],
  ankle_l: [[-0.035, 0.085, -0.092], 'knee_l']
};
const P = (name) => JOINTS[name][0];
const FWD = [1, 0, 0];
const UP = [0, 1, 0];

// Trunk -----------------------------------------------------------------------------------

/** The trousers' seat, waistband to crotch. */
function seatField() {
  const body = tube([-0.005, 0.76, 0], [-0.005, 1.035, 0], FWD, {
    front: [[0.03, 0.06], [0.07, 0.083], [0.12, 0.097], [0.19, 0.099], [0.275, 0.094]],
    back: [[0.03, 0.08], [0.07, 0.105], [0.11, 0.115], [0.16, 0.112], [0.22, 0.099], [0.275, 0.088]],
    lat: [[0.03, 0.15], [0.07, 0.168], [0.12, 0.175], [0.16, 0.172], [0.21, 0.162], [0.275, 0.15]],
    n: 2.3,
    round: 0.01
  });
  // The crotch: a bowl that lifts the underside towards the hips, front and back.
  const bowl = ellipsoid([-0.01, 1.0, 0], [0.2, 0.208, 0.215]);
  const seat = union(0.03, body, ...sym((s) => ellipsoid([-0.062, 0.872, 0.062 * s], [0.055, 0.064, 0.064])));
  return inter(0.035, seat, bowl);
}

const NECK_AXIS = [[-0.042, 1.4, 0], [-0.006, 1.6, 0]];
const neckColumn = () =>
  union(
    0.02,
    tube(...NECK_AXIS, FWD, { front: 0.053, back: 0.06, lat: 0.058, n: 2.1 }),
    cone([-0.03, 1.572, -0.045], [0.026, 1.445, -0.013], 0.012, 0.011),
    cone([-0.03, 1.572, 0.045], [0.026, 1.445, 0.013], 0.012, 0.011),
    ellipsoid([0.024, 1.515, 0], [0.01, 0.013, 0.01])
  );

/** The shirt over the trapezius, from the collar to the shoulder point (s = 1 right, -1 left). */
const shoulderLine = (s) => tube([-0.042, 1.448, 0.045 * s], [-0.025, 1.414, 0.168 * s], FWD, { front: 0.046, back: 0.052, lat: 0.034, round: 0.03 });
/** The shirt over the deltoid; the chest and the sleeve share it so the shoulder reads as one. */
const deltoid = (s) => ellipsoid([-0.015, 1.393, 0.186 * s], [0.052, 0.048, 0.049]);

/** The T-shirt body, hem to collar, including the shoulder line up to the sleeves. */
function shirtField() {
  const body = tube([0, 0.915, 0], [0, 1.48, 0], FWD, {
    du: [[0, -0.004], [0.3, 0], [0.45, -0.008], [0.565, -0.035]],
    front: [[0, 0.111], [0.085, 0.107], [0.17, 0.104], [0.25, 0.106], [0.33, 0.113], [0.39, 0.116], [0.44, 0.111], [0.49, 0.097], [0.53, 0.078], [0.565, 0.052]],
    back: [[0, 0.124], [0.06, 0.112], [0.12, 0.099], [0.2, 0.095], [0.3, 0.102], [0.38, 0.108], [0.45, 0.106], [0.5, 0.098], [0.54, 0.085], [0.565, 0.065]],
    lat: [[0, 0.181], [0.06, 0.175], [0.13, 0.165], [0.2, 0.16], [0.3, 0.163], [0.38, 0.168], [0.43, 0.169], [0.48, 0.158], [0.52, 0.132], [0.565, 0.085]],
    n: [[0, 2.4], [0.35, 2.6], [0.565, 2.2]],
    round: 0.006
  });
  const trap = shoulderLine;
  const blade = (s) => ellipsoid([-0.07, 1.34, 0.075 * s], [0.045, 0.07, 0.06]);
  const shirt = union(0.035, body, ...sym(trap), ...sym(blade), ...sym(deltoid));
  const hole = inter(0, cone(...NECK_AXIS, 0.066, 0.066), plane([0, 1.415, 0], [0, -1, 0]));
  return { shirt: cut(0.006, shirt, hole), solid: shirt };
}

function trunkShirtParts() {
  const { shirt, solid } = shirtField();
  const opts = { reach: 0.06, blend: 0.03, round: 0.03 };
  const J = P('chest');
  return {
    spine: [{ mat: 'top', field: split(shirt, J, UP, 'parent', opts), min: [-0.15, 0.9, -0.2], max: [0.14, 1.33, 0.2], h: 0.0065, tris: 2000 }],
    chest: [
      { mat: 'top', field: split(shirt, J, UP, 'child', opts), min: [-0.15, 1.17, -0.25], max: [0.15, 1.5, 0.25], h: 0.0065, tris: 2600 },
      // Ribbed crew neck where the shirt meets the neck.
      { mat: 'top', field: (x, y, z) => -sminK(-(Math.abs(cone(...NECK_AXIS, 0.0655, 0.0655)(x, y, z)) - 0.0055), -(Math.abs(solid(x, y, z)) - 0.006), 0.004),
        min: [-0.16, 1.38, -0.1], max: [0.08, 1.56, 0.1], h: 0.003, tris: 900 }
    ]
  };
}

function neckParts() {
  const field = union(0.02, split(neckColumn(), [-0.02, 1.55, 0], UP, 'parent', { reach: 0.05, blend: 0.03, round: 0.02 }), sphere(P('head'), 0.045));
  return [{ mat: 'skin', field, min: [-0.11, 1.38, -0.08], max: [0.06, 1.65, 0.08], h: 0.006, tris: 800 }];
}

// Head ------------------------------------------------------------------------------------

const CRANIUM = [[-0.012, 1.632, 0], [0.1, 0.09, 0.077]];
const sym = (f) => [f(1), f(-1)];

/** A smooth Gaussian bump of height h (negative for a hollow), for sculpting by displacement. */
const bump = ([cx, cy, cz], [rx, ry, rz], h) => (x, y, z) => h * Math.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2));
const displace = (f, ...bumps) => (x, y, z) => {
  let d = f(x, y, z);
  for (const b of bumps) d -= b(x, y, z);
  return d;
};

/** Hairline height around the head, by azimuth from the front (0) to the nape (pi). */
const hairline = curve([[0, 1.676], [0.45, 1.682], [0.75, 1.672], [1.05, 1.63], [1.25, 1.594], [1.4, 1.598], [1.55, 1.628], [1.85, 1.628], [2.15, 1.602], [2.5, 1.57], [3.15, 1.556]]);
const hairAt = (x, z) => hairline(Math.abs(Math.atan2(z, x + 0.012)));

/** Cranium and face masses before the features; the hair follows this. */
function skullField() {
  const face = tube([0, 1.488, 0], [0, 1.66, 0], FWD, {
    front: [[0, 0.07], [0.012, 0.083], [0.03, 0.084], [0.05, 0.087], [0.07, 0.087], [0.095, 0.083], [0.118, 0.077], [0.138, 0.085], [0.172, 0.08]],
    back: 0.05,
    lat: [[0, 0.022], [0.015, 0.036], [0.035, 0.05], [0.06, 0.057], [0.1, 0.065], [0.13, 0.066], [0.172, 0.064]],
    n: 2.3,
    round: 0.012
  });
  // Underside of the jaw, rising from the chin to the jaw angle.
  const jaw = plane([0.08, 1.488, 0], [-0.034, -0.09, 0]);
  return union(0.03, ellipsoid(...CRANIUM), inter(0.015, face, jaw));
}

function headField() {
  const skull = displace(
    skullField(),
    ...sym((s) => bump([0.08, 1.63, 0.03 * s], [0.03, 0.009, 0.022], 0.0045)),
    bump([0.085, 1.625, 0], [0.02, 0.01, 0.012], 0.002),
    ...sym((s) => bump([0.06, 1.592, 0.05 * s], [0.02, 0.014, 0.02], 0.004)),
    ...sym((s) => bump([0.03, 1.632, 0.068 * s], [0.025, 0.02, 0.015], -0.003)),
    ...sym((s) => bump([0.052, 1.556, 0.052 * s], [0.02, 0.018, 0.015], -0.003))
  );
  const neck = split(neckColumn(), [-0.02, 1.55, 0], UP, 'child', { reach: 0.06, blend: 0.03, round: 0.02 });
  const formed = union(0.012, skull, ellipsoid([0.075, 1.5, 0], [0.014, 0.015, 0.021]));
  const sockets = cut(0.008, formed, union(0, ...sym((s) => ellipsoid([0.08, 1.607, 0.032 * s], [0.013, 0.0115, 0.017]))));
  const eyes = sym((s) => union(0.002, sphere([0.0575, 1.607, 0.032 * s], 0.0125), ellipsoid([0.06, 1.612, 0.032 * s], [0.0125, 0.0075, 0.015])));
  const nose = union(
    0.006,
    cone([0.077, 1.612, 0], [0.101, 1.571, 0], 0.0062, 0.0085),
    sphere([0.099, 1.567, 0], 0.0102),
    ...sym((s) => ellipsoid([0.086, 1.561, 0.0125 * s], [0.0095, 0.0085, 0.0085])),
    ellipsoid([0.081, 1.566, 0], [0.016, 0.014, 0.012])
  );
  const lips = union(0.004, ellipsoid([0.083, 1.541, 0], [0.0085, 0.0072, 0.021]), ellipsoid([0.081, 1.527, 0], [0.009, 0.0062, 0.018]));
  const face = union(0.004, sockets, ...eyes, nose, lips);
  const mouth = cut(0.002, face, ellipsoid([0.09, 1.5345, 0], [0.01, 0.0012, 0.02]));
  const ear = (s) =>
    cut(
      0.004,
      ellipsoid([-0.02, 1.597, 0.072 * s], [0.017, 0.03, 0.009], [0.3 * s, 0, 0.22]),
      ellipsoid([-0.018, 1.597, 0.081 * s], [0.011, 0.02, 0.006], [0.3 * s, 0, 0.22])
    );
  return union(0.012, union(0.006, mouth, ear(1), ear(-1)), neck);
}

/** Short hair: a shell over the skull, thinning to almost nothing at the hairline. */
function hairField() {
  const skull = skullField();
  return (x, y, z) => {
    const above = y - hairAt(x, z);
    const thick = 0.0018 + 0.0062 * smooth01(above / 0.025) + 0.004 * smooth01((y - 1.665) / 0.04);
    return -sminK(-(skull(x, y, z) - thick), above + 0.0015, 0.003);
  };
}

function headParts() {
  // The scalp under the hair is never seen: cut it away to spend the triangles on the face.
  const visible = inter(0, headField(), (x, y, z) => y - hairAt(x, z) - 0.012);
  return [
    { mat: 'skin', field: visible, min: [-0.13, 1.47, -0.1], max: [0.13, 1.74, 0.1], h: 0.0032, tris: 4800 },
    { mat: 'hair', field: hairField(), min: [-0.13, 1.53, -0.1], max: [0.11, 1.75, 0.1], h: 0.0045, tris: 1300 }
  ];
}

// Arms (left; lateral is -z) ----------------------------------------------------------------

const ARM = {
  front: [[0, 0.048], [0.08, 0.05], [0.15, 0.05], [0.21, 0.046], [0.27, 0.039], [0.3, 0.038], [0.33, 0.042], [0.37, 0.046], [0.41, 0.043], [0.47, 0.033], [0.53, 0.029], [0.56, 0.028]],
  back: [[0, 0.05], [0.08, 0.053], [0.15, 0.05], [0.22, 0.045], [0.28, 0.04], [0.31, 0.04], [0.35, 0.042], [0.4, 0.039], [0.47, 0.031], [0.56, 0.027]],
  lat: [[0, 0.052], [0.08, 0.05], [0.15, 0.045], [0.22, 0.041], [0.3, 0.04], [0.35, 0.043], [0.41, 0.037], [0.48, 0.025], [0.56, 0.02]],
  med: [[0, 0.046], [0.1, 0.044], [0.2, 0.041], [0.3, 0.038], [0.35, 0.04], [0.41, 0.034], [0.48, 0.024], [0.56, 0.02]]
};

/** Shoulder to wrist as one lofted form; the elbow sits 3.4 cm behind the shoulder-wrist line. */
function armFrame() {
  const S = P('shoulder_l');
  const E = P('elbow_l');
  const W = P('wrist_l');
  const L = Math.hypot(W[0] - S[0], W[1] - S[1], W[2] - S[2]);
  const fr = limbFrame(S, W, FWD);
  const sE = (E[0] - S[0]) * fr.e.x + (E[1] - S[1]) * fr.e.y + (E[2] - S[2]) * fr.e.z;
  const uE = (E[0] - S[0]) * fr.f.x + (E[1] - S[1]) * fr.f.y + (E[2] - S[2]) * fr.f.z;
  const vE = (E[0] - S[0]) * fr.l.x + (E[1] - S[1]) * fr.l.y + (E[2] - S[2]) * fr.l.z;
  return { S, E, W, L, fr, du: [[0, 0], [sE, uE], [L, 0]], dv: [[0, 0], [sE, vE], [L, 0]] };
}

function handFrame() {
  const { E, W } = armFrame();
  const e = dir(E, W);
  const f = new THREE.Vector3(...FWD).addScaledVector(e, -e.x).normalize();
  const l = new THREE.Vector3().crossVectors(f, e);
  // Relaxed: tipped 0.1 rad towards the palm (medial).
  const down = e.clone().applyAxisAngle(f, 0.1);
  const ay = down.clone().negate();
  const az = new THREE.Vector3().crossVectors(f, ay).normalize();
  const ax = new THREE.Vector3().crossVectors(ay, az);
  return { W, e, down, ax, ay, az, l };
}

/**
 * The left hand in its own frame: origin at the wrist pivot, fingers along -y, thumb
 * towards +x and the palm facing +z. Relaxed, fingers together and gently curled.
 */
function handLocal() {
  const parts = [
    ellipsoid([0, -0.004, 0], [0.027, 0.022, 0.018]),
    roundBox([0.002, -0.058, -0.001], [0.04, 0.046, 0.0135], 0.012),
    ellipsoid([0.019, -0.043, 0.008], [0.017, 0.028, 0.013], [0, 0, -0.3]),
    ellipsoid([-0.025, -0.06, 0.006], [0.012, 0.032, 0.012])
  ];
  // Fingers: knuckle x, knuckle y, phalanx lengths, base radius.
  const fingers = [
    [0.026, -0.1, [0.04, 0.024, 0.02], 0.0095],
    [0.008, -0.103, [0.044, 0.027, 0.021], 0.0098],
    [-0.01, -0.1, [0.041, 0.026, 0.02], 0.0093],
    [-0.027, -0.094, [0.033, 0.02, 0.018], 0.0083]
  ];
  const curl = [0.22, 0.42, 0.3];
  const digits = [];
  for (const [kx, ky, lens, r0] of fingers) {
    let p = [kx * 0.98, ky, 0.0];
    let ang = 0;
    let r = r0;
    lens.forEach((len, i) => {
      ang += curl[i];
      const q = [p[0] - kx * 0.018 * (i + 1), p[1] - len * Math.cos(ang), p[2] + len * Math.sin(ang)];
      const r1 = r * (i === 2 ? 0.86 : 0.92);
      digits.push(cone(p, q, r, r1));
      p = q;
      r = r1;
    });
  }
  // Thumb: metacarpal, proximal and distal phalanges, resting beside the index finger.
  const t0 = [0.016, -0.022, 0.006];
  const t1 = [0.04, -0.056, 0.019];
  const t2 = [0.047, -0.084, 0.024];
  const t3 = [0.044, -0.104, 0.026];
  const thumb = [cone(t0, t1, 0.014, 0.0115), cone(t1, t2, 0.0115, 0.0105), cone(t2, t3, 0.0105, 0.0092)];
  return union(0.006, union(0.012, ...parts), union(0.0035, ...digits), ...thumb);
}

/** Bare skin from mid upper arm to the fingertips. */
function armSkinField() {
  const { S, E, L, fr, du, dv } = armFrame();
  const arm = tube(S, P('wrist_l'), FWD, { ...ARM, du, dv, to: L + 0.008, round: 0.012 });
  const ef = limbFrame(E, P('wrist_l'), FWD);
  const elbow = union(0.012, arm, ellipsoid(ef.at(0.004, -0.03, 0.002), [0.014, 0.018, 0.015]));
  const hf = handFrame();
  const hand = local(hf.W, hf.ax.toArray(), hf.ay.toArray(), hf.az.toArray(), handLocal());
  const centre = hf.W.map((c, i) => c + hf.down.getComponent(i) * 0.09);
  return union(0.016, elbow, bounded(hand, centre, 0.12));
}

function armParts() {
  const { S, E, W, fr, du, dv } = armFrame();
  const skin = armSkinField();
  const eElbow = bisect(dir(S, E), dir(E, W));
  const hf = handFrame();
  const eWrist = bisect(dir(E, W), hf.down);
  const elbowOpts = { reach: 0.045, blend: 0.02, round: 0.015 };
  const wristOpts = { reach: 0.03, blend: 0.016, sink: 0.0015, round: 0.01 };
  const grown = (keys, d) => keys.map(([s, r]) => [s, r + d + 0.004 * Math.min(s / 0.15, 1)]);
  const sleeve = union(
    0.035,
    inter(0.01, union(0.035, shoulderLine(-1), deltoid(-1)), plane([0, 0, -0.135], [0, 0, 1])),
    tube(S, W, FWD, { front: grown(ARM.front, 0.011), back: grown(ARM.back, 0.011), lat: grown(ARM.lat, 0.01), med: grown(ARM.med, 0.011), du, dv, to: 0.15, round: 0.004 })
  );
  const upper = inter(0, split(skin, E, eElbow, 'parent', elbowOpts), plane(fr.at(0.11), fr.e.clone().negate().toArray()));
  const fore = union(0, split(split(skin, E, eElbow, 'child', elbowOpts), W, eWrist, 'parent', wristOpts), sphere(E, 0.031));
  const hand = union(0, split(skin, W, eWrist, 'child', wristOpts), sphere(W, 0.017));
  return {
    shoulder_l: [
      { mat: 'top', field: sleeve, min: [-0.1, 1.22, -0.26], max: [0.08, 1.48, -0.1], h: 0.005, tris: 1000 },
      { mat: 'skin', field: upper, min: [-0.11, 1.04, -0.28], max: [0.06, 1.31, -0.14], h: 0.0055, tris: 800 }
    ],
    elbow_l: [{ mat: 'skin', field: fore, min: [-0.09, 0.8, -0.29], max: [0.07, 1.16, -0.16], h: 0.005, tris: 1100 }],
    wrist_l: [{ mat: 'skin', field: hand, min: [-0.06, 0.6, -0.3], max: [0.09, 0.9, -0.18], h: 0.003, tris: 2400 }]
  };
}

// Legs (left) ------------------------------------------------------------------------------

/** Trouser leg from the hip ball to the hem as one form; the knee sits 2 cm ahead of hip-ankle. */
function legField() {
  const H = P('hip_l');
  const K = P('knee_l');
  const A = P('ankle_l');
  const fr = limbFrame(H, A, FWD);
  const sK = (K[0] - H[0]) * fr.e.x + (K[1] - H[1]) * fr.e.y + (K[2] - H[2]) * fr.e.z;
  const uK = (K[0] - H[0]) * fr.f.x + (K[1] - H[1]) * fr.f.y + (K[2] - H[2]) * fr.f.z;
  const L = Math.hypot(A[0] - H[0], A[1] - H[1], A[2] - H[2]);
  const leg = tube(H, A, FWD, {
    du: [[0, 0], [sK, uK], [L, 0]],
    front: [[0, 0.084], [0.1, 0.083], [0.22, 0.075], [0.32, 0.066], [0.39, 0.062], [0.42, 0.061], [0.5, 0.057], [0.65, 0.055], [0.8, 0.056], [0.86, 0.057]],
    back: [[0, 0.084], [0.08, 0.088], [0.2, 0.08], [0.32, 0.066], [0.4, 0.06], [0.47, 0.063], [0.56, 0.063], [0.68, 0.058], [0.86, 0.059]],
    lat: [[0, 0.085], [0.1, 0.086], [0.22, 0.077], [0.32, 0.067], [0.4, 0.061], [0.55, 0.059], [0.86, 0.057]],
    med: [[0, 0.083], [0.1, 0.08], [0.22, 0.071], [0.32, 0.062], [0.4, 0.058], [0.55, 0.057], [0.86, 0.056]],
    to: 0.86
  });
  return { leg: union(0.01, leg, sphere(H, 0.084)), H, K, A, fr };
}

/**
 * The trousers as one form, split between the pelvis and each thigh along an oblique
 * plane from the crotch up over the hip (left plane: through J with normal n into the leg).
 */
function trouserParts() {
  const { leg, H, K, A, fr } = legField();
  const legR = (x, y, z) => leg(x, y, -z);
  const trousers = union(0.02, seatField(), leg, legR);
  const J = [0, 0.795, -0.005];
  const n = new THREE.Vector3(0.25, -0.74, -0.62).normalize().toArray();
  const hipOpts = { reach: 0.018, blend: 0.016, sink: 0.0025, round: 0.012 };
  const pelvis = split(split(trousers, J, n, 'parent', hipOpts), [J[0], J[1], -J[2]], [n[0], n[1], -n[2]], 'parent', hipOpts);
  const eKnee = bisect(dir(H, K), dir(K, A));
  const kneeOpts = { reach: 0.06, blend: 0.025, sink: 0.0025, round: 0.02 };
  // Hem: higher at the front, where it rests on the shoe.
  const hem = (x, y, z) => {
    const px = x - H[0];
    const py = y - H[1];
    const pz = z - H[2];
    const s = px * fr.e.x + py * fr.e.y + pz * fr.e.z;
    const u = px * fr.f.x + py * fr.f.y + pz * fr.f.z;
    return s - (0.815 - 0.45 * u);
  };
  const thigh = union(0, inter(0, split(split(trousers, J, n, 'child', hipOpts), K, eKnee, 'parent', kneeOpts), (x, y, z) => z - 0.001), sphere(H, 0.08));
  const shin = union(0, inter(0.004, split(leg, K, eKnee, 'child', kneeOpts), hem), sphere(K, 0.05));
  return {
    pelvis: [{ mat: 'bottom', field: pelvis, min: [-0.16, 0.74, -0.2], max: [0.13, 1.06, 0.2], h: 0.0075, tris: 1800 }],
    hip_l: [{ mat: 'bottom', field: thigh, min: [-0.11, 0.4, -0.2], max: [0.11, 1.0, 0.01], h: 0.0075, tris: 1800 }],
    knee_l: [{ mat: 'bottom', field: shin, min: [-0.1, 0.02, -0.17], max: [0.1, 0.57, -0.01], h: 0.0075, tris: 1400 }]
  };
}

/** The left shoe in a foot frame: origin at the ankle pivot, x forward, y up, z medial. */
function shoeLocal() {
  const base = -0.065;
  const upper = tube([-0.072, base, 0], [0.214, base, 0], UP, {
    front: [[0, 0.05], [0.03, 0.066], [0.07, 0.072], [0.11, 0.064], [0.15, 0.05], [0.19, 0.038], [0.23, 0.03], [0.26, 0.025], [0.286, 0.016]],
    back: 0.012,
    lat: [[0, 0.028], [0.03, 0.035], [0.08, 0.036], [0.13, 0.041], [0.19, 0.047], [0.24, 0.044], [0.27, 0.034], [0.286, 0.02]],
    med: [[0, 0.028], [0.03, 0.034], [0.08, 0.032], [0.13, 0.037], [0.19, 0.045], [0.24, 0.044], [0.27, 0.036], [0.286, 0.022]],
    du: [[0, 0], [0.2, 0], [0.286, 0.01]],
    dv: [[0, 0], [0.2, 0], [0.286, -0.008]],
    n: [[0, 2], [0.15, 2.2], [0.286, 2]],
    round: 0.02
  });
  const sole = tube([-0.075, -0.074, 0], [0.217, -0.074, 0], UP, {
    front: [[0, 0.011], [0.08, 0.01], [0.15, 0.007], [0.292, 0.006]],
    back: [[0, 0.011], [0.08, 0.01], [0.15, 0.006], [0.292, 0.005]],
    lat: [[0, 0.033], [0.03, 0.039], [0.08, 0.04], [0.13, 0.045], [0.19, 0.051], [0.24, 0.048], [0.27, 0.038], [0.292, 0.024]],
    med: [[0, 0.033], [0.03, 0.038], [0.08, 0.033], [0.13, 0.038], [0.19, 0.049], [0.24, 0.048], [0.27, 0.04], [0.292, 0.026]],
    du: [[0, 0], [0.08, -0.002], [0.2, -0.004], [0.292, 0.008]],
    dv: [[0, 0], [0.2, 0], [0.292, -0.008]],
    n: 3,
    round: 0.006
  });
  const ankle = tube([-0.012, -0.05, 0], [-0.004, 0.12, 0], FWD, { front: 0.033, back: 0.037, lat: 0.033, med: 0.031 });
  const tongue = ellipsoid([0.06, -0.008, 0], [0.052, 0.01, 0.024], [0, 0, -0.62]);
  const laces = (x, y, z) => {
    const band = Math.abs(z) - 0.016;
    const along = x * Math.cos(0.62) - (y + 0.008) * Math.sin(0.62);
    const rows = Math.abs(((along + 0.2) % 0.016) - 0.008) - 0.0035;
    return Math.max(tongue(x, y, z) - 0.0025, band, rows, Math.abs(along - 0.06) - 0.04);
  };
  return union(0.005, union(0.012, upper, ankle, tongue, laces), sole);
}

function footParts() {
  const A = P('ankle_l');
  const yaw = 0.09;
  const ax = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const az = [Math.sin(yaw), 0, Math.cos(yaw)];
  const field = local(A, ax, UP, az, shoeLocal());
  return [{ mat: 'shoes', field, min: [-0.12, -0.005, -0.18], max: [0.2, 0.22, -0.01], h: 0.0038, tris: 1800 }];
}

function parts() {
  const trunk = trunkShirtParts();
  return {
    spine: trunk.spine,
    chest: trunk.chest,
    neck: neckParts(),
    head: headParts(),
    ...armParts(),
    ...trouserParts(),
    ankle_l: footParts()
  };
}

function materials() {
  const physical = (name, opts) => new THREE.MeshPhysicalMaterial({ name, ...opts });
  return {
    skin: physical('skin', { color: 0xb9b2a8, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.35, sheen: 1, sheenColor: 0x3a3632, sheenRoughness: 0.5 }),
    top: physical('top', { color: 0x5d6b7a, roughness: 0.88, sheen: 1, sheenColor: 0x4b5562, sheenRoughness: 0.8 }),
    bottom: physical('bottom', { color: 0x2f3540, roughness: 0.84, sheen: 1, sheenColor: 0x3a404c, sheenRoughness: 0.75 }),
    shoes: physical('shoes', { color: 0x1b1b1d, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.3 }),
    hair: physical('hair', { color: 0x1d1a17, roughness: 0.62, sheen: 1, sheenColor: 0x4a4036, sheenRoughness: 0.4 })
  };
}

/**
 * Builds the mannequin as nested joint groups named after JOINTS (with _l / _r sides),
 * each holding one mesh per material, named `${joint}_${material}`.
 */
export function buildPerson({ log = false } = {}) {
  const mats = materials();
  const root = new THREE.Group();
  root.name = 'person';
  const groups = {};
  const leftOf = (n) => n.replace(/_r$/, '_l');
  const pivot = (n) => (n.endsWith('_r') ? [P(leftOf(n))[0], P(leftOf(n))[1], -P(leftOf(n))[2]] : P(n));
  const parentOf = (n) => {
    const p = JOINTS[leftOf(n)][1];
    return p && n.endsWith('_r') ? p.replace(/_l$/, '_r') : p;
  };
  const names = Object.keys(JOINTS).flatMap((n) => (n.endsWith('_l') ? [n, n.replace(/_l$/, '_r')] : [n]));
  for (const n of names) {
    const g = new THREE.Group();
    g.name = n;
    const p = pivot(n);
    const par = parentOf(n);
    const pp = par ? pivot(par) : [0, 0, 0];
    g.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]);
    groups[n] = g;
    (par ? groups[par] : root).add(g);
  }
  for (const [joint, list] of Object.entries(parts())) {
    const byMat = new Map();
    for (const part of list) {
      const t = Date.now();
      const raw = polygonize(part.field, part.min, part.max, part.h, `${joint}_${part.mat}`);
      const lod = simplify(raw.pos, raw.idx, part.tris);
      const geo = finish(part.field, lod.pos, lod.idx, part.h);
      if (log) console.log(`${joint}_${part.mat}: ${raw.idx.length / 3} -> ${geo.index.count / 3} triangles, ${Date.now() - t} ms`);
      if (!byMat.has(part.mat)) byMat.set(part.mat, []);
      byMat.get(part.mat).push(geo);
    }
    for (const [mat, geos] of byMat) {
      const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos);
      const sides = joint.endsWith('_l') ? [[joint, geo], [joint.replace(/_l$/, '_r'), mirror(geo)]] : [[joint, geo]];
      for (const [name, g] of sides) {
        const p = pivot(name);
        g.translate(-p[0], -p[1], -p[2]);
        const mesh = new THREE.Mesh(g, mats[mat]);
        mesh.name = `${name}_${mat}`;
        groups[name].add(mesh);
      }
    }
  }
  return root;
}
