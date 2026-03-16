# ============================================================
# FILE: .\backend\src\core\config.py
# ============================================================

import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Central configuration loaded from environment variables."""

    LLM_API_TOKEN = os.getenv("LLM_API_TOKEN", "")
    LLM_ENDPOINT_URL = os.getenv("LLM_ENDPOINT_URL", "")
    LLM_MODEL_NAME = os.getenv("LLM_MODEL_NAME", "")
    LLM_TIMEOUT = int(os.getenv("LLM_TIMEOUT", "150"))

    PARENT_CHUNK_SIZE = int(os.getenv("PARENT_CHUNK_SIZE", "1500"))
    PARENT_CHUNK_OVERLAP = int(os.getenv("PARENT_CHUNK_OVERLAP", "200"))
    CHILD_CHUNK_SIZE = int(os.getenv("CHILD_CHUNK_SIZE", "500"))
    CHILD_CHUNK_OVERLAP = int(os.getenv("CHILD_CHUNK_OVERLAP", "80"))
    TOP_K = int(os.getenv("TOP_K", "5"))
    SCORE_THRESHOLD = float(os.getenv("SCORE_THRESHOLD", "0.3"))

    # RAG + filesystem storage paths
    BASE_DATA_PATH = os.getenv("BASE_DATA_PATH", "datasources")
    PROJECTS_PATH = os.path.join(BASE_DATA_PATH, "projects")
    CHATS_PATH = os.path.join(BASE_DATA_PATH, "chats")
    HISTORY_PATH = os.path.join(BASE_DATA_PATH, "global_history")

    # Fallback output paths — used only when chat-specific dir is not set
    OUTPUT_CHARTS_PATH = os.getenv("OUTPUT_CHARTS_PATH", "output/charts")
    OUTPUT_REPORTS_PATH = os.getenv("OUTPUT_REPORTS_PATH", "output/reports")

    SSL_VERIFY = os.getenv("SSL_VERIFY", "false").lower() == "true"