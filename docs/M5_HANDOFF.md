# M5 handoff for Claude

## Continue this branch

Repository: https://github.com/AyushSharma113/Hackinverse-1.0

Branch: `m5/anatomy-examination`. Read `AGENTS.md` before continuing. Do not work on `main` or the separately active backend-foundation branch.

All implementation is committed. The latest `origin/main` (`d9e90c8`, dashboard heatmap PR #41) was merged as `9f41d38`, preserving those changes without conflicts. Feature commits:

- `92db335`: licensed segmented BodyParts3D geometry and converter.
- `1946229`: medical analysis, migration, findings, review, reports and tests.
- `9bd4582`: 3D viewer, case integration, mock support, browser tests and docs.

**Publishing is blocked:** `git push -u origin m5/anatomy-examination` returns GitHub 403, “Permission to AyushSharma113/Hackinverse-1.0.git denied to ishaanseal.” The user confirmed the repository URL above. The connected credentials need repository write permission. No branch was uploaded and no PR was created. GitHub CLI API requests also returned Forbidden. Do not mistake these local commits for a published branch.

## What is implemented

The goal is to replace the existing SVG injury view with a functional, report-driven 3D examination inside `/cases/:caseId/autopsy`, preserving the case platform and existing injury meaning.

- `frontend/src/features/anatomy/AnatomicalViewer.tsx`: R3F/Drei viewer; progressive skin exposure, organized exploded organs, continued camera zoom, rotate/pan/front/back, real-bounds organ focus, ghosting, return and exact reassembly. One canvas survives organ selections.
- `AnatomyModule.tsx` and `anatomyEngine.ts`: person/report/review/system filters, selectable structures, explicit unassigned/unresolved findings, source-backed inspector, honest normal/uncertain/not-documented states, persisted investigator marker placement in structure-local coordinates.
- `assets/3d/anatomy/`: 4.4 MB GLB; 18 structures from 120 actual segmented BodyParts3D source meshes. CC BY-SA 2.1 Japan attribution and limitations are in README/LICENSE and the UI. Converter and pinned source hashes live in `frontend/scripts/anatomy/`.
- `backend/app/services/ai/anatomy.py`: deliberate analysis action reusing existing Gemini helpers and extracted/indexed evidence. Strict Pydantic proposals, patient and case checks, matching source passages and measurements, no invented severity/death/coordinates, pending review, retained raw run, repeat-analysis deduplication preserving review decisions.
- Migration `0002`: adds `injuries.medical_details` JSON and a small `anatomy_findings` table. Trauma remains `Injury`; non-traumatic pathology, normal and uncertain observations use the new table. Missing severity uses `unknown`.
- Existing record/evidence registry, review counts, AI review screen, auditing, and mock endpoints recognize anatomical findings. Confirmed findings enter existing medical/court report snapshots with source IDs.
- Existing `SourcePassages` and evidence-inspector URL navigation are reused. A narrow inspector fix prevents a modern browser's `scrollIntoView()` Promise from becoming a React effect cleanup value.
- The original accident seed remains intact: Rohan is injured, not deceased. Right-clavicle injury maps; forehead cut and upper-arm bruise remain unresolved soft-tissue findings, not bone injuries.

Read `docs/M5_ANATOMY.md` for architecture, exact run/test commands and limitations. Read `assets/3d/anatomy/README.md` before modifying or redistributing geometry.

## Checks actually executed

Before the final dashboard-main merge:

- Full backend suite: **280 passed**, including **31 anatomy tests** and an actual Alembic upgrade/downgrade/upgrade preserving old injuries.
- Frontend OpenAPI generation, TypeScript lint and production build passed; **8 anatomy tests passed**.
- Existing scene-engine **28 passed**, scene-planner **12 passed**.
- Full real-Chromium mock smoke passed: actual accident records, wheel exposure/reversal, continued zoom, direct mesh selection, rotation/pan, canvas persistence, reassembly, source inspector and unassigned isolation; no runtime/console errors.
- API-backed synthetic postmortem browser flow passed: cited normal and uncertain findings, confirm/reject, marker placement persisted across reload, rejected badges hidden, person/unassigned isolation, no AI configuration; no runtime/console errors.
- Separate development-browser regression passed opening/closing cited evidence and switching people after the inspector effect fix.
- Separate production missing-GLB check passed: load error shown, original findings and evidence navigation still usable.
- Live Gemini was **not** called; deterministic model responses were used in backend tests.

The latest main merge adds Leaflet dependencies and dashboard CSS. **Install the merged lockfile and rerun required checks after this merge**; those final post-merge checks are the immediate remaining verification. The complete production/API smoke script also warrants a final uninterrupted run; earlier runs found and helped fix the inspector cleanup issue. The synthetic portion and final full mock run passed individually.

## Next steps

1. Restore repository write access; push this existing branch. If using the handoff bundle in another clone, fetch its branch (instructions below).
2. Install locked frontend dependencies with `npm ci` (the existing postinstall also builds local scene packages), or `npm ci --ignore-scripts` plus the documented local package installs/builds. No anatomy runtime dependency was added.
3. Run `npm run lint`, `npm run build`, `npm run test:anatomy` in `frontend/` and `.venv/bin/pytest -q` in `backend/`.
4. Run the browser smoke against a built preview and a **fresh** isolated synthetic demo database, following `docs/M5_ANATOMY.md`. The synthetic browser script intentionally modifies review and marker state in that throwaway database.
5. Review edge cases and then open a **draft PR** into main. Do not merge it. List shared schema/migration/package changes and the model license. No issue number was supplied; do not invent one.

Known scope limits: selected adult-male reference anatomy, no patient-specific geometry, incomplete soft-tissue coverage, illustrative rather than clinically measured marker coordinates, no globally synchronized deduplication across simultaneous application workers. New/changed report passages add proposals and retain old records for review. Full authentication remains outside this task; the investigator header is audit attribution only.

## Workspace and portability

Original workspace: `/workspace/Hackinverse-1.0`. Normal development DB was upgraded to `0002` without resetting its seed. The separate browser DB is `/tmp/forensix-anatomy-browser/demo.db`; fixture IDs are in `fixture.json` beside it. Its synthetic records have already been reviewed/modified by tests; use a new directory for another complete run.

A portable bundle is provided as `/workspace/m5-anatomy.bundle`. In another clone with this repository's latest main fetched:

```bash
git fetch origin
git fetch /path/to/m5-anatomy.bundle m5/anatomy-examination:m5/anatomy-examination
git switch m5/anatomy-examination
git push -u origin m5/anatomy-examination
```

The bundle contains the committed feature branch, including its latest-main merge and this handoff. The main implementation guide remains `docs/M5_ANATOMY.md`.
