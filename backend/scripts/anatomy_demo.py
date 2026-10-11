"""Create an isolated, clearly synthetic anatomy demo alongside the unchanged seed.

Usage: .venv/bin/python scripts/anatomy_demo.py /tmp/forensix-anatomy-demo
Refuses to reuse an existing database. Does not call Gemini or read the normal DB.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    directory = args.directory.resolve()
    directory.mkdir(parents=True, exist_ok=True)
    database = directory / "demo.db"
    if database.exists():
        parser.error("demo.db already exists; choose a new empty directory")
    os.environ.update(DATABASE_URL=f"sqlite:///{database}", STORAGE_DIR=str(directory / "storage"), GEMINI_API_KEY="")
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=Path(__file__).resolve().parents[1], check=True)
    from app.core.db import SessionLocal
    from app.models import AnatomyFinding, Case, Evidence, EvidenceChunk, EvidenceLink, Injury, Person
    from app.schemas.anatomy import MedicalDetails
    from app.seed import seed
    with SessionLocal() as db:
        seed(db)
        case = Case(case_number="SYNTHETIC-M5", title="SYNTHETIC — Anatomy demonstration", incident_type="other",
                    status="open", priority="low", description="Invented test records. No real patient or forensic conclusion.")
        db.add(case)
        db.flush()
        person = Person(case_id=case.id, name="Synthetic Alex", role="victim", condition="deceased")
        other = Person(case_id=case.id, name="Synthetic Sam", role="victim", condition="injured")
        db.add_all([person, other]); db.flush()
        text = "SYNTHETIC POSTMORTEM TEST REPORT. Synthetic Alex. Left lung contusion measures 2 cm. Liver is unremarkable. Heart enlargement is uncertain. No cause of death is established by this invented report."
        source = Evidence(case_id=case.id, type="medical", title="SYNTHETIC Alex postmortem report", mime_type="text/plain",
                          processing_status="done", extracted_text=text, summary="Synthetic anatomy test data only.")
        db.add(source); db.flush()
        chunk = EvidenceChunk(evidence_id=source.id, ordinal=0, page=1, text=text)
        db.add(chunk); db.flush()
        details = MedicalDetails(report_kind="postmortem", mapping_origin="ai", location_precision="organ_only")
        injury = Injury(case_id=case.id, person_id=person.id, body_region="chest", structure_id="lung_left", type="Contusion",
                        severity="unknown", description="Left lung contusion measures 2 cm.", origin="ai", review_status="pending",
                        medical_details=(details.model_dump() | {"measurements": [{"label": "size", "value": "2 cm"}]}))
        normal = AnatomyFinding(case_id=case.id, person_id=person.id, structure_id="liver", body_region="abdomen",
                        finding_type="explicitly_normal", description="Liver is unremarkable.", medical_details=details.model_dump(), origin="ai", review_status="confirmed")
        uncertain = AnatomyFinding(case_id=case.id, person_id=person.id, structure_id="heart", body_region="chest",
                        finding_type="uncertain", description="Heart enlargement is uncertain.", origin="ai", review_status="pending",
                        medical_details=details.model_copy(update={"assertion": "uncertain", "uncertainty": "Report does not establish enlargement."}).model_dump())
        db.add_all([injury, normal, uncertain]); db.flush()
        for row, kind, quote in [(injury, "injury", injury.description), (normal, "anatomy_finding", normal.description), (uncertain, "anatomy_finding", uncertain.description)]:
            db.add(EvidenceLink(evidence_id=source.id, chunk_id=chunk.id, target_type=kind, target_id=row.id, passage=quote))
        db.add(Injury(case_id=case.id, person_id=other.id, body_region="right_arm", type="Bruising", severity="minor", description="SYNTHETIC Sam upper-arm bruise."))
        db.add(Injury(case_id=case.id, body_region="head", type="Abrasion", severity="unknown", description="SYNTHETIC unassigned finding."))
        db.commit()
        output = dict(case_id=case.id, person_id=person.id, other_person_id=other.id, evidence_id=source.id,
                      injury_id=injury.id, normal_id=normal.id, uncertain_id=uncertain.id, database_url=os.environ["DATABASE_URL"], storage_dir=os.environ["STORAGE_DIR"])
        (directory / "fixture.json").write_text(json.dumps(output, indent=2) + "\n")
        print(json.dumps(output, indent=2))

if __name__ == "__main__":
    main()
