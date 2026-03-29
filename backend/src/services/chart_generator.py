# ============================================================
# FILE: .\backend\src\services\chart_generator.py
# ============================================================

import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import pandas as pd
import io

from datetime import datetime
from src.core.config import Config
from src.core.logger import get_logger


class ChartGenerator:
    """Generates professional QA charts from parsed test data."""

    COLORS = {
        "passed": "#4CAF50",
        "failed": "#F44336",
        "skipped": "#FF9800",
        "blocked": "#9E9E9E",
        "primary": "#e3000f",
        "secondary": "#2d2d2d",
        "background": "#f5f6f8",
        "grid": "#e0e0e0",
    }

    def __init__(self):
        self.logger = get_logger(self.__class__.__name__)
        self.output_dir = Config.OUTPUT_CHARTS_PATH
        os.makedirs(self.output_dir, exist_ok=True)

    def _apply_style(self, ax, title: str):
        """Applies consistent professional styling to a chart axis."""
        ax.set_title(title, fontsize=13, fontweight="bold", color=self.COLORS["secondary"], pad=12)
        ax.set_facecolor("#ffffff")
        ax.figure.set_facecolor(self.COLORS["background"])
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        ax.spines["left"].set_color(self.COLORS["grid"])
        ax.spines["bottom"].set_color(self.COLORS["grid"])
        ax.tick_params(colors=self.COLORS["secondary"], labelsize=9)
        ax.grid(axis="y", linestyle="--", alpha=0.4, color=self.COLORS["grid"])

    def _save_chart(self, fig, name: str, project_name: str) -> str:
        """Saves a figure to disk and returns the file path."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        clean_project = project_name.replace(" ", "_")
        filename = f"{clean_project}_{name}_{timestamp}.png"
        filepath = os.path.join(self.output_dir, filename)
        fig.savefig(filepath, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
        plt.close(fig)
        self.logger.info(f"Chart saved: {filepath}")
        return filepath

    def generate_all_charts(self, file_contents: dict[str, bytes], project_name: str, lang: str = "pl") -> list[str]:
        """
        Analyzes uploaded test data files and generates all applicable charts.

        Args:
            file_contents: Dict mapping filename to raw bytes (CSV/Excel).
            project_name: Project name for file naming.
            lang: Language for chart labels (bilingual support).

        Returns:
            List of file paths to generated chart images.
        """
        chart_paths = []
        all_dataframes = []

        for filename, content in file_contents.items():
            try:
                lower = filename.lower()
                if lower.endswith(".csv"):
                    df = pd.read_csv(io.BytesIO(content))
                elif lower.endswith((".xls", ".xlsx")):
                    df = pd.read_excel(io.BytesIO(content))
                else:
                    continue
                df.columns = [c.strip().lower() for c in df.columns]
                all_dataframes.append((filename, df))
            except Exception as e:
                self.logger.warning(f"Could not parse {filename} for charting: {e}")

        if not all_dataframes:
            self.logger.warning("No valid dataframes for chart generation")
            return []

        # Merge all dataframes for aggregate analysis
        merged = pd.concat([df for _, df in all_dataframes], ignore_index=True)

        # Chart 1: Test results distribution (donut)
        path = self._chart_test_results_donut(merged, project_name, lang)
        if path:
            chart_paths.append(path)

        # Chart 2: Status bar chart per component/module
        path = self._chart_status_by_component(merged, project_name, lang)
        if path:
            chart_paths.append(path)

        # Chart 3: Bug severity distribution
        path = self._chart_bug_severity(merged, project_name, lang)
        if path:
            chart_paths.append(path)

        # Chart 4: Test coverage horizontal bar
        path = self._chart_coverage(merged, project_name, lang)
        if path:
            chart_paths.append(path)

        return chart_paths

    def _detect_status_column(self, df: pd.DataFrame) -> str | None:
        """Tries to find a column representing test status."""
        candidates = ["status", "result", "wynik", "test_status", "test_result"]
        for col in candidates:
            if col in df.columns:
                return col
        for col in df.columns:
            unique = df[col].dropna().unique()
            if len(unique) <= 10:
                lower_vals = {str(v).lower() for v in unique}
                if lower_vals & {"pass", "passed", "fail", "failed", "skip", "skipped",
                                 "zaliczony", "niezaliczony", "pominieto"}:
                    return col
        return None

    def _normalize_status(self, val: str) -> str:
        """Normalizes status values to standard categories."""
        val = str(val).strip().lower()
        if val in ("pass", "passed", "zaliczony", "ok", "success"):
            return "Passed"
        elif val in ("fail", "failed", "niezaliczony", "error", "failure", "błąd", "blad"):
            return "Failed"
        elif val in ("skip", "skipped", "pominieto", "pominięto", "n/a"):
            return "Skipped"
        elif val in ("blocked", "zablokowany"):
            return "Blocked"
        return "Other"

    def _chart_test_results_donut(self, df: pd.DataFrame, project_name: str, lang: str) -> str | None:
        """Generates a donut chart showing pass/fail/skip distribution."""
        status_col = self._detect_status_column(df)
        if not status_col:
            self.logger.info("No status column found, skipping donut chart")
            return None

        df["_normalized_status"] = df[status_col].apply(self._normalize_status)
        counts = df["_normalized_status"].value_counts()

        if counts.empty:
            return None

        color_map = {
            "Passed": self.COLORS["passed"],
            "Failed": self.COLORS["failed"],
            "Skipped": self.COLORS["skipped"],
            "Blocked": self.COLORS["blocked"],
            "Other": "#607D8B",
        }
        colors = [color_map.get(s, "#607D8B") for s in counts.index]

        title = "Rozkład wyników testów" if lang == "pl" else "Test Results Distribution"

        fig, ax = plt.subplots(figsize=(7, 5))
        fig.set_facecolor(self.COLORS["background"])
        wedges, texts, autotexts = ax.pie(
            counts.values,
            labels=counts.index,
            autopct=lambda pct: f"{pct:.1f}%\n({int(round(pct / 100 * sum(counts.values)))})",
            colors=colors,
            startangle=90,
            pctdistance=0.78,
            wedgeprops=dict(width=0.45, edgecolor="white", linewidth=2),
        )
        for t in autotexts:
            t.set_fontsize(9)
            t.set_fontweight("bold")
        for t in texts:
            t.set_fontsize(10)

        total = sum(counts.values)
        ax.text(0, 0, f"{total}", ha="center", va="center", fontsize=22,
                fontweight="bold", color=self.COLORS["secondary"])
        label = "testów" if lang == "pl" else "tests"
        ax.text(0, -0.12, label, ha="center", va="center", fontsize=10,
                color=self.COLORS["secondary"])

        ax.set_title(title, fontsize=13, fontweight="bold", color=self.COLORS["secondary"], pad=16)

        return self._save_chart(fig, "results_donut", project_name)

    def _chart_status_by_component(self, df: pd.DataFrame, project_name: str, lang: str) -> str | None:
        """Generates a stacked bar chart showing test status per component/module."""
        status_col = self._detect_status_column(df)
        if not status_col:
            return None

        component_col = None
        candidates = ["component", "module", "komponent", "modul", "area", "feature", "suite"]
        for col in candidates:
            if col in df.columns:
                component_col = col
                break

        if not component_col:
            self.logger.info("No component column found, skipping grouped bar chart")
            return None

        df["_normalized_status"] = df[status_col].apply(self._normalize_status)
        pivot = df.pivot_table(index=component_col, columns="_normalized_status",
                               aggfunc="size", fill_value=0)

        title = "Wyniki testów wg komponentu" if lang == "pl" else "Test Results by Component"
        color_map = {
            "Passed": self.COLORS["passed"],
            "Failed": self.COLORS["failed"],
            "Skipped": self.COLORS["skipped"],
            "Blocked": self.COLORS["blocked"],
            "Other": "#607D8B",
        }
        colors = [color_map.get(c, "#607D8B") for c in pivot.columns]

        fig, ax = plt.subplots(figsize=(9, 5))
        pivot.plot(kind="bar", stacked=True, ax=ax, color=colors, edgecolor="white", linewidth=0.5)
        self._apply_style(ax, title)
        ax.legend(loc="upper right", fontsize=9, framealpha=0.9)
        ax.set_xlabel("")
        ylabel = "Liczba testów" if lang == "pl" else "Test Count"
        ax.set_ylabel(ylabel, fontsize=10)
        ax.yaxis.set_major_locator(mticker.MaxNLocator(integer=True))
        plt.xticks(rotation=30, ha="right")
        fig.tight_layout()

        return self._save_chart(fig, "status_by_component", project_name)

    def _chart_bug_severity(self, df: pd.DataFrame, project_name: str, lang: str) -> str | None:
        """Generates a horizontal bar chart of bug counts by severity."""
        severity_col = None
        candidates = ["severity", "priority", "priorytet", "waga", "bug_severity", "poziom"]
        for col in candidates:
            if col in df.columns:
                severity_col = col
                break

        if not severity_col:
            self.logger.info("No severity column found, skipping bug severity chart")
            return None

        counts = df[severity_col].value_counts().sort_values(ascending=True)
        if counts.empty:
            return None

        title = "Błędy wg poziomu ważności" if lang == "pl" else "Bugs by Severity Level"

        severity_colors = []
        for label in counts.index:
            l_val = str(label).lower()
            if l_val in ("critical", "krytyczny", "blocker", "1"):
                severity_colors.append("#B71C1C")
            elif l_val in ("high", "wysoki", "major", "2"):
                severity_colors.append("#F44336")
            elif l_val in ("medium", "sredni", "średni", "normal", "3"):
                severity_colors.append("#FF9800")
            elif l_val in ("low", "niski", "minor", "4"):
                severity_colors.append("#4CAF50")
            else:
                severity_colors.append("#607D8B")

        fig, ax = plt.subplots(figsize=(8, max(4, len(counts) * 0.7)))
        bars = ax.barh(counts.index.astype(str), counts.values, color=severity_colors,
                       edgecolor="white", height=0.6)
        self._apply_style(ax, title)
        ax.grid(axis="x", linestyle="--", alpha=0.4, color=self.COLORS["grid"])
        ax.grid(axis="y", visible=False)
        ax.xaxis.set_major_locator(mticker.MaxNLocator(integer=True))

        for bar, val in zip(bars, counts.values):
            ax.text(bar.get_width() + 0.3, bar.get_y() + bar.get_height() / 2,
                    str(val), va="center", fontsize=10, fontweight="bold",
                    color=self.COLORS["secondary"])

        xlabel = "Liczba błędów" if lang == "pl" else "Bug Count"
        ax.set_xlabel(xlabel, fontsize=10)
        fig.tight_layout()

        return self._save_chart(fig, "bug_severity", project_name)

    def _chart_coverage(self, df: pd.DataFrame, project_name: str, lang: str) -> str | None:
        """Generates a horizontal bar chart showing test coverage percentage by module."""
        coverage_col = None
        candidates = ["coverage", "pokrycie", "test_coverage", "coverage_%", "pokrycie_%"]
        for col in candidates:
            if col in df.columns:
                coverage_col = col
                break

        if not coverage_col:
            return None

        component_col = None
        for col in ["component", "module", "komponent", "modul", "area", "feature"]:
            if col in df.columns:
                component_col = col
                break

        if not component_col:
            return None

        grouped = df.groupby(component_col)[coverage_col].mean().sort_values(ascending=True)
        if grouped.empty:
            return None

        title = "Pokrycie testami wg modułu" if lang == "pl" else "Test Coverage by Module"

        fig, ax = plt.subplots(figsize=(8, max(4, len(grouped) * 0.7)))
        colors = [self.COLORS["passed"] if v >= 80 else self.COLORS["failed"] for v in grouped.values]
        bars = ax.barh(grouped.index.astype(str), grouped.values, color=colors,
                       edgecolor="white", height=0.6)
        self._apply_style(ax, title)

        # Threshold line at 80%
        threshold_label = "Próg 80%" if lang == "pl" else "80% Threshold"
        ax.axvline(x=80, color=self.COLORS["primary"], linestyle="--", linewidth=1.5,
                   label=threshold_label)
        ax.legend(loc="lower right", fontsize=9)

        for bar, val in zip(bars, grouped.values):
            ax.text(bar.get_width() + 1, bar.get_y() + bar.get_height() / 2,
                    f"{val:.1f}%", va="center", fontsize=10, fontweight="bold",
                    color=self.COLORS["secondary"])

        ax.set_xlim(0, 110)
        ax.grid(axis="x", linestyle="--", alpha=0.4)
        ax.grid(axis="y", visible=False)
        xlabel = "Pokrycie (%)" if lang == "pl" else "Coverage (%)"
        ax.set_xlabel(xlabel, fontsize=10)
        fig.tight_layout()

        return self._save_chart(fig, "coverage", project_name)