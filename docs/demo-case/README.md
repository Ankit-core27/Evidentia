# Demo case: red-light collision at Sahyadri Chowk

A complete, self-consistent road-accident case for a live run of Evidentia. `python -m app.seed` loads it as case FX-2026-0005, already processed: the 13 files stored as PDFs with their hashes and indexed text, the persons, vehicles, locations, timeline, relationships, statements, conflicts and injuries an investigator would have after review, each linked to its source passage, the two scenarios compiled into the 3D scene by the real reconstruction compiler, and a summary report. Its data is in `backend/app/seed_sahyadri.py`. To run the live pipeline instead, upload the files below through the UI to a new case and process them with Gemini.

All names, numbers and registrations in these files are invented.

## The story

At 22:13:49 on Friday 14 August 2026, a white Honda City travelling east on Karve Road collides with a CNG auto-rickshaw travelling south on Lane 7 at Sahyadri Chowk, Kothrud, Pune. The auto rolls onto its side. Its passenger is thrown out and badly hurt, and the auto driver is trapped under the vehicle.

Both drivers say they had the right of way. The files let you test that claim against instruments.

| Question | What the evidence says |
| --- | --- |
| Which signal did each driver have? | Rajesh Menon (sedan) says amber. Santosh Jadhav (auto) says green. The signal controller log shows the sedan's road had been red for 5 s, and the auto's road green for 2 s |
| How fast was the sedan going? | Menon says about 40 km/h (the limit). Shinde and Bhosale say 60 or more. CCTV says about 65 km/h, and the car's event data recorder says 66 km/h until 0.9 s before impact |
| Was Menon on his phone? | Menon says Bluetooth and that he "may have" had a call. The head unit log shows the call was on the phone's own speaker, in progress at impact |
| Was Menon alone? | Menon and Jadhav say yes. Shinde, the CCTV report and the 112 call say a woman in a blue kurta left the passenger seat. The event data recorder senses an occupied, belted passenger seat. Her identity is unknown |
| What colour was the sedan? | Menon says silver-grey. The inspection report and three witnesses say white |
| When did it happen? | The FIR says "about 22:15". The logs and CCTV say 22:13:49 |
| When did Menon leave the office? | His statement says about 21:55. His phone record shows a call from the office area at 21:47 labelled "left office" |

Two competing scenarios come out of this: one that follows the instruments (the sedan entered on red at about 65 km/h) and one that follows Menon's account (amber, about 40 km/h). The reconstruction should show both, with the instrument-backed one first.

## Files

Upload all 13 files in `evidence/` to one case.

| File | Type to expect | What it feeds |
| --- | --- | --- |
| `01_fir_and_scene_report.md` | document | Road layout, survey coordinates, skid marks, final rest positions. This is the main input for the 3D scene |
| `02_statement_rajesh_menon.md` | statement | Sedan driver's account (amber, 40 km/h, alone) |
| `03_statement_santosh_jadhav.md` | statement | Auto driver's account (green) |
| `04_statement_pradeep_shinde.md` | statement | Independent eyewitness, the woman in the blue kurta |
| `05_statement_neha_bhosale.md` | statement | Scooter rider, the overtake and the speed |
| `06_signal_controller_log.md` | document | The signal phases to the second |
| `07_cctv_analysis_report.md` | document | Timed key frames, speed estimates |
| `08_vehicle_event_data_recorder.md` | document | Sedan speed, brake, steering and seat sensors |
| `09_emergency_call_112_transcript.md` | audio transcript | Call timeline, "through the red light" |
| `10_medical_report_meera_kulkarni.md` | medical | Injuries for the anatomy view: right frontal bone, left clavicle, right lung, right ribs |
| `11_medical_report_santosh_jadhav_and_rajesh_menon.md` | medical | Two patients in one file, to test that findings go to the right person |
| `12_motor_vehicle_inspection_report.md` | document | Vehicle condition and damage |
| `13_call_detail_records_rajesh_menon.md` | document | Phone call at the moment of impact |

If the upload form asks for a case title and description, use:

- **Title:** Red-light collision at Sahyadri Chowk, Karve Road, Kothrud
- **Type:** Road accident. **Priority:** High
- **Incident time:** 14 August 2026, 22:13:49 IST
- **Description:** Sedan and auto-rickshaw collide at a signalised junction. Two drivers give opposite accounts of the signal. FIR 0287/2026, Kothrud Police Station.

## Run-through

Set up and start both apps as in the root `Readme.md`, with `GEMINI_API_KEY` in `.env`. Start from an empty database (delete `storage/`, then `alembic upgrade head`) so that only this case is on screen, or keep the seed data if you want a populated dashboard.

1. **Create the case** and open its workspace.
2. **Upload the 13 files** together. Each shows `queued`, then `processing`, then `done`. Files are processed one at a time, so allow a few minutes on a free Gemini key (see "Rate limits" below).
3. **Check the evidence locker.** Open `08_vehicle_event_data_recorder.md` and note the SHA-256 and the AI summary. Open the custody ledger.
4. **Review the AI proposals.** The review queue holds the persons, vehicles, locations, events and observations Gemini extracted, each with the passage it came from. Confirm a few and reject one, so the audit trail has entries.
5. **Ask questions** (cited answers). Suggested:
   - "Which signal did the Honda City have when it reached the junction, and what is the evidence?"
   - "How fast was the sedan travelling before the collision?"
   - "Was Rajesh Menon using his phone at the time of the collision?"
   - "Who else was in the sedan?"
   - "What injuries did Meera Kulkarni suffer?"
6. **Open the conflicts list.** Expect conflicts about the signal, the sedan's speed, whether Menon was alone, the car's colour, the time, and the phone. Mark one resolved.
7. **Open the evidence graph.** Persons, the two vehicles, the junction and the evidence nodes should be linked. Confirm one relationship and reject one.
8. **Open the timeline.** Events from 21:47 (call, leaving the office) to 22:26 (ambulance) should be in order, each linked to its source. Filter by category.
9. **Generate the reconstruction.** Use "Generate from evidence". Expect a crossroads with the sedan eastbound and the auto southbound, skid marks of about 13.4 m, an impact point near the north-east quarter of the junction, and two or three stages. Compare the two scenarios side by side and switch stages.
10. **Anatomy.** Run the medical analysis on `10_medical_report_meera_kulkarni.md` for Meera Kulkarni. Expect findings on the frontal bone, left clavicle and right lung. Ribs and the tibia are not modelled, so they should appear as regional findings, not on a bone.
11. **Build a report** and print it. It should list the evidence with hashes, the timeline, the conflicts and the scenarios with their assumptions.
12. **Verify integrity** on the case. Every file should match its hash.

## What the model should not do

Evidentia reports what the evidence says and where accounts differ. It should not state that anyone is guilty. If a generated summary or scenario names intent or blame, reject it in review; that is part of the demonstration.

## Rate limits

A free Gemini key allows only about 5 requests per minute per model. The backend retries with backoff and processes one file at a time, so a full upload still completes, but it takes several minutes. For a smooth live demo, either upload and process the case before presenting, or use a key with billing enabled. `GEMINI_MODEL` in `.env` selects the model; `gemini-3.5-flash-lite` has a much higher free allowance at lower extraction quality.
