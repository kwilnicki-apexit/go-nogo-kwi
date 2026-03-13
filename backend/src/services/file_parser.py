# file_parser.py

import pandas as pd
import io
import pdfplumber

from docx import Document
from typing import Dict

from src.core.logger import get_logger


class FileParser:
    def __init__(self):
        self.logger = get_logger(self.__class__.__name__)

    def extract_test_data_from_bytes(self, file_contents: Dict[str, bytes]) -> str:
        """
        Parses test data from pre-read file bytes (CSV or Excel).

        Args:
            file_contents: Dictionary mapping filename to raw file bytes.

        Returns:
            Concatenated markdown-formatted table string of all parsed files.
        """
        extracted_data = []

        for filename, content in file_contents.items():
            lower_name = filename.lower()

            try:
                if lower_name.endswith(".csv"):
                    df = pd.read_csv(io.BytesIO(content))
                    extracted_data.append(f"### Data from file: {filename}\n" + df.to_markdown(index=False))

                elif lower_name.endswith((".xls", ".xlsx")):
                    df = pd.read_excel(io.BytesIO(content))
                    extracted_data.append(f"### Data from file: {filename}\n" + df.to_markdown(index=False))

                else:
                    self.logger.warning(f"Skipped file with unsupported extension: {filename}")

            except Exception as e:
                self.logger.error(f"Failed to parse file {filename}: {e}")

        return "\n\n".join(extracted_data)

    def extract_history_text(self, filepath: str) -> str:
        """
        Extracts plain text from a document file (PDF, DOCX, TXT, MD).

        Args:
            filepath: Absolute or relative path to the file.

        Returns:
            Extracted text content, or empty string on failure.
        """
        ext = filepath.lower().split(".")[-1]
        text_content = ""

        try:
            if ext == "pdf":
                with pdfplumber.open(filepath) as pdf:
                    text_content = "\n".join(
                        [page.extract_text() for page in pdf.pages if page.extract_text()]
                    )
            elif ext == "docx":
                doc = Document(filepath)
                text_content = "\n".join([para.text for para in doc.paragraphs])
            elif ext in ["txt", "md"]:
                with open(filepath, "r", encoding="utf-8") as f:
                    text_content = f.read()

            return text_content

        except Exception as e:
            self.logger.error(f"Failed to read history file {filepath}: {e}")
            return ""