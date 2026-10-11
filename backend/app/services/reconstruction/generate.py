"""POST /api/cases/{id}/reconstructions/generate: from a case's evidence to scenarios
in the 3D scene.

1. The dossier gathers every evidence item's text and the records proposed from it.
2. Gemini writes a scene script from it (app/services/ai/scene_script.py). Without
   GEMINI_API_KEY, or if Gemini fails or returns something unusable, the rules
   planner drafts one instead, and a warning says so.
3. The script is checked against the case and saved as one reconstruction per
   scenario, with its stages, scene objects, viewpoints, measurements and evidence
   links, and the generated layout as its scene (compiler.py).

Every script, from Gemini or the rules, is logged to ai_runs against the case.
"""

import logging
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models import AiRun, Case, Reconstruction
from app.services.ai import client
from app.services.ai.gemini import log_run, model_name
from app.services.ai.scene_script import TASK, plan_with_gemini
from app.services.reconstruction.compiler import check_script, save_script
from app.services.reconstruction.dossier import build_dossier
from app.services.reconstruction.rules import plan_with_rules
from app.services.reconstruction.script import SceneScript

logger = logging.getLogger(__name__)

RULES_MODEL = "rules-v1"


@dataclass
class Generated:
    generator: str
    model: str
    script: SceneScript
    warnings: list[str]
    reconstructions: list[Reconstruction]


def generate_reconstructions(db: Session, case: Case, *, instructions: str, actor_id: int | None) -> Generated:
    dossier = build_dossier(db, case)
    warnings: list[str] = []
    script: SceneScript | None = None
    generator, model = "rules", RULES_MODEL
    gemini = client.get_client()
    if gemini is not None:
        try:
            script, raw = plan_with_gemini(gemini, dossier, instructions)
            log_run(db, TASK, raw, case_id=case.id)
            db.commit()
            if script is None:
                warnings.append("Gemini's scene script couldn't be read, so this is a draft from the case records.")
            else:
                generator, model = "gemini", model_name()
        except Exception as exc:
            logger.exception("Scene script for case %s failed", case.id)
            db.rollback()
            reason = (str(exc).strip() or type(exc).__name__)[:200]
            warnings.append(f"Gemini couldn't write the scene script ({reason}), so this is a draft from the case records.")
    if script is not None:
        try:
            warnings += check_script(dossier, script)
        except ValueError as exc:
            warnings.append(f"Gemini's scene script was unusable ({exc}), so this is a draft from the case records.")
            script, generator, model = None, "rules", RULES_MODEL
    if script is None:
        if gemini is None:
            warnings.append("GEMINI_API_KEY isn't set, so this is a draft from the case records, made without AI.")
        if instructions.strip():
            warnings.append("The instructions were not used: only Gemini reads them.")
        script = plan_with_rules(dossier)
        warnings += check_script(dossier, script)
        db.add(AiRun(case_id=case.id, task=TASK, model=RULES_MODEL, output=script.model_dump(mode="json")))
    reconstructions = save_script(
        db, dossier, script, generator=generator, model=model, warnings=warnings, actor_id=actor_id
    )
    db.commit()
    return Generated(generator, model, script, warnings, reconstructions)
