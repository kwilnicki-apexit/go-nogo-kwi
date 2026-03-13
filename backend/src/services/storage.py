# storage.py

import os
import json
from datetime import datetime

from src.core.config import Config
from src.core.logger import get_logger


class StorageManager:
    def __init__(self):
        self.logger = get_logger(self.__class__.__name__)
        self.cache_dir = Config.CACHE_PATH
        self.export_dir = Config.OUTPUT_REPORTS_PATH

        os.makedirs(self.cache_dir, exist_ok=True)
        os.makedirs(self.export_dir, exist_ok=True)

    def save_to_cache(self, project_name: str, structured_data: dict):
        """
        Saves the structured report data to a project-specific JSON cache file.

        Args:
            project_name: Name of the project
            structured_data: Report data dictionary to persist
        """
        clean_name = project_name.replace(" ", "_").lower()
        filepath = os.path.join(self.cache_dir, f"{clean_name}_latest.json")
        tmp_filepath = filepath + ".tmp"

        cache_payload = {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "project_name": project_name,
            "data": structured_data
        }

        try:
            with open(tmp_filepath, "w", encoding="utf-8") as f:
                json.dump(cache_payload, f, indent=4)
            os.replace(tmp_filepath, filepath)  # atomic on most OS
            self.logger.info(f"Saved JSON cache for project: {project_name}")
        except Exception as e:
            self.logger.error(f"Failed to save JSON cache: {e}")
            if os.path.exists(tmp_filepath):
                os.remove(tmp_filepath)


    def get_latest_history(self, project_name: str) -> dict:
        """
        Retrieves the latest cached report data for a project.

        Args:
            project_name: Name of the project

        Returns:
            Cached data dictionary, or None if not found.
        """
        clean_name = project_name.replace(" ", "_").lower()
        filepath = os.path.join(self.cache_dir, f"{clean_name}_latest.json")

        if os.path.exists(filepath):
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                self.logger.error(f"Failed to read cache file {filepath}: {e}")
        return None

    def clear_cache(self, project_name: str) -> bool:
        """
        Deletes the cached report data for a project.

        Args:
            project_name: Name of the project

        Returns:
            True if the cache file was found and deleted, False otherwise.
        """
        clean_name = project_name.replace(" ", "_").lower()
        filepath = os.path.join(self.cache_dir, f"{clean_name}_latest.json")

        if os.path.exists(filepath):
            os.remove(filepath)
            self.logger.info(f"Cache deleted for project: {project_name}")
            return True

        return False