"""Ranks one case's chunks against a query (step 5 in docs/PLAN.md).

With GEMINI_API_KEY set: cosine similarity between Gemini embeddings, with numpy.
Chunks that have no embedding yet (seed data, text indexed without a key, or an
embedding call that failed) are embedded on first use, and the caller commits
them. Without a key, or if the embedding call fails, chunks are ranked by keyword
overlap, as the frontend mock does (rankChunks in frontend/src/mocks/handlers.ts).
"""

import logging
import math
import re
from dataclasses import dataclass

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Evidence, EvidenceChunk
from app.services.ai import client
from app.services.search.embeddings import embed_texts, from_bytes, to_bytes

logger = logging.getLogger(__name__)

STOPWORDS = frozenset(
    "the a an and or of to in on at for by with what when who whom which was were is are be been did does do it "
    "its this that from as about any there their they he she his her i my me we our you your how why where after "
    "before into than then so not no has have had".split()
)


@dataclass
class RankedChunk:
    chunk: EvidenceChunk
    evidence_title: str
    score: float

    def citation(self) -> dict:
        """The Citation fields (app/schemas/search.py)."""
        return {
            "chunk_id": self.chunk.id,
            "evidence_id": self.chunk.evidence_id,
            "evidence_title": self.evidence_title,
            "page": self.chunk.page,
            "passage": self.chunk.text,
        }


def tokens(text: str) -> list[str]:
    """Lower-case words of two or more characters, without stopwords."""
    words = re.sub(r"[^a-z0-9.:\s-]", " ", text.lower()).split()
    stripped = (word.strip(".:-") for word in words)
    return [word for word in stripped if len(word) > 1 and word not in STOPWORDS]


def case_chunks(db: Session, case_id: int) -> list[tuple[EvidenceChunk, str]]:
    """Every chunk of the case's evidence, with its evidence title, in index order."""
    rows = db.execute(
        select(EvidenceChunk, Evidence.title)
        .join(Evidence, Evidence.id == EvidenceChunk.evidence_id)
        .where(Evidence.case_id == case_id)
        .order_by(EvidenceChunk.id)
    ).all()
    return [(chunk, title) for chunk, title in rows]


def rank_chunks(db: Session, case_id: int, query: str, *, limit: int) -> list[RankedChunk]:
    """The case's chunks most relevant to `query`, best first; at most `limit`."""
    if not query.strip():
        return []
    chunks = case_chunks(db, case_id)
    if not chunks:
        return []
    genai_client = client.get_client()
    if genai_client is not None:
        try:
            return semantic_rank(genai_client, chunks, query)[:limit]
        except Exception:
            logger.exception("Embedding search failed for case %s; ranking by keywords instead", case_id)
    return keyword_rank(chunks, query)[:limit]


def semantic_rank(genai_client, chunks: list[tuple[EvidenceChunk, str]], query: str) -> list[RankedChunk]:
    """Cosine similarity between the query and every chunk. Embeds the chunks that
    have no embedding, or one of another size (from an earlier embedding model)."""
    (query_vector,) = embed_texts(genai_client, [query], task_type="RETRIEVAL_QUERY")
    missing = [chunk for chunk, _ in chunks if chunk.embedding is None or len(chunk.embedding) != query_vector.nbytes]
    if missing:
        vectors = embed_texts(genai_client, [chunk.text for chunk in missing], task_type="RETRIEVAL_DOCUMENT")
        for chunk, vector in zip(missing, vectors):
            chunk.embedding = to_bytes(vector)

    matrix = np.vstack([from_bytes(chunk.embedding) for chunk, _ in chunks])
    norms = np.linalg.norm(matrix, axis=1) * np.linalg.norm(query_vector)
    scores = matrix @ query_vector / np.where(norms == 0, 1, norms)
    order = np.argsort(-scores, kind="stable")
    return [RankedChunk(chunks[i][0], chunks[i][1], round(float(scores[i]), 4)) for i in order]


def keyword_rank(chunks: list[tuple[EvidenceChunk, str]], query: str) -> list[RankedChunk]:
    """The share of query terms found in the chunk (as a word prefix), plus 0.5 when
    the chunk contains the whole query. Chunks with no match are left out."""
    terms = list(dict.fromkeys(tokens(query)))
    if not terms:
        return []
    phrase = query.strip().lower()
    ranked: list[RankedChunk] = []
    for chunk, title in chunks:
        words = tokens(chunk.text)
        hits = [
            term
            for term in terms
            if any(word.startswith(term) or (term.startswith(word) and len(word) > 3) for word in words)
        ]
        score = len(hits) / len(terms) + (0.5 if phrase in chunk.text.lower() else 0)
        if score > 0:
            # Math.round(score * 100) / 100, as the mock rounds.
            ranked.append(RankedChunk(chunk, title, math.floor(score * 100 + 0.5) / 100))
    ranked.sort(key=lambda hit: hit.score, reverse=True)
    return ranked
