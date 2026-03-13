# config.py

import os
from dotenv import load_dotenv

load_dotenv()


class Config:

    LLM_API_TOKEN = os.getenv("LLM_API_TOKEN", "")
    LLM_ENDPOINT_URL = os.getenv("LLM_ENDPOINT_URL", "")
    LLM_MODEL_NAME = os.getenv("LLM_MODEL_NAME", "")
    LLM_TIMEOUT = int(os.getenv("LLM_TIMEOUT", "150"))

    KB_ENDPOINT_URL = os.getenv("KB_ENDPOINT_URL", "")
    KB_API_TOKEN = os.getenv("KB_API_TOKEN", "")
    KB_APP_NAME = os.getenv("KB_APP_NAME", "")

    HISTORY_PATH = os.getenv("HISTORY_PATH", "datasources/history")
    CURRENT_DATA_PATH = os.getenv("CURRENT_DATA_PATH", "datasources/current")
    CACHE_PATH = os.getenv("CACHE_PATH", "datasources/cache")

    OUTPUT_CHARTS_PATH = os.getenv("OUTPUT_CHARTS_PATH", "output/charts")
    OUTPUT_REPORTS_PATH = os.getenv("OUTPUT_REPORTS_PATH", "output/reports")

    SSL_VERIFY = os.getenv("SSL_VERIFY", "false").lower() == "true"