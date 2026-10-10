"""Tests for search and cited answers (task A2): chunking, embedding, ranking,
GET /cases/{id}/search and POST /cases/{id}/ask, with and without Gemini.

Gemini is never called: use_gemini() patches app.services.ai.client.get_client
to return a fake whose embeddings are word-count vectors, so cosine similarity
follows word overlap and rankings are predictable.
"""

import json
import zlib
from types import SimpleNamespace

import numpy as np
from sqlalchemy import select

from app.core.config import get_settings
from app.models import AiRun, Evidence, EvidenceChunk
from app.services.ai import client as ai_client
from app.services.search import embeddings
from app.services.search.indexing import CHUNK_CHARS, index_evidence, split_into_chunks
from app.services.search.ranking import tokens
from tests.factories import make_case, make_evidence

DIMENSIONS = 1024


def fake_vector(text: str) -> list[float]:
    vector = np.zeros(DIMENSIONS, dtype=np.float32)
    for token in tokens(text):
        vector[zlib.crc32(token.encode()) % DIMENSIONS] += 1
    return vector.tolist()


class FakeModels:
    def __init__(self, answer=None, fail_embed=False):
        self.answer = answer
        self.fail_embed = fail_embed
        self.embed_calls: list[tuple[str, list[str]]] = []
        self.generate_calls: list[dict] = []

    def embed_content(self, *, model, contents, config=None):
        if self.fail_embed:
            raise RuntimeError("embedding service down")
        texts = [content.parts[0].text for content in contents]
        self.embed_calls.append((config.task_type, texts))
        return SimpleNamespace(embeddings=[SimpleNamespace(values=fake_vector(text)) for text in texts])

    def generate_content(self, *, model, contents, config=None):
        self.generate_calls.append({"model": model, "contents": contents, "config": config})
        if isinstance(self.answer, Exception):
            raise self.answer
        return SimpleNamespace(text=self.answer if isinstance(self.answer, str) else json.dumps(self.answer))


def use_gemini(monkeypatch, **options) -> FakeModels:
    fake = SimpleNamespace(models=FakeModels(**options))
    monkeypatch.setattr(ai_client, "get_client", lambda: fake)
    return fake.models


REPORT_PAGES = [
    "Accident report TPS12/2026/0412.\n\nThe van struck the driver's side of the hatchback in the middle of the junction.",
    "Skid marks from the hatchback measured 8.4 m before the point of impact. The van left no skid marks.",
]
STATEMENT = (
    "The white car's light was still yellow when it went into the junction.\n\n"
    "The blue van started moving before its light turned green. I called 112 straight away."
)


def make_indexed_case(db):
    """A case with a two-page report (chunks 1 and 2) and a statement (chunk 3),
    plus another case whose chunk must never show up."""
    case = make_case(db)
    report = make_evidence(db, case, title="Police report.pdf")
    statement = make_evidence(db, case, type="statement", title="Statement - Anita Desai.txt")
    index_evidence(db, report.id, REPORT_PAGES, paged=True)
    index_evidence(db, statement.id, [STATEMENT])
    other_case = make_case(db, title="Another case")
    other = make_evidence(db, other_case, title="Other report.pdf")
    index_evidence(db, other.id, ["The van crossed the junction. Skid marks on the road. Light yellow."])
    db.commit()
    return case


def chunk_ids(db, title: str) -> list[int]:
    return list(
        db.scalars(
            select(EvidenceChunk.id).join(Evidence).where(Evidence.title == title).order_by(EvidenceChunk.id)
        )
    )


# ---------------------------------------------------------------------------
# Chunking and indexing
# ---------------------------------------------------------------------------


def test_chunks_pack_paragraphs_up_to_the_limit():
    text = "First paragraph.\n\nSecond paragraph.\n \nThird, a bit longer paragraph."
    assert split_into_chunks(text, limit=40) == ["First paragraph.\n\nSecond paragraph.", "Third, a bit longer paragraph."]
    assert split_into_chunks(text) == [text]
    assert split_into_chunks("  \n\n ") == []


def test_long_paragraphs_are_cut_after_a_sentence():
    sentence = "The van moved off before the light turned green. "
    paragraph = sentence * 100
    chunks = split_into_chunks(paragraph)
    assert len(chunks) > 1
    assert all(len(chunk) <= CHUNK_CHARS for chunk in chunks)
    assert all(chunk.endswith("green.") for chunk in chunks)
    assert " ".join(chunks) == paragraph.strip()


def test_text_without_breaks_is_cut_at_the_limit():
    chunks = split_into_chunks("x" * 50, limit=20)
    assert chunks == ["x" * 20, "x" * 20, "x" * 10]


