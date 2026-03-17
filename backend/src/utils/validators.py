# ============================================================
# FILE: ./backend/src/utils/validators.py
# ============================================================
#
# Security: 4.5.1 — positive allowlisting for all input sources
# Security: 4.5.2 — failed validation must reject with 4xx and log the reason
# Security: 4.5.5 — single, centralised validator per input type
# Security: 4.5.6 — every rejected input is logged via the security logger
#
# Usage:
#   from src.utils.validators import validate_message
#   clean_msg = validate_message(raw_message)   # raises HTTPException on failure
# ============================================================

import re
import unicodedata
import logging

from fastapi import HTTPException

# Dedicated security logger — keeps rejection events in one place
# so they can later be piped to a SIEM / monitoring system separately
# from the general application log.
security_logger = logging.getLogger("security")

# ── Constants ────────────────────────────────────────────────

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