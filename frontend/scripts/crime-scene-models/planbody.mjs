// Boxy bodies (the bus, the truck cab) built as a stack of horizontal plan sections: straight sides
// joined to the front and rear by superellipse ends. Skinning the stack with skin() lets the bands of
// a livery, the glazing and the wheel-arch and door openings be cut straight into the surface.
import * as THREE from 'three';
import { patch, smooth } from './geometry.mjs';

/**
 * plan(y) gives the half-width w and the front and rear extremes xF and xR at height y; front and
 * rear give each end's depth D (from the extreme to where the end meets the side) and exponent p.
 */
export function planBody({ plan, front, rear }) {
  /**
   * A point on the front (end 1) or rear (end -1) at height y: s runs from 1 at the right-hand side
   * through 0 on the centre line to -1 at the left; |s| > 1 carries on along the side, 1 m per unit.
   */
  function endPoint(y, s, end) {
    const p = plan(y);
    const a = Math.abs(s);
    const { D, p: pw } = end > 0 ? front : rear;
    if (a > 1) {
      const x = end > 0 ? p.xF - D - (a - 1) : p.xR + D + (a - 1);
      return new THREE.Vector3(x, y, Math.sign(s) * p.w);
    }
    const th = (a * Math.PI) / 2;
    const c = Math.pow(Math.max(Math.cos(th), 0), 2 / pw);
    const sn = Math.pow(Math.sin(th), 2 / pw);
    const x = end > 0 ? p.xF - D + D * c : p.xR + D - D * c;
    return new THREE.Vector3(x, y, Math.sign(s) * p.w * sn);
  }

  /** Outward horizontal normal of an end at (y, s). */
  function endNormal(y, s, end) {
    const e = 1e-3;
    const t = endPoint(y, s + e, end).sub(endPoint(y, s - e, end)).normalize();
    const n = new THREE.Vector3(t.z, 0, -t.x);
    return end > 0 ? n : n.negate();
  }

  /** The s at which an end reaches z at height y (|z| below the half-width). */
  function endS(y, z, end) {
    const pw = (end > 0 ? front : rear).p;
    const sn = Math.pow(Math.min(Math.abs(z) / plan(y).w, 1), pw / 2);
    return (Math.sign(z) * Math.asin(sn) * 2) / Math.PI;
  }

  /**
   * A patch on an end, s from s0 to s1 and y from y0 to y1, raised by bulge(u, v) along the end's
   * normal. Raised patches are kept within the body's width so nothing stands proud of the sides.
   */
  function endPatch(end, s0, s1, y0, y1, { bulge = null, ...opts } = {}) {
    // u must run towards -z on the front and towards +z on the rear for the patch to face out.
    const [a, b] = (end > 0) === s0 > s1 ? [s0, s1] : [s1, s0];
    return patch((u, v) => {
      const y = y0 + (y1 - y0) * v;
      const s = a + (b - a) * u;
      const pnt = endPoint(y, s, end);
      if (bulge) {
        pnt.addScaledVector(endNormal(y, s, end), bulge(u, v));
        pnt.z = Math.sign(pnt.z) * Math.min(Math.abs(pnt.z), plan(y).w + 0.004 + 0.002 * v);
      }
      return pnt;
    }, opts);
  }

  /**
   * The closed section at height y: the front end in nF steps, the given side points (right side,
   * front to rear), the rear end in nR steps, then the left side mirrored. Runs clockwise seen from
   * above, as skin() needs. desc[i] describes the segment from point i: { kind: 'front' | 'rear', k }
   * counting k from the centre line, or { kind: 'side', region } with regions[j] naming the side
   * segment that ends at side point j (the last one runs on to the rear end); side is 1 or -1.
   */
  function ring(y, nF, nR, sideXs, regions) {
    const half = [];
    const desc = [];
    for (let k = 0; k <= nF; k += 1) {
      half.push(endPoint(y, k / nF, 1));
      if (k < nF) desc.push({ kind: 'front', k });
    }
    const p = plan(y);
    const xa = p.xF - front.D;
    const xb = p.xR + rear.D;
    let prev = xa;
    sideXs.forEach((x, k) => {
      prev = Math.max(Math.min(x, prev - 1e-3), xb + (sideXs.length - k) * 1e-3);
      half.push(new THREE.Vector3(prev, y, p.w));
    });
    regions.forEach((region) => desc.push({ kind: 'side', region }));
    for (let k = nR; k >= 0; k -= 1) {
      half.push(endPoint(y, k / nR, -1));
      if (k > 0) desc.push({ kind: 'rear', k: k - 1 });
    }
    const H = half.length;
    const pts = half.slice();
    const d = desc.map((x) => ({ ...x, side: 1 }));
    d.push({ ...desc[H - 2], side: -1 });
    for (let k = H - 2; k >= 1; k -= 1) {
      pts.push(new THREE.Vector3(half[k].x, half[k].y, -half[k].z));
      d.push({ ...desc[k - 1], side: -1 });
    }
    return { pts, desc: d };
  }

  return { endPoint, endNormal, endS, endPatch, ring };
}

/** Inset of a plan at height y as a roof edge of radius r rounds over to the roof at yTop. */
export function roofInset(y, yTop, r) {
  const y0 = yTop - r;
  if (y <= y0) return 0;
  const d = Math.min(y - y0, r);
  return r - Math.sqrt(r * r - d * d);
}

/** A bulge profile for endPatch: a flat-faced moulding of thickness t with rounded top and bottom edges, fading out at its ends. */
export const moulding = (t, edge = 0.25, ends = 0.06) => (u, v) =>
  t * smooth(v / edge) * smooth((1 - v) / edge) * smooth(u / ends) * smooth((1 - u) / ends);

export const inBand = (y, band) => y >= band[0] - 1e-6 && y < band[1] - 1e-6;
