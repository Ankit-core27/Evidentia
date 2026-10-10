from typing import Literal

from pydantic import Field

from app.schemas.common import ApiModel, OrmModel


class AskTurn(ApiModel):
    role: Literal["user", "assistant"]
    content: str


class AskRequest(ApiModel):
    """The conversation is kept in the browser; the backend stores no chat history."""

    question: str = Field(min_length=1)
    history: list[AskTurn] = []


class Citation(OrmModel):
    chunk_id: int
    evidence_id: int
    evidence_title: str
    page: int | None
    passage: str


class AskResponse(OrmModel):
    answer: str
    citations: list[Citation]
    # Up to three suggested follow-up questions.
    follow_ups: list[str]


class SearchHit(Citation):
    score: float
