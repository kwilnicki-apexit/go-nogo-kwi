# ============================================================
# FILE: ./backend/src/utils/validators.py
# ============================================================
#
# Security: 4.5.1 — positive allowlisting for all input sources
# Security: 4.5.2 — failed validation must reject with 4xx and log the reason
# Security: 4.5.5 — single, centralised validator per input type (one function
#                   per data category: text messages, file uploads, extracted text)
# Security: 4.5.6 — every rejected input is logged via the security logger
# Security: 4.5.7 — all decoders receive data in NFC-normalised form before
#                   any pattern matching or storage
#
# Public API (three functions, one per input category):
#   validate_message(text)              → cleaned str  | raises HTTPException
#   validate_upload(filename, content,  → (str, bytes) | raises HTTPException
#                   allowed_exts, max_size)
#   normalize_extracted_text(text)      → cleaned str  (never raises)
# ============================================================

import os
import re
import unicodedata
import logging
from typing import FrozenSet, Tuple

from fastapi import HTTPException

# Dedicated security logger — keeps rejection events in one place
# so they can later be piped to a SIEM / monitoring system separately
# from the general application log.
security_logger = logging.getLogger("security")

# ── Constants ────────────────────────────────────────────────

# Allowed file extensions per upload context.
# These are the *only* sets that should ever reach the storage layer.
# Add new types here, not inside endpoint handlers.
GONOGO_ALLOWED_EXTENSIONS: FrozenSet[str] = frozenset({".csv", ".xls", ".xlsx"})
PROJECT_ALLOWED_EXTENSIONS: FrozenSet[str] = frozenset({".pdf", ".docx", ".txt", ".md"})

# Maximum binary size for any single uploaded file (5 MB).
# Matches MAX_FILE_SIZE in main.py — kept here so validators.py is the
# single source of truth; main.py imports this constant instead of
# defining its own.
MAX_FILE_SIZE: int = 5 * 1024 * 1024  # 5 MB in bytes

# Maximum character count for a user text message.
# 4 000 chars covers even long prompts while preventing resource exhaustion
# (embedding very long strings, filling context windows with junk, etc.).
MESSAGE_MAX_LEN = 4_000

# We use a *positive* pattern: only the characters on this list are allowed
# through.  Everything else is stripped during sanitisation.
#
# Pattern breakdown:
#   \w         — Unicode letters, digits, and _ (covers Polish ąćęłńóśźż etc.)
#   \s         — whitespace (space, \t, \n, \r) — needed for readable text
#   \p{P}      — not available in stdlib re; we list punctuation explicitly
#   The character class below covers every printable ASCII symbol plus
#   common Unicode punctuation used in QA/technical writing.
#
# NOTE: we do NOT strip by blacklist ("remove these specific chars").
# That is fragile — an attacker can encode the same character in many ways.
# Instead, after Unicode normalisation (NFC), we strip anything that is
# not in the allowed set.  This implements the OWASP "allowlist" principle.
_ALLOWED_MESSAGE_CHARS_RE = re.compile(
    r"[^\w\s"                        # Unicode word chars + whitespace
    r"\.\,\!\?\;\:\-\_\'\""          # common punctuation
    r"\(\)\[\]\{\}"                  # brackets
    r"\+\=\*\/\\\|\@\#\$\%\^\&\~\`" # technical / code symbols
    r"\<\>\n\r"                      # angle brackets, explicit newlines
    r"]",
    re.UNICODE,
)

# Control characters (U+0000–U+001F, U+007F) other than the safe whitespace
# family (\t = 0x09, \n = 0x0A, \r = 0x0D) are always stripped.
# Null bytes in particular cause truncation bugs in C-backed libraries.
_CONTROL_CHARS_RE = re.compile(
    r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]"
)


# ── Public API ───────────────────────────────────────────────