def test_chunks_are_slices_of_the_original_text():
    # Passages quoted from the text (evidence links, the inspector) must be found as written.
    text = "Line one\nline two.\n\n\n   Indented paragraph   \n\nLast."
    chunks = split_into_chunks(text, limit=30)
    assert all(chunk in text for chunk in chunks)
    assert chunks == ["Line one\nline two.", "Indented paragraph   \n\nLast."]


def test_index_without_a_key_stores_chunks_without_embeddings(db):
    case = make_case(db)
    evidence = make_evidence(db, case)
    chunks = index_evidence(db, evidence.id, ["First para.\n\nSecond para.", "Page two."], paged=True)
    db.commit()
    assert [(c.ordinal, c.page, c.text, c.embedding) for c in chunks] == [
        (0, 1, "First para.\n\nSecond para.", None),
        (1, 2, "Page two.", None),
    ]

    again = index_evidence(db, evidence.id, ["Only one."])
    db.commit()
    stored = db.scalars(select(EvidenceChunk).where(EvidenceChunk.evidence_id == evidence.id)).all()
    assert [(c.ordinal, c.page, c.text) for c in stored] == [(0, None, "Only one.")]
    assert stored == again


def test_index_with_a_key_embeds_in_batches_as_float32(db, monkeypatch):
    gemini = use_gemini(monkeypatch)
    monkeypatch.setattr(embeddings, "EMBED_BATCH", 2)
    case = make_case(db)
    evidence = make_evidence(db, case)
    pages = ["Page one.", "Page two.", "Page three."]
    chunks = index_evidence(db, evidence.id, pages, paged=True)
    db.commit()

    assert gemini.embed_calls == [
        ("RETRIEVAL_DOCUMENT", ["Page one.", "Page two."]),
        ("RETRIEVAL_DOCUMENT", ["Page three."]),
    ]
    for chunk, page in zip(chunks, pages):
        assert np.array_equal(np.frombuffer(chunk.embedding, dtype=np.float32), fake_vector(page))


def test_index_keeps_chunks_when_embedding_fails(db, monkeypatch):
    use_gemini(monkeypatch, fail_embed=True)
    case = make_case(db)
    evidence = make_evidence(db, case)
    chunks = index_evidence(db, evidence.id, ["Some text."])
    db.commit()
    assert [(c.text, c.embedding) for c in chunks] == [("Some text.", None)]


# ---------------------------------------------------------------------------
# GET /cases/{id}/search
# ---------------------------------------------------------------------------


def test_search_unknown_case(client):
    response = client.get("/api/cases/999/search", params={"q": "van"})
    assert response.status_code == 404
    assert response.json() == {"detail": "Case not found"}


def test_keyword_search_ranks_like_the_mock(client, db):
    case = make_indexed_case(db)
    report_page_1, report_page_2 = chunk_ids(db, "Police report.pdf")

    hits = client.get(f"/api/cases/{case.id}/search", params={"q": "skid marks"}).json()
    assert hits == [
        {
            "chunk_id": report_page_2,
            "evidence_id": hits[0]["evidence_id"],
            "evidence_title": "Police report.pdf",
            "page": 2,
            "passage": REPORT_PAGES[1],
            # Both terms, plus 0.5 for the whole phrase.
            "score": 1.5,
        }
    ]

    # Ties keep index order; only this case's chunks are ranked.
    hits = client.get(f"/api/cases/{case.id}/search", params={"q": "Van at the junction"}).json()
    (statement,) = chunk_ids(db, "Statement - Anita Desai.txt")
    assert [(h["chunk_id"], h["score"]) for h in hits] == [(report_page_1, 1.0), (statement, 1.0), (report_page_2, 0.5)]
    assert hits[1]["page"] is None


def test_keyword_search_matches_word_prefixes(client, db):
    case = make_indexed_case(db)
    # "skids" matches "skid" (a word of four letters or more that the term starts with).
    hits = client.get(f"/api/cases/{case.id}/search", params={"q": "skids"}).json()
    assert [h["page"] for h in hits] == [2]


def test_search_without_terms_returns_nothing(client, db, monkeypatch):
    case = make_indexed_case(db)
    assert client.get(f"/api/cases/{case.id}/search", params={"q": "the of"}).json() == []
    assert client.get(f"/api/cases/{case.id}/search").json() == []
    gemini = use_gemini(monkeypatch)
    assert client.get(f"/api/cases/{case.id}/search", params={"q": "  "}).json() == []
    assert gemini.embed_calls == []


