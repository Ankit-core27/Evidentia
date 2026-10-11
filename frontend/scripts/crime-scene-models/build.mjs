// Builds the crime-scene vehicle models and writes them as GLB files to
// assets/3d/crime-scenes/library/. Run from frontend/: npm run build:3d-models
//
// Each model faces +x with its origin on the ground at the centre of its footprint, in
// metres. Materials are named so the viewer can restyle them: "paint" takes the case
// record's colour, "headlight", "taillight" and "indicator" light up at night, and
// "plate_front" / "plate_rear" get the registration from the case record.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildAce } from './ace.mjs';
import { mirrorZ } from './geometry.mjs';
import { buildHatchback } from './hatchback.mjs';

// GLTFExporter reads its binary output through FileReader, which Node lacks.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
};

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../assets/3d/crime-scenes/library');

function materials(paint, plate) {
  const physical = (name, opts) => new THREE.MeshPhysicalMaterial({ name, ...opts });
  const standard = (name, opts) => new THREE.MeshStandardMaterial({ name, ...opts });
  return {
    paint: physical('paint', { color: paint, metalness: 0.05, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.05 }),
    glass: physical('glass', { color: 0x0d1114, metalness: 0.1, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 }),
    trim: standard('trim', { color: 0x16171a, roughness: 0.62, side: THREE.DoubleSide }),
    trim_gloss: physical('trim_gloss', { color: 0x0b0c0e, roughness: 0.25, clearcoat: 0.6 }),
    chrome: standard('chrome', { color: 0xe6e8ea, metalness: 1, roughness: 0.12 }),
    alu: standard('alu', { color: 0xb8bcc0, metalness: 0.85, roughness: 0.38 }),
    tyre: standard('tyre', { color: 0x141414, roughness: 0.9 }),
    rim: standard('rim', { color: 0xc4c7cb, metalness: 0.95, roughness: 0.26 }),
    rim_inner: standard('rim_inner', { color: 0x5b5f63, metalness: 0.8, roughness: 0.45, side: THREE.DoubleSide }),
    brake: standard('brake', { color: 0x4a4c4f, metalness: 0.7, roughness: 0.5 }),
    under: standard('under', { color: 0x0c0c0d, roughness: 0.92 }),
    seam: standard('seam', { color: 0x050505, roughness: 0.9 }),
    headlight: physical('headlight', { color: 0x4f5961, metalness: 0.75, roughness: 0.08, clearcoat: 1, emissive: 0xfff6e0, emissiveIntensity: 0 }),
    taillight: physical('taillight', { color: 0x8a0f12, roughness: 0.12, clearcoat: 1, emissive: 0xff2018, emissiveIntensity: 0 }),
    indicator: physical('indicator', { color: 0xc9790e, roughness: 0.12, clearcoat: 1, emissive: 0xff9a1a, emissiveIntensity: 0 }),
    plate_front: standard('plate_front', { color: plate, roughness: 0.45 }),
    plate_rear: standard('plate_rear', { color: plate, roughness: 0.45 })
  };
}

/** Collects parts by material, then merges each material into one mesh. */
class Assembly {
  constructor(name) {
    this.name = name;
    this.parts = new Map();
    this.nodes = [];
  }

  add(material, geometry) {
    const g = geometry.clone();
    for (const key of Object.keys(g.attributes)) if (key !== 'position' && key !== 'normal') g.deleteAttribute(key);
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    const indexed = g.index ? g : mergeVertices(g);
    if (!this.parts.has(material)) this.parts.set(material, []);
    this.parts.get(material).push(indexed);
  }

  addMirrored(material, geometry) {
    this.add(material, geometry);
    this.add(material, mirrorZ(geometry));
  }

  /** A 500 x 120 mm registration plate facing forward (sign 1) or back (-1). */
  plate(material, x, y, sign) {
    const g = new THREE.PlaneGeometry(0.5, 0.12);
    g.rotateY(sign > 0 ? Math.PI / 2 : -Math.PI / 2);
    g.translate(x, y, 0);
    this.nodes.push({ name: material, material, geometry: g });
  }

  /** A wheel on an axle along z; parts maps material to geometry built with its outer face at +z. */
  wheel(name, parts, x, y, z, side) {
    this.nodes.push({ name, wheel: parts, position: [x, y, z], flip: side < 0 });
  }

  build(mats) {
    const root = new THREE.Group();
    root.name = this.name;
    for (const [m, geometries] of this.parts) {
      const mesh = new THREE.Mesh(mergeGeometries(geometries), mats[m]);
      mesh.name = m;
      root.add(mesh);
    }
    for (const node of this.nodes) {
      if (node.wheel) {
        const group = new THREE.Group();
        group.name = node.name;
        for (const [m, g] of Object.entries(node.wheel)) {
          const mesh = new THREE.Mesh(g, mats[m]);
          mesh.name = `${node.name}_${m}`;
          group.add(mesh);
        }
        if (node.flip) group.rotation.y = Math.PI;
        group.position.set(...node.position);
        root.add(group);
      } else {
        const mesh = new THREE.Mesh(node.geometry, mats[node.material]);
        mesh.name = node.name;
        root.add(mesh);
      }
    }
    return root;
  }
}

async function write(root, file) {
  const glb = await new GLTFExporter().parseAsync(root, { binary: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, file), Buffer.from(glb));
  let triangles = 0;
  root.traverse((o) => {
    if (o.isMesh) triangles += (o.geometry.index ? o.geometry.index.count : o.geometry.getAttribute('position').count) / 3;
  });
  console.log(`${file}: ${(glb.byteLength / 1024).toFixed(0)} KB, ${Math.round(triangles)} triangles`);
}

const hatchback = new Assembly('hatchback');
buildHatchback(hatchback);
await write(hatchback.build(materials(0xf1f2ef, 0xf4f4f0)), 'hatchback.glb');

const van = new Assembly('delivery-van');
buildAce(van);
await write(van.build(materials(0x1f4f9a, 0xf2c200)), 'delivery-van.glb');