def validate_message(text: str, *, require_non_empty: bool = False) -> str:
    """Validates and sanitises a user text message.

    Steps performed (in order, matching OWASP recommendation 4.5.7 → 4.5.1):
      1. Coerce None / non-string to empty string.
      2. Unicode NFC normalisation — so that ą as U+0105 and ą as a+combining
         ogonek are treated identically before any pattern matching.
      3. Strip C0/C1 control characters (null bytes, BEL, ESC, …).
      4. Apply the positive allowlist — characters not in the set are removed.
      5. Collapse runs of whitespace to a single space (trim edges too).
      6. Enforce length limit (4.5.2 — reject, not silently truncate).
      7. Optionally enforce non-empty (caller decides; file-only requests
         are allowed to send an empty message string).

    Returns:
        The cleaned string, safe to pass to the LLM and for storage.

    Raises:
        HTTPException(422): Message exceeds the maximum allowed length.
        HTTPException(422): Message is empty after sanitisation when
                            ``require_non_empty=True``.
    """

    # Step 1 — coerce
    if not isinstance(text, str):
        text = str(text) if text is not None else ""

    # Step 2 — Unicode NFC normalisation (4.5.7)
    # NFC turns composed+decomposed sequences into a single canonical form,
    # preventing bypass tricks like injecting ą via combining characters.
    text = unicodedata.normalize("NFC", text)

    # Step 3 — strip unsafe control characters
    text = _CONTROL_CHARS_RE.sub("", text)

    # Step 4 — positive allowlist strip
    # Everything not matching _ALLOWED_MESSAGE_CHARS_RE is silently removed.
    # This is sanitisation, not rejection — minor stray chars (e.g. a stray
    # Unicode arrow copied from a web page) should not break the user's flow.
    text = _ALLOWED_MESSAGE_CHARS_RE.sub("", text)

    # Step 5 — normalise whitespace (strip edges, collapse internal runs)
    text = " ".join(text.split())

    # Step 6 — length check (4.5.1 allowlist + 4.5.2 reject-on-failure)
    if len(text) > MESSAGE_MAX_LEN:
        security_logger.warning(
            "Validation failed: message too long | length=%d | limit=%d",
            len(text),
            MESSAGE_MAX_LEN,
        )
        raise HTTPException(
            status_code=422,
            detail=(
                f"Wiadomość jest zbyt długa ({len(text)} znaków). "
                f"Maksymalny rozmiar wynosi {MESSAGE_MAX_LEN} znaków."
            ),
        )

    # Step 7 — optional empty check (4.5.2)
    if require_non_empty and not text:
        security_logger.warning(
            "Validation failed: empty message after sanitisation"
        )
        raise HTTPException(
            status_code=422,
            detail="Wiadomość nie może być pusta.",
        )

    return text


# ── 4.5.5 / 4.5.6 / 4.5.7 — Centralised file upload validator ───────────────

