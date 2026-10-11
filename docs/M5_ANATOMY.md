# M5 anatomy examination

Open **Autopsy & medical** at `/cases/:caseId/autopsy`. The module reads the existing case, people, injuries, evidence links and review states. It uses the application's design tokens, R3F/Drei camera controls, query cache and evidence inspector. The original road-accident seed is unchanged: Rohan remains injured, with a right-clavicle fracture, forehead laceration and upper-arm bruise.

## Run

Use the repository's normal environment setup, then:

```bash
cd backend
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload --port 8000
```

In another terminal:

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000/cases/1/autopsy` after loading the normal seed (`python -m app.seed` on an empty development database). `npm run dev:mock` supports the same module without a backend. Do not reset a database containing investigation work.

Gemini is optional for viewing, source inspection and review. To request new proposals, configure the existing `GEMINI_API_KEY`, process a medical/document evidence item through the existing evidence pipeline, select its named person and source report in this module, choose medical or postmortem classification, and click **Analyse / reanalyse report**. This action can incur the existing model's API cost. Opening the viewer or choosing a report never invokes extraction. Report classification does not change a person's recorded condition.

## Viewer and findings

- The 4.4 MB [BodyParts3D subset](../assets/3d/anatomy/README.md) contains 18 selectable structures built from 120 real segmented source meshes. Geometry is CC BY-SA 2.1 Japan; attribution appears in the viewer and travels with the asset. Application startup does not download models.
- Scroll inward to fade the intact skin, then organize the organs into separated anatomical rows. The normalized slider and Explode/Reassemble controls provide the same reversible transition. Further inward scrolling at full separation moves the camera closer. Outward scrolling reverses it. Rotation, pan, front/back views and zoom remain available.
- Selecting a mesh or navigator entry fits the camera to its real bounds and ghosts surrounding structures. Return restores the saved view and separation state. Reassemble restores immutable original positions. Organ selection keeps the same canvas and loaded geometry mounted.
- Selecting a structure shows its status at the top of the findings inspector: injury or abnormality documented, explicitly normal, uncertain or not documented. Injured structures also show the worst recorded severity on a four-step scale, or **Severity not documented**. The panel also shows counts by finding type and how many AI proposals are still pending. Rejected findings are excluded, and no severity is inferred.
- Structures without findings say **Not documented**. Normal requires an explicit cited finding. Contradictory or uncertain records remain uncertain. Pending proposals retain their review badges and dashed marker borders; rejected proposals are available through the records filter but have no 3D markers.
- Person and report filters prevent findings from different people or sources being combined. Unassigned findings are a separate selection. Selecting another report never deletes findings.
- Stable model IDs take precedence. Without an ID, only an exact named body region can map to a structure; narrative mentions do not establish an injury location. Unsupported IDs and soft-tissue regions remain in the regional/unresolved panel. In particular, a forehead cut is not a frontal-bone injury, and an arm bruise is not a humeral injury.
- Organ-only `≈` badges indicate association, not measured coordinates. **Adjust illustrative marker** lets an investigator place a supported injury on its documented mesh. Its model-local coordinates, regional precision, model version and investigator origin persist in the existing Injury record and audit trail. AI extraction cannot supply exact coordinates. Markers follow the structure's transforms.
- The existing highlighted-passage effect discards the return value of `scrollIntoView`, preventing modern browser Promises from being treated as React cleanup functions. Every source-backed card uses `SourcePassages` and opens the existing evidence inspector with `?evidence=…&passage=…`. Review uses the existing confirm/reject/undo actions and audit attribution.

## Backend and extraction

Migration `0003` follows the reconstruction-scene migration `0002`. It adds default-empty `injuries.medical_details` JSON and a reviewable `anatomy_findings` table for non-traumatic pathology, explicit normal statements and uncertainty. Existing trauma stays in `Injury`; missing severity uses the additive `unknown` value. The record registry, evidence links, case counts, AI review module and mock transport recognize the new type. Confirmed anatomy findings and their source IDs appear in the existing confirmed-findings section of newly generated medical/court report snapshots. Pending/rejected anatomy proposals are excluded there; old snapshots are unchanged.

New routes:

| Route | Behavior |
| --- | --- |
| `GET /api/cases/{id}/anatomy-findings` | Case-scoped stored non-traumatic findings |
| `PATCH /api/anatomy-findings/{id}` | Audited review-status update |
| `POST /api/cases/{id}/medical-analysis` | Explicit person/evidence/report-classification analysis |

Medical analysis reuses the shared Gemini client, `generate_json`, extracted text and indexed evidence chunks. It validates case membership, active patient identity, processing state and a strict Pydantic proposal schema. The selected person's name must occur as a complete normalized phrase in the report. Every supporting quote must match a complete normalized passage within an indexed chunk; measurements must occur in that quote. Unsupported severity, negated severity and invalid normal claims are rejected. Source validation ignores punctuation/case/whitespace; it does not use fuzzy overlap matching.

The entire returned batch is validated before proposals are written. AI output is retained in `ai_runs`, new proposals start pending, and evidence links include the original quote and chunk. Unsupported structures remain unresolved with an explanatory note. Analysis never changes person condition or infers death from injury severity. LLM semantic accuracy still requires investigator review; literal source checks cannot prove that every interpretation of a quoted passage is medically correct.

Reanalysis reuses records with the same person, report, normalized quote, structure/region and finding type. It preserves investigator edits and review decisions, including rejection. Changed passages add new pending proposals; older findings are retained for review, not silently replaced. Simultaneous requests from separate application workers are not globally deduplicated. The UI disables repeat requests while one is running. The existing investigator header remains audit attribution, not a new authentication mechanism.

## Isolated synthetic demonstration

The optional script creates a **new** throwaway database, loads the unchanged road-accident seed, then adds a separate `SYNTHETIC-M5` case. It refuses an existing demo database and never calls Gemini. Synthetic Alex has a pending left-lung contusion, a cited normal liver and an uncertain heart statement. Synthetic Sam and an unassigned injury exercise isolation. These are hand-authored fixtures, not a claim that live AI extraction ran.

From the repository root:

```bash
backend/.venv/bin/python backend/scripts/anatomy_demo.py /tmp/evidentia-anatomy-demo
cd backend
DATABASE_URL=sqlite:////tmp/evidentia-anatomy-demo/demo.db \
STORAGE_DIR=/tmp/evidentia-anatomy-demo/storage GEMINI_API_KEY='' \
.venv/bin/uvicorn app.main:app --port 8001
```

The generated `fixture.json` identifies the case and records. To browse that database manually, run the normal frontend with its backend on port 8000 instead, using the same `DATABASE_URL` and `STORAGE_DIR`. Keep your ordinary backend separate.

## Verification

```bash
cd backend
.venv/bin/pytest -q
cd ../frontend
npm run gen:api
npm run lint
npm run build
npm run test:anatomy
```

The focused backend tests cover strict output, citation and measurement validation, patient/report isolation, normal vs missing information, review-preserving reanalysis, error retention, audited review, report export, bounded marker placement, and a real Alembic upgrade/downgrade/upgrade that preserves old injuries. Frontend tests verify the shipped GLB's checksum and source mesh names/bounds, non-overlapping exploded bounds, exact reversibility, marker transforms, conservative mapping, person isolation, review states and mock routes.

The optional browser runner needs Python `playwright` and Chromium; they are test tools, not new application dependencies. Run against a built preview to avoid dev-server reloads during checks:

```bash
# Terminal 1, frontend/
npm run preview -- --port 3002
# Terminal 2, repository root; synthetic backend from above must be running on 8001
python frontend/scripts/anatomy/browser_smoke.py --url http://localhost:3002 \
  --backend http://127.0.0.1:8001 --fixture /tmp/evidentia-anatomy-demo/fixture.json
