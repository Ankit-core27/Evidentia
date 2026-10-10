"""Step 2 of the pipeline: the text of an evidence file.

PDFs give one string per page from their text layer, with Gemini OCR for pages
that have none. Word files and plain text are read locally. Images go to Gemini
for OCR, and audio and video to Gemini for a transcript of their soundtrack.
Without a client, only the local readers run.
"""

import mimetypes
from dataclasses import dataclass
from pathlib import Path

import docx
import pymupdf
from docx.table import Table
from google.genai import types
from sqlalchemy.orm import Session

from app.core.storage import absolute_path
from app.models import Evidence
from app.services.ai.gemini import generate_text, log_run, media_input

DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
TEXT_TYPES = {"application/json", "application/xml"}
# Image types Gemini reads; others (TIFF scans, BMP, GIF) are converted to PNG first.
GEMINI_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"}
OCR_DPI = 200

NO_TEXT = "[no text]"
NO_SPEECH = "[no speech]"

OCR_PROMPT = (
    "Transcribe all legible text in this image exactly as written, in reading order. "
    "Keep line breaks, and put a blank line between separate blocks of text. "
    "Don't describe the image, translate or correct anything. "
    f"If there is no legible text, reply with exactly {NO_TEXT}"
)

TRANSCRIBE_PROMPT = (
    "Transcribe the speech in this recording word for word, in its original language. "
    "For a video, transcribe only its soundtrack. "
    'Start each speaker turn on a new paragraph as "[mm:ss] Speaker 1: words", using a name '
    "instead of the number only when the speakers say it, and put a blank line between paragraphs. "
    "Mark words you can't make out as [inaudible]. Don't summarise or describe anything. "
    f"If there is no speech, reply with exactly {NO_SPEECH}"
)


@dataclass
class Extraction:
    # One string per page for PDFs (empty for a page with no text), else one string.
    pages: list[str]
    paged: bool = False

    @property
    def text(self) -> str:
        return "\n\n".join(page for page in self.pages if page)


def file_kind(mime_type: str, file_path: str) -> tuple[str | None, str]:
    """("pdf" | "docx" | "text" | "image" | "audio" | "video" | None, MIME type),
    guessing the type from the file name when the upload didn't say."""
    mime = (mime_type or "").split(";")[0].strip().lower()
    if mime in ("", "application/octet-stream"):
        mime = mimetypes.guess_type(file_path)[0] or mime
    if mime == "application/pdf":
        return "pdf", mime
    if mime == DOCX_TYPE:
        return "docx", mime
    if mime.startswith("text/") or mime in TEXT_TYPES:
        return "text", mime
    for kind in ("image", "audio", "video"):
        if mime.startswith(f"{kind}/"):
            return kind, mime
    return None, mime


def extract_text(db: Session, evidence: Evidence, client) -> Extraction:
    """Reads the evidence's stored file. Gemini calls are logged to ai_runs."""
    if not evidence.file_path:
        return Extraction([])
    path = absolute_path(evidence.file_path)
    if not path.is_file():
        raise FileNotFoundError("The stored file is missing")

    kind, mime = file_kind(evidence.mime_type, evidence.file_path)
    if kind == "pdf":
        return Extraction(_pdf_pages(db, evidence, path, client), paged=True)
    if kind == "docx":
        return Extraction([_docx_text(path)])
    if kind == "text":
        return Extraction([_plain_text(path)])
    if client is None:
        return Extraction([])
    if kind == "image":
        return Extraction([_image_text(db, evidence, client, path, mime)])
    if kind in ("audio", "video"):
        return Extraction([_transcript(db, evidence, client, path, mime)])
    return Extraction([])


def _pdf_pages(db: Session, evidence: Evidence, path: Path, client) -> list[str]:
    pages: list[str] = []
    with pymupdf.open(path) as document:
        for number, page in enumerate(document, start=1):
            text = page.get_text().strip()
            if not text and client is not None:
                png = page.get_pixmap(dpi=OCR_DPI).tobytes("png")
                text = _ocr(db, evidence, client, types.Part.from_bytes(data=png, mime_type="image/png"), page=number)
            pages.append(text)
    return pages


def _docx_text(path: Path) -> str:
    """Paragraphs and table rows in document order, a blank line between each."""
    blocks: list[str] = []
    for block in docx.Document(str(path)).iter_inner_content():
        if isinstance(block, Table):
            for row in block.rows:
                # Merged cells repeat in row.cells; keep each text once.
                cells = dict.fromkeys(cell.text.strip() for cell in row.cells)
                blocks.append(" | ".join(cell for cell in cells if cell))
        else:
            blocks.append(block.text.strip())
    return "\n\n".join(block for block in blocks if block)


def _plain_text(path: Path) -> str:
    text = path.read_bytes().decode("utf-8-sig", errors="replace")
    return text.replace("\r\n", "\n").replace("\r", "\n").strip()


def _image_text(db: Session, evidence: Evidence, client, path: Path, mime: str) -> str:
    if mime not in GEMINI_IMAGE_TYPES:
        png = pymupdf.Pixmap(str(path)).tobytes("png")
        return _ocr(db, evidence, client, types.Part.from_bytes(data=png, mime_type="image/png"))
    with media_input(client, path, mime) as image:
        return _ocr(db, evidence, client, image)


def _ocr(db: Session, evidence: Evidence, client, image, *, page: int | None = None) -> str:
    text = generate_text(client, [image, OCR_PROMPT])
    log_run(db, "ocr", {"page": page, "text": text}, evidence_id=evidence.id, case_id=evidence.case_id)
    return "" if text.lower() == NO_TEXT else text


def _transcript(db: Session, evidence: Evidence, client, path: Path, mime: str) -> str:
    with media_input(client, path, mime) as media:
        text = generate_text(client, [media, TRANSCRIBE_PROMPT])
    log_run(db, "transcribe", {"text": text}, evidence_id=evidence.id, case_id=evidence.case_id)
    return "" if text.lower() == NO_SPEECH else text
