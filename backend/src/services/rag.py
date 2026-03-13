# rag.py

import os
import json
from typing import List, Dict

from src.core.config import Config
from src.core.logger import get_logger
from src.core.exceptions import DataProcessingError


class RAGEngine:
    def __init__(self, llm_client):
        self.logger = get_logger(self.__class__.__name__)
        self.llm = llm_client
        self.history_path = Config.HISTORY_PATH

    def load_structured_rules(self, lang="pl") -> str:
        """
        Loads structured decision rules from JSON configuration.

        These are hard, deterministic rules that don't depend on LLM interpretation.
        They provide the predictable foundation for Go/No-Go decisions.

        Args:
            lang: Language code ('pl' or 'en')

        Returns:
            Formatted string of decision rules for injection into LLM prompts.
        """
        rules_path = os.path.join(self.history_path, lang, "structured_rules.json")

        if not os.path.exists(rules_path):
            self.logger.warning(f"Structured rules file not found: {rules_path}")
            return ""

        try:
            with open(rules_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            rules = data.get("rules", [])
            if not rules:
                return ""

            formatted_rules = []
            for rule in rules:
                name = rule.get(f"name_{lang}", rule.get("name_en", ""))
                desc = rule.get(f"description_{lang}", rule.get("description_en", ""))
                severity = rule.get("severity", "info").upper()
                threshold = rule.get("threshold", "")
                operator = rule.get("operator", "")
                unit = rule.get("unit", "")

                formatted_rules.append(
                    f"[{severity}] {rule['id']}: {name}\n"
                    f"  Warunek: {rule.get('field', '')} {operator} {threshold}{unit}\n"
                    f"  {desc}"
                )

            self.logger.info(f"Loaded {len(rules)} structured rules for lang: {lang}")
            return "\n\n".join(formatted_rules)

        except Exception as e:
            self.logger.error(f"Failed to load structured rules: {e}")
            return ""

    def load_history_reports(self, lang="pl") -> str:
        """
        Loads all .txt history report files from the language-specific subdirectory.

        These provide contextual examples of past decisions, supplementing
        the structured rules with real-world precedent.

        Args:
            lang: Language code ('pl' or 'en')

        Returns:
            Concatenated text content of all history report files.
        """
        dir_path = os.path.join(self.history_path, lang)
        reports_content = ""

        if not os.path.exists(dir_path):
            self.logger.warning(f"History directory not found: {dir_path}")
            return ""

        try:
            txt_files = [f for f in os.listdir(dir_path) if f.endswith(".txt")]

            for filename in sorted(txt_files):
                file_path = os.path.join(dir_path, filename)
                with open(file_path, "r", encoding="utf-8") as f:
                    reports_content += f"--- {filename} ---\n{f.read()}\n\n"

            self.logger.info(f"Loaded {len(txt_files)} history report files for lang: {lang}")
            return reports_content

        except Exception as e:
            self.logger.error(f"Failed to read history files: {e}")
            raise DataProcessingError(f"Failed to load history: {e}")

    def get_historical_context(self, lang="pl") -> str:
        """
        Builds the complete historical context by combining structured rules
        with LLM-summarized patterns from past reports.

        The structured rules provide deterministic, predictable thresholds.
        The report summaries provide contextual patterns and precedent.

        Args:
            lang: Target language for both retrieval and output.

        Returns:
            Combined context string for injection into the draft generation prompt.
        """
        self.logger.info(f"Building historical context for lang: {lang}")

        # Part 1: deterministic structured rules (always included, no LLM needed)
        structured_rules = self.load_structured_rules(lang)

        # Part 2: LLM-summarized patterns from past reports
        raw_reports = self.load_history_reports(lang)
        llm_summary = ""

        if raw_reports.strip():
            if lang == "pl":
                system_prompt = (
                    "Jestes analitykiem QA. Na podstawie podanych historycznych raportow "
                    "wyciagnij wzorce decyzyjne. Skup sie na konkretnych liczbach i progach "
                    "ktore wplywaly na decyzje GO lub NO-GO. Nie powtarzaj informacji ktore "
                    "sa juz zawarte w regulach strukturalnych."
                )
                user_prompt = (
                    f"Przeanalizuj ponizsze historyczne raporty i opisz krotko jakie wzorce "
                    f"decyzyjne z nich wynikaja. Podaj konkretne przyklady decyzji i ich "
                    f"uzasadnien.\n\nRaporty:\n{raw_reports}"
                )
            else:
                system_prompt = (
                    "You are a QA analyst. Extract decision patterns from the provided "
                    "historical reports. Focus on specific numbers and thresholds that "
                    "influenced GO or NO-GO decisions. Do not repeat information already "
                    "covered in the structural rules."
                )
                user_prompt = (
                    f"Analyze the following historical reports and briefly describe the "
                    f"decision patterns they reveal. Provide specific examples of decisions "
                    f"and their justifications.\n\nReports:\n{raw_reports}"
                )

            try:
                llm_summary = self.llm.generate_response(
                    system_prompt, user_prompt,
                    temperature=0.1, max_tokens=800
                )
            except Exception as e:
                self.logger.warning(f"LLM summary of history failed, continuing with rules only: {e}")
                llm_summary = ""

        # Combine both parts
        parts = []

        if structured_rules:
            if lang == "pl":
                parts.append(f"=== TWARDE REGULY DECYZYJNE ===\n{structured_rules}")
            else:
                parts.append(f"=== HARD DECISION RULES ===\n{structured_rules}")

        if llm_summary:
            if lang == "pl":
                parts.append(f"=== WZORCE Z HISTORYCZNYCH RAPORTOW ===\n{llm_summary}")
            else:
                parts.append(f"=== PATTERNS FROM HISTORICAL REPORTS ===\n{llm_summary}")

        if not parts:
            default = "brak danych historycznych" if lang == "pl" else "no historical data"
            return default

        return "\n\n".join(parts)

    def save_approved_report(self, project_name: str, report_data: dict, lang: str = "pl") -> str:
        """
        Saves an approved report to the history directory so it becomes part
        of the RAG context for future analyses.

        Args:
            project_name: Name of the project
            report_data: Structured report dict with summary, decision, etc.
            lang: Language code determining the target subdirectory

        Returns:
            Path to the saved history file.

        Raises:
            DataProcessingError: If the file cannot be written.
        """
        dir_path = os.path.join(self.history_path, lang)
        os.makedirs(dir_path, exist_ok=True)

        clean_name = project_name.replace(" ", "_").lower()

        # Count existing reports for this project to avoid overwrites
        existing = [f for f in os.listdir(dir_path)
                    if f.startswith(clean_name) and f.endswith(".txt")]
        version = len(existing) + 1

        filename = f"{clean_name}_v{version}.txt"
        filepath = os.path.join(dir_path, filename)

        try:
            if lang == "pl":
                content = self._format_report_for_history_pl(project_name, report_data)
            else:
                content = self._format_report_for_history_en(project_name, report_data)

            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)

            self.logger.info(f"Approved report saved to history: {filepath}")
            return filepath

        except Exception as e:
            self.logger.error(f"Failed to save report to history: {e}")
            raise DataProcessingError(f"Failed to save to history: {e}")

    def _format_report_for_history_pl(self, project_name: str, data: dict) -> str:
        return f"""RAPORT DECYZYJNY GO/NO-GO
Tytul projektu: {project_name}

PODSUMOWANIE:
{data.get('summary', 'brak')}

ANALIZA TESTOW:
{data.get('test_analysis', 'brak')}

RYZYKA:
{data.get('risks_eval', 'brak')}

DECYZJA: {data.get('decision', 'NIEZNANA')}

UZASADNIENIE:
{data.get('justification', 'brak')}
"""

    def _format_report_for_history_en(self, project_name: str, data: dict) -> str:
        return f"""GO/NO-GO DECISION REPORT
Project title: {project_name}

SUMMARY:
{data.get('summary', 'none')}

TEST ANALYSIS:
{data.get('test_analysis', 'none')}

RISKS:
{data.get('risks_eval', 'none')}

DECISION: {data.get('decision', 'UNKNOWN')}

JUSTIFICATION:
{data.get('justification', 'none')}
"""

    def update_structured_rules(self, rules: list[dict], lang: str = "pl", author: str = "system") -> str:
        """
        Updates the structured decision rules JSON file.

        Args:
            rules: List of rule dictionaries
            lang: Language code
            author: Who made the update

        Returns:
            Path to the updated rules file.
        """
        dir_path = os.path.join(self.history_path, lang)
        os.makedirs(dir_path, exist_ok=True)
        rules_path = os.path.join(dir_path, "structured_rules.json")

        from datetime import datetime

        data = {
            "version": "1.0",
            "updated": datetime.now().strftime("%Y-%m-%d"),
            "updated_by": author,
            "rules": rules,
        }

        try:
            with open(rules_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=4, ensure_ascii=False)

            self.logger.info(f"Structured rules updated: {rules_path}")
            return rules_path

        except Exception as e:
            self.logger.error(f"Failed to update structured rules: {e}")
            raise DataProcessingError(f"Failed to update rules: {e}")