# Mock mode, with npm run dev:mock -- --port 3001 running separately
python frontend/scripts/anatomy/browser_smoke.py --url http://localhost:3001 --mock
```

Pass `--chromium /path/to/chromium` when needed. Screenshots go to `/tmp/anatomy-browser-shots`. The synthetic browser flow reviews records and saves a marker in its throwaway database; create a fresh demo directory before repeating it. It checks the real existing seed, mesh selection, canvas persistence, scroll reversal, rotation/pan/zoom, source-inspector navigation, normal/uncertain states, review changes, persisted marker positions and person isolation. Missing-model and live-Gemini checks require separate scenarios.

## Limits

The model is a simplified adult male reference subset, not patient-specific anatomy; soft-tissue regions and many anatomical systems are absent. Investigator marker placement is illustrative, not a clinical measurement. Touch users can rotate/pan with the installed camera controls and use the explicit separation slider; touch pinch is ordinary camera zoom. Live Gemini needs credentials and was not called during the deterministic tests. No new dependency or unrelated crime-scene/security redesign is part of this change.

## Executed checks (11 October 2026, after merging main at `335ea48`)

- Backend: 291 passing tests, including 31 anatomy tests and migration preservation; Alembic has a single head (`0003`).
- Frontend: `npm ci` on the merged lockfile, OpenAPI regeneration (no diff), TypeScript validation, production build, and all 8 anatomy tests passed.
- Existing scene packages: 28 scene-engine and 12 scene-planner tests passed.
- Real Chromium: the complete smoke script passed uninterrupted in mock mode and against a production preview with a fresh synthetic database (existing seed/camera/source flow, postmortem normal/uncertain findings, review, persisted marker, rejected badges, person isolation, no AI), with no browser runtime or console errors. Before the merge, the evidence-inspector close/person-switch regression passed in development mode, and the missing-GLB fallback retained findings and usable source navigation.
- Live Gemini was not exercised. Backend tests substitute deterministic model output and test both successful explicit analysis and failures.
- Existing non-fatal warnings remain: large Vite chunks, Python deprecations and the scene packages' CommonJS Three.js deprecation.
