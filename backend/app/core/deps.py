"""FastAPI dependencies shared by every router."""

from typing import Annotated

from fastapi import Depends, Header, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Investigator

DbSession = Annotated[Session, Depends(get_db)]


def get_actor_id(
    db: DbSession,
    x_investigator_id: Annotated[int | None, Header()] = None,
    investigator_id: Annotated[int | None, Query(include_in_schema=False)] = None,
) -> int | None:
    """The investigator picked in the header bar, for the audit log.

    Sent as the X-Investigator-Id header, or as ?investigator_id= where the browser
    can't send headers (<img>, <video>, download links). Unknown IDs, such as one
    left in localStorage after the database was reset, count as no investigator.
    Until access control lands (M8) this is trusted as given.
    """
    actor_id = x_investigator_id if x_investigator_id is not None else investigator_id
    if actor_id is None or db.get(Investigator, actor_id) is None:
        return None
    return actor_id


ActorId = Annotated[int | None, Depends(get_actor_id)]
