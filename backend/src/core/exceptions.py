# exceptions.py


class AppError(Exception):
    """Base exception for all application errors."""
    pass


class LLMConnectionError(AppError):
    """Raised when the LLM API is unreachable or returns a bad status."""
    pass


class DataProcessingError(AppError):
    """Raised when input files are missing, corrupted, or cannot be processed."""
    pass


class ExportError(AppError):
    """Raised when PDF/DOCX/MD export fails."""
    pass