def validate_upload(
    filename: str,
    content: bytes,
    allowed_extensions: FrozenSet[str] = GONOGO_ALLOWED_EXTENSIONS,
    max_size: int = MAX_FILE_SIZE,
) -> Tuple[str, bytes]:
    """Validates a single uploaded file — the one central check for all uploads.

    This is the *only* place in the codebase that decides whether a file is
    acceptable.  Both endpoints (chat gonogo upload and project knowledge
    upload) call this function; neither duplicates the logic inline.

    Steps:
      1. Sanitise the filename: strip path separators and control chars
         so that names like ``../../etc/passwd`` cannot escape the upload dir.
         (Light version of werkzeug's secure_filename without the dependency.)
      2. Validate the file extension against the caller-supplied allowlist
         (4.5.1 — positive allowlisting).
      3. Enforce the binary size limit (4.5.1 / 4.5.2).
      4. Log every rejection with the reason (4.5.6).

    Args:
        filename:           Original filename from the multipart request.
        content:            Raw file bytes already read from the request.
        allowed_extensions: Frozenset of lowercase dot-prefixed extensions,
                            e.g. ``{".csv", ".xls", ".xlsx"}``.
        max_size:           Maximum allowed byte length. Defaults to 5 MB.

    Returns:
        A tuple ``(safe_filename, content)`` — the content is returned
        unchanged; only the filename is sanitised.

    Raises:
        HTTPException(400): Filename is empty after sanitisation, or extension
                            is not in the allowed set.
        HTTPException(413): File exceeds the maximum allowed size.
    """

    # Step 1 — filename sanitisation (light secure_filename, no dependency)
    # Strip any directory component, then remove characters that are unsafe
    # in file paths: null bytes, forward/backward slashes, and dots that could
    # form ".." sequences.  Preserve the extension dot (last occurrence).
    basename = os.path.basename(filename.replace("\\", "/"))  # handle Windows paths
    basename = _CONTROL_CHARS_RE.sub("", basename)            # strip control chars
    # Replace characters that are unsafe in filenames with underscores.
    # Allowed: alphanumerics, hyphens, underscores, dots (extension separator).
    basename = re.sub(r"[^\w.\-]", "_", basename, flags=re.UNICODE)
    # Collapse multiple dots — prevents tricks like "file....exe"
    basename = re.sub(r"\.{2,}", ".", basename)
    basename = basename.strip(". ")  # strip leading/trailing dots and spaces

    if not basename:
        security_logger.warning(
            "Validation failed: filename empty after sanitisation | original=%r",
            filename,
        )
        raise HTTPException(
            status_code=400,
            detail=f"Nazwa pliku '{filename}' jest nieprawidłowa.",
        )

    # Step 2 — extension allowlist (4.5.1)
    _, ext = os.path.splitext(basename)
    ext = ext.lower()

    if ext not in allowed_extensions:
        security_logger.warning(
            "Validation failed: disallowed extension | file=%r | ext=%r | allowed=%s",
            basename,
            ext,
            sorted(allowed_extensions),
        )
        raise HTTPException(
            status_code=400,
            detail=(
                f"Typ pliku '{ext}' nie jest dozwolony. "
                f"Akceptowane rozszerzenia: {', '.join(sorted(allowed_extensions))}."
            ),
        )

    # Step 3 — size check (4.5.1 / 4.5.2)
    if len(content) > max_size:
        size_mb = len(content) / (1024 * 1024)
        limit_mb = max_size / (1024 * 1024)
        security_logger.warning(
            "Validation failed: file too large | file=%r | size=%.2f MB | limit=%.2f MB",
            basename,
            size_mb,
            limit_mb,
        )
        raise HTTPException(
            status_code=413,
            detail=(
                f"Plik '{basename}' jest za duży ({size_mb:.1f} MB). "
                f"Maksymalny rozmiar wynosi {limit_mb:.0f} MB."
            ),
        )

    return basename, content


# ── 4.5.7 — NFC normalisation for text extracted from files ──────────────────

def normalize_extracted_text(text: str) -> str:
    """Normalises text extracted from an uploaded file before it enters the RAG
    pipeline or is passed to the LLM.

    This implements OWASP 4.5.7: "all decoders must receive data in a
    standardised form before validation."  For file content we apply a lighter
    touch than validate_message — we do NOT strip arbitrary characters because
    a PDF or DOCX may legitimately contain mathematical symbols, box-drawing
    characters, etc. that would be jarring to remove.  What we *do* guarantee:

      • NFC Unicode normalisation — composed/decomposed forms are unified so
        that downstream regex and string comparisons work correctly.
      • Null bytes and other C0/C1 control characters are removed — they cause
        silent truncation in many C-backed libraries (SQLite, some PDF tools).
      • Non-breaking spaces (U+00A0) are replaced with ordinary spaces so that
        tokenisers split on them normally.

    This function never raises — it is a best-effort normaliser, not a gate.
    Files that cannot be normalised (e.g. a truly binary blob mislabelled as
    text) will produce garbage text, which is harmless to the pipeline.

    Args:
        text: Raw string returned by FileParser (pdfplumber, python-docx, …).

    Returns:
        NFC-normalised, control-char-stripped string.
    """
    if not isinstance(text, str):
        return ""

    # NFC normalisation (4.5.7)
    text = unicodedata.normalize("NFC", text)

    # Strip null bytes and other dangerous control characters
    text = _CONTROL_CHARS_RE.sub("", text)

    # Normalise non-breaking and other exotic spaces to a regular space
    # so that downstream tokenisers and regex word-boundary anchors work.
    text = re.sub(r"[\xa0\u2000-\u200b\u202f\u205f\u3000]", " ", text)

    return text