def test_semantic_search_embeds_missing_chunks_on_first_use(client, db, monkeypatch):
    case = make_indexed_case(db)  # indexed without a key, so nothing is embedded yet
    report_page_1, report_page_2 = chunk_ids(db, "Police report.pdf")
    (statement,) = chunk_ids(db, "Statement - Anita Desai.txt")
    gemini = use_gemini(monkeypatch)

    hits = client.get(f"/api/cases/{case.id}/search", params={"q": "skid marks impact"}).json()
    assert hits[0]["chunk_id"] == report_page_2
    assert {h["chunk_id"] for h in hits} == {report_page_1, report_page_2, statement}
    assert hits[0]["score"] > hits[1]["score"] >= hits[2]["score"]
    assert gemini.embed_calls[0] == ("RETRIEVAL_QUERY", ["skid marks impact"])
    assert gemini.embed_calls[1] == ("RETRIEVAL_DOCUMENT", [REPORT_PAGES[0], REPORT_PAGES[1], STATEMENT])

    db.expire_all()
    stored = db.get(EvidenceChunk, report_page_2)
    assert np.array_equal(np.frombuffer(stored.embedding, dtype=np.float32), fake_vector(REPORT_PAGES[1]))

    # Once stored, only the query is embedded.
    client.get(f"/api/cases/{case.id}/search", params={"q": "yellow light"})
    assert gemini.embed_calls[2:] == [("RETRIEVAL_QUERY", ["yellow light"])]


def test_semantic_search_re_embeds_chunks_of_another_size(client, db, monkeypatch):
    case = make_indexed_case(db)
    (statement,) = chunk_ids(db, "Statement - Anita Desai.txt")
    for chunk in db.scalars(select(EvidenceChunk)):
        chunk.embedding = np.ones(DIMENSIONS, dtype=np.float32).tobytes()
    db.get(EvidenceChunk, statement).embedding = np.ones(8, dtype=np.float32).tobytes()
    db.commit()
    gemini = use_gemini(monkeypatch)

    client.get(f"/api/cases/{case.id}/search", params={"q": "yellow"})
    assert gemini.embed_calls[1] == ("RETRIEVAL_DOCUMENT", [STATEMENT])


def test_search_falls_back_to_keywords_when_embedding_fails(client, db, monkeypatch):
    case = make_indexed_case(db)
    use_gemini(monkeypatch, fail_embed=True)
    hits = client.get(f"/api/cases/{case.id}/search", params={"q": "skid marks"}).json()
    assert [(h["page"], h["score"]) for h in hits] == [(2, 1.5)]


# ---------------------------------------------------------------------------
# POST /cases/{id}/ask
# ---------------------------------------------------------------------------


def test_ask_unknown_case(client):
    response = client.post("/api/cases/999/ask", json={"question": "What happened?"})
    assert response.status_code == 404
    assert response.json() == {"detail": "Case not found"}


def test_ask_rejects_an_empty_question(client, db):
    case = make_case(db)
    assert client.post(f"/api/cases/{case.id}/ask", json={"question": ""}).status_code == 422


def test_ask_without_a_key_quotes_the_best_keyword_matches(client, db):
    case = make_indexed_case(db)
    report_page_1, report_page_2 = chunk_ids(db, "Police report.pdf")
    (statement,) = chunk_ids(db, "Statement - Anita Desai.txt")

    body = {
        "question": "When did the van start moving?",
        "history": [
            {"role": "user", "content": "Who are the witnesses?"},
            {"role": "assistant", "content": "Anita Desai."},
        ],
    }
    answer = client.post(f"/api/cases/{case.id}/ask", json=body).json()
    assert [c["chunk_id"] for c in answer["citations"]] == [statement, report_page_1, report_page_2]
    assert answer["citations"][0] == {
        "chunk_id": statement,
        "evidence_id": answer["citations"][0]["evidence_id"],
        "evidence_title": "Statement - Anita Desai.txt",
        "page": None,
        "passage": STATEMENT,
    }
    assert answer["answer"].splitlines()[1] == (
        '1. Statement - Anita Desai.txt: "The blue van started moving before its light turned green."'
    )
    # Questions already asked aren't suggested again.
    assert answer["follow_ups"] == ["Summarise the evidence in this case.", "What happened first?"]
    assert db.scalars(select(AiRun)).all() == []


def test_ask_without_a_key_and_no_match(client, db):
    case = make_indexed_case(db)
    answer = client.post(f"/api/cases/{case.id}/ask", json={"question": "Was there a dog?"}).json()
    assert answer["citations"] == []
    assert answer["answer"].startswith("I couldn't find anything about that")
    assert len(answer["follow_ups"]) == 3


