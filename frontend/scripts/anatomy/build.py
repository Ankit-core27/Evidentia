"""Build the attributed BodyParts3D subset; no runtime Python dependency.

Requires numpy==2.5.4, fast-simplification==0.2.0. Run with an optional source
cache directory argument. Verified source hashes are in source-parts.json.
"""
import hashlib
import json
import struct
import sys
from pathlib import Path
from urllib.request import urlopen

import fast_simplification
import numpy as np

REPO = Path(__file__).resolve().parents[3]
DEST = REPO / "assets/3d/anatomy"
CACHE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/evidentia-anatomy-source")
COMMIT = "f0eeb6e843380cfe6b83797cf8c3e1af74de5e61"
SOURCE = f"https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/{COMMIT}/assets/BodyParts3D_data/stl/"
GROUPS = json.loads(Path(__file__).with_name("source-parts.json").read_text())
DTYPE = np.dtype([("normal", "<f4", (3,)), ("vertices", "<f4", (3, 3)), ("attribute", "<u2")])


def read_source(source):
    path = CACHE / (source["name"] + ".stl")
    if not path.exists():
        with urlopen(SOURCE + path.name, timeout=60) as response:
            path.write_bytes(response.read())
    data = path.read_bytes()
    assert hashlib.sha256(data).hexdigest() == source["sha256"], f"Source checksum mismatch: {path.name}"
    count = struct.unpack_from("<I", data, 80)[0]
    assert len(data) == 84 + count * 50
    return np.frombuffer(data, dtype=DTYPE, offset=84, count=count)["vertices"].reshape(-1, 3).copy()


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    DEST.mkdir(parents=True, exist_ok=True)
    skin = read_source(GROUPS[0]["sources"][0])
    # BodyParts3D: millimetres, +X left, +Y posterior, +Z superior.
    # Convert by a proper rotation to metres, +Y up, +Z anterior, then center.
    def axes(vertices):
        return vertices[:, [0, 2, 1]] * np.array([0.001, 0.001, -0.001])
    skin = axes(skin)
    center = (skin.min(axis=0) + skin.max(axis=0)) / 2
    gltf = {"asset": {"version": "2.0", "generator": "Evidentia BodyParts3D converter",
             "copyright": "BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan"},
            "scene": 0, "scenes": [{"nodes": []}], "nodes": [], "meshes": [], "materials": [],
            "buffers": [], "bufferViews": [], "accessors": []}
    binary = bytearray()
    structures = []
    def accessor(array, kind, component, bounds=False):
        binary.extend(b"\0" * (-len(binary) % 4))
        view = len(gltf["bufferViews"])
        gltf["bufferViews"].append({"buffer": 0, "byteOffset": len(binary), "byteLength": array.nbytes})
        binary.extend(array.tobytes())
        value = {"bufferView": view, "componentType": component, "count": len(array), "type": kind}
        if bounds:
            value.update(min=array.min(axis=0).tolist(), max=array.max(axis=0).tolist())
        gltf["accessors"].append(value)
        return len(gltf["accessors"]) - 1
    for g in GROUPS:
        raw = [(s, axes(read_source(s)) - center) for s in g["sources"]]
        lower = np.min([v.min(axis=0) for _, v in raw], axis=0)
        upper = np.max([v.max(axis=0) for _, v in raw], axis=0)
        origin = (lower + upper) / 2
        group = {"name": g["id"], "translation": origin.tolist(), "children": []}
        group_index = len(gltf["nodes"])
        gltf["nodes"].append(group)
        gltf["scenes"][0]["nodes"].append(group_index)
        rgb = [int(g["color"][i:i+2], 16) / 255 for i in (1, 3, 5)]
        # CSS colors are sRGB; glTF factors are linear.
        rgb = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055)**2.4 for c in rgb]
        material = len(gltf["materials"])
        gltf["materials"].append({"name": g["id"], "doubleSided": True,
            "pbrMetallicRoughness": {"baseColorFactor": rgb+[1], "metallicFactor": 0, "roughnessFactor": 0.72}})
        total = sum(len(v)//3 for _, v in raw)
        budget = {"skin": 40000, "brain": 26000, "heart": 16000, "lung_right": 10000, "lung_left": 10000}.get(g["id"], 6000)
        triangles = 0
        for source, vertices in raw:
            points, indices = np.unique(vertices, axis=0, return_inverse=True)
            faces = indices.reshape(-1, 3).astype(np.int32)
            target = max(100, round(budget * len(faces) / total))
            if len(faces) > target:
                points, faces = fast_simplification.simplify(points, faces, target_count=target, agg=5)
            points = (points - origin).astype("<f4")
            faces = faces.astype("<u4")
            normals = np.zeros_like(points)
            v = points[faces]
            face_normals = np.cross(v[:, 1]-v[:, 0], v[:, 2]-v[:, 0])
            for i in range(3):
                np.add.at(normals, faces[:, i], face_normals)
            normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-12)
            mesh = len(gltf["meshes"])
            gltf["meshes"].append({"name": source["name"], "primitives": [{
                "attributes": {"POSITION": accessor(points, "VEC3", 5126, True), "NORMAL": accessor(normals, "VEC3", 5126)},
                "indices": accessor(faces.reshape(-1), "SCALAR", 5125), "material": material}]})
            group["children"].append(len(gltf["nodes"]))
            gltf["nodes"].append({"name": source["name"], "mesh": mesh})
            triangles += len(faces)
        structures.append({k: g[k] for k in ("id", "label", "system", "fma", "color")} | {
            "meshNames": [s["name"] for s in g["sources"]], "originalPosition": origin.tolist(),
            "size": (upper-lower).tolist(), "triangles": triangles})
        print(g["id"], triangles, "triangles", flush=True)
    binary.extend(b"\0" * (-len(binary) % 4))
    gltf["buffers"] = [{"byteLength": len(binary)}]
    header = json.dumps(gltf, separators=(",", ":")).encode()
    header += b" " * (-len(header) % 4)
    data = struct.pack("<4sII", b"glTF", 2, 28+len(header)+len(binary))
    data += struct.pack("<I4s", len(header), b"JSON") + header
    data += struct.pack("<I4s", len(binary), b"BIN\0") + binary
    (DEST / "bodyparts3d.glb").write_bytes(data)
    manifest = {"modelId": "bodyparts3d-3.0-forensix-v1", "url": "/3d/anatomy/bodyparts3d.glb",
        "sourceCommit": COMMIT, "sha256": hashlib.sha256(data).hexdigest(),
        "license": "CC BY-SA 2.1 Japan", "structures": structures}
    (DEST / "manifest.json").write_text(json.dumps(manifest, indent=2)+"\n")
    print("GLB bytes:", len(data))


if __name__ == "__main__":
    main()
