// Builds the posable mannequin and writes it to assets/3d/crime-scenes/library/person.glb.
// Run from frontend/: node scripts/crime-scene-models/build-person.mjs
//
// Joint groups (pelvis, spine, chest, neck, head, shoulder_*, elbow_*, wrist_*, hip_*,
// knee_*, ankle_*) are posed with the rotations in src/features/crime-scene/case-scene/poses.ts.
// Materials "top", "bottom" and "shoes" take the clothing colours from the case record.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { buildPerson } from './person.mjs';

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

async function write(root, file) {
  const glb = await new GLTFExporter().parseAsync(root, { binary: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, file), Buffer.from(glb));
  let triangles = 0;
  root.traverse((o) => {
    if (o.isMesh) triangles += o.geometry.index.count / 3;
  });
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).toArray();
  console.log(`${file}: ${(glb.byteLength / 1024).toFixed(0)} KB, ${triangles} triangles, ${size.map((v) => v.toFixed(2)).join(' x ')} m`);
}

await write(buildPerson(), 'person.glb');
