# ============================================================
# FILE: .\backend\src\core\logger.py
# ============================================================

import logging
import sys
import contextvars

request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")


class CorrelationFilter(logging.Filter):
    """Injects the current request correlation ID into every log record."""
    def filter(self, record):
        record.request_id = request_id_var.get("-")
        return True


def get_logger(name: str) -> logging.Logger:
    """
    Creates or retrieves a logger with a standardized format including correlation ID.

    Args:
        name: Logger name, typically the class or module name.

    Returns:
        Configured logging.Logger instance.
    """
    logger = logging.getLogger(name)

    if not logger.handlers:
        logger.setLevel(logging.DEBUG)

        formatter = logging.Formatter(
            "%(asctime)s | %(levelname)-8s | %(name)s | [%(request_id)s] | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )

        # TODO: In production, replace console handler with structured logging (e.g. JSON to stdout)
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        console_handler.addFilter(CorrelationFilter())
        logger.addHandler(console_handler)

    return logger