def test_ask_with_gemini_cites_only_candidate_chunks(client, db, monkeypatch):
    case = make_indexed_case(db)
    report_page_1, report_page_2 = chunk_ids(db, "Police report.pdf")
    (statement,) = chunk_ids(db, "Statement - Anita Desai.txt")
    (other_case_chunk,) = chunk_ids(db, "Other report.pdf")
    gemini = use_gemini(
        monkeypatch,
        answer={
            "answer": " The van moved off before its light turned green, according to Anita Desai. ",
            "chunk_ids": [statement, other_case_chunk, 9999, statement, report_page_1],
            "follow_ups": ["Who called 112?", "who are the witnesses?", "", "What did the CCTV show?", "Who drove?", "Fifth?"],
        },
    )

    body = {
        "question": "When did the van move off?",
        "history": [
            {"role": "user", "content": "Who are the witnesses?"},
            {"role": "assistant", "content": "Anita Desai and Vikram Singh."},
        ],
    }
    response = client.post(f"/api/cases/{case.id}/ask", json=body)
    assert response.status_code == 200
    answer = response.json()
    assert answer["answer"] == "The van moved off before its light turned green, according to Anita Desai."
    assert [c["chunk_id"] for c in answer["citations"]] == [statement, report_page_1]
    assert answer["citations"][1]["page"] == 1
    assert answer["follow_ups"] == ["Who called 112?", "What did the CCTV show?", "Who drove?"]

    # The question is embedded with the previous turns, newest first.
    task_type, (query,) = gemini.embed_calls[0]
    assert task_type == "RETRIEVAL_QUERY"
    assert query == "When did the van move off?\n\nassistant: Anita Desai and Vikram Singh.\n\nuser: Who are the witnesses?"

    # Gemini sees this case's chunks, the conversation and the question, and must answer in JSON.
    (call,) = gemini.generate_calls
    assert call["model"] == get_settings().gemini_model
    assert call["config"].response_mime_type == "application/json"
    assert set(call["config"].response_json_schema["properties"]) == {"answer", "chunk_ids", "follow_ups"}
    prompt = call["contents"]
    assert f"[chunk {report_page_2}] Police report.pdf, page 2\n{REPORT_PAGES[1]}" in prompt
    assert f"[chunk {statement}] Statement - Anita Desai.txt\n{STATEMENT}" in prompt
    assert f"[chunk {other_case_chunk}]" not in prompt
    assert "Investigator: Who are the witnesses?\nAssistant: Anita Desai and Vikram Singh." in prompt
    assert prompt.endswith("Question: When did the van move off?")

    (run,) = db.scalars(select(AiRun)).all()
    assert (run.case_id, run.evidence_id, run.task, run.model) == (case.id, None, "answer", get_settings().gemini_model)
    assert run.output["question"] == "When did the van move off?"
    assert set(run.output["candidate_chunk_ids"]) == {report_page_1, report_page_2, statement}
    assert run.output["response"]["chunk_ids"] == [statement, other_case_chunk, 9999, statement, report_page_1]


def test_ask_with_gemini_and_no_evidence_skips_the_call(client, db, monkeypatch):
    case = make_case(db)
    gemini = use_gemini(monkeypatch, answer={"answer": "x", "chunk_ids": [], "follow_ups": []})
    answer = client.post(f"/api/cases/{case.id}/ask", json={"question": "What happened?"}).json()
    assert answer["citations"] == []
    assert answer["answer"].startswith("I couldn't find anything about that")
    assert gemini.generate_calls == []


def test_ask_when_gemini_fails(client, db, monkeypatch):
    case = make_indexed_case(db)
    use_gemini(monkeypatch, answer=RuntimeError("quota exceeded"))
    response = client.post(f"/api/cases/{case.id}/ask", json={"question": "When did the van move off?"})
    assert response.status_code == 503
    assert response.json() == {"detail": "The AI service is unavailable. Try again in a moment."}
    assert db.scalars(select(AiRun)).all() == []


def test_ask_when_gemini_returns_unreadable_json(client, db, monkeypatch):
    case = make_indexed_case(db)
    use_gemini(monkeypatch, answer="Sorry, not JSON")
    response = client.post(f"/api/cases/{case.id}/ask", json={"question": "When did the van move off?"})
    assert response.status_code == 503
    # The raw output is still logged, so the failure can be traced.
    (run,) = db.scalars(select(AiRun)).all()
    assert (run.case_id, run.output["response"]) == (case.id, "Sorry, not JSON")
