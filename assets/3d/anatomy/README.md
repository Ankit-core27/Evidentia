# BodyParts3D reference anatomy for Forensix

**BodyParts3D, © The Database Center for Life Science, licensed under Creative Commons Attribution–ShareAlike 2.1 Japan (CC BY-SA 2.1 JP).**

The optimized `bodyparts3d.glb` is a derivative of BodyParts3D version 3.0 (20110915). This derivative geometry is distributed under the same [CC BY-SA 2.1 Japan license](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en) ([legal code](https://creativecommons.org/licenses/by-sa/2.1/jp/legalcode)). Keep this attribution, license link and change notice with redistributed geometry and renderings. `LICENSE.txt` preserves the source mirror's license notice. This asset license does not replace the application's software license.

## Source and changes

- Original project: [BodyParts3D / Anatomography](https://lifesciencedb.jp/bp3d/).
- Source mirror: [Kevin-Mattheus-Moerman/BodyParts3D](https://github.com/Kevin-Mattheus-Moerman/BodyParts3D), fixed commit `f0eeb6e843380cfe6b83797cf8c3e1af74de5e61`.
- Input: individually segmented STL files under `assets/BodyParts3D_data/stl/`, converted from original OBJ geometry by that mirror. Original labels and composite membership come from its `parts_list_e.txt` and `composite_parts.txt`.
- Forensix changes: selected 120 source parts; assembled 18 named structures; simplified triangle meshes; recalculated smooth normals; assigned display colors; exported glTF 2.0 binary. No primitive proxy organs were substituted.
- Axes: original millimetres, X left / Y posterior / Z superior, transformed to metres, X left / Y superior / Z anterior. The skin bounding-box center defines the body origin. Each structure has a centered local coordinate system and a retained original translation.
- Provenance and source SHA-256 hashes: `frontend/scripts/anatomy/source-parts.json` in the repository. Runtime IDs, FMA identifiers, source mesh names, original bounds, triangle counts and output SHA-256: `manifest.json` beside this file.
- Output: about 4.4 MB; 18 independently selectable structures, comprising skin, brain, heart, paired lungs, liver, stomach, spleen, pancreas, paired kidneys, small/large intestine, paired clavicles, paired humeri and frontal bone.

## Scope and limitations

This is a simplified adult male reference model, not a scan or measured reconstruction of a case subject. It has incomplete anatomical coverage and internal component boundaries can remain visible on close inspection. Display colors, separation offsets and investigator marker positions are illustrative. Do not infer patient anatomy, diagnoses, injury severity or cause of death from the geometry.

The forehead and upper-arm soft-tissue regions are not independently segmented here. A forehead laceration is not mapped to the frontal bone, and an upper-arm bruise is not mapped to the humerus. Those findings remain in the regional/unresolved panel unless a supported structure is explicitly documented. Organ-only badges have no measured surface coordinate.

## Rebuild

Normal application startup uses the checked-in GLB; no model download or Python asset tools are needed. To reproduce it from the repository root, in a separate tools environment:

```bash
python -m venv /tmp/forensix-anatomy-tools
/tmp/forensix-anatomy-tools/bin/pip install numpy==2.5.4 fast-simplification==0.2.0
/tmp/forensix-anatomy-tools/bin/python frontend/scripts/anatomy/build.py /tmp/forensix-anatomy-source
```

The converter downloads only pinned source files, checks each hash, and writes the GLB and manifest. Source downloads total approximately 203 MB and are not included in the application. Serve this directory through the application's existing assets configuration at `/3d/anatomy/`.
