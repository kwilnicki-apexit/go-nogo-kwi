#!/usr/bin/env python3
"""
Pobiera 20 sportowych datasetów z Kaggle do folderu gonogo_test_suite/
Tylko CSV — bez przetwarzania, bez HTML.
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

OUTPUT_DIR = Path("./gonogo_test_suite")

DATASETS = [
    # ⚽ Football / Soccer
    "hubertsidorowicz/football-players-stats-2024-2025",
    "orkunaktas/all-football-players-stats-in-top-5-leagues-2324",
    "davidcariboo/player-scores",

    # 🏀 Basketball / NBA
    "drgilermo/nba-players-stats",
    "vivovinco/2023-2024-nba-player-stats",
    "loganlauton/nba-players-and-team-data",

    # 🏏 Cricket
    "jawadaahmed/cricket-players-performance",
    "kashishparmar02/international-cricket-players-dataset",

    # 🎾 Tennis
    "dissfya/atp-tennis-2000-2023daily-pull",
    "kalilurrahman/atp-tennis-player-ranking-dataset",

    # 🏎️ Formula 1
    "dubradave/formula-1-drivers-dataset",
    "vshreekamalesh/comprehensive-formula-1-dataset-2020-2025",

    # ⚾ Baseball / MLB
    "vivovinco/2023-mlb-player-stats",
    "joyshil0599/mlb-hitting-and-pitching-stats-through-the-years",

    # 🏒 Ice Hockey / NHL
    "alexbenzik/nhl-players-statistics",
    "camnugent/predict-nhl-player-salaries",

    # 🥊 MMA / UFC
    "asaniczka/ufc-fighters-statistics",
    "aminealibi/ufc-fights-fighters-and-events-dataset",

    # 🎮 FIFA (video game)
    "maso0dahmed/football-players-data",

    # 🏅 Olympics / All Sports
    "thesportsapi/all-sports-dataset-from-worldwide-competitions",
]


def check_kaggle():
    candidates = [Path.home() / ".kaggle" / "kaggle.json", Path("kaggle.json")]
    for p in candidates:
        if p.exists():
            print(f"✅ kaggle.json: {p}\n")
            return True
    print("❌ Brak kaggle.json!\n")
    print("Jak uzyskać klucz API Kaggle:")
    print("  1. Zaloguj się na kaggle.com")
    print("  2. Settings → API → Create New Token → pobierze się kaggle.json")
    print("  3. Zapisz do: ~/.kaggle/kaggle.json  (Linux/Mac)")
    print("              C:\\Users\\<user>\\.kaggle\\kaggle.json  (Windows)\n")
    return False


def download(dataset_slug: str, dest: Path) -> bool:
    name = dataset_slug.split("/")[1]
    target = dest / name
    target.mkdir(parents=True, exist_ok=True)

    # Sprawdź czy już pobrano
    if any(target.rglob("*.csv")):
        csv_count = len(list(target.rglob("*.csv")))
        print(f"  ↩  Już pobrano ({csv_count} CSV) — pomijam")
        return True

    result = subprocess.run(
        ["kaggle", "datasets", "download",
         "-d", dataset_slug,
         "-p", str(target),
         "--unzip"],
        capture_output=True, text=True
    )

    if result.returncode != 0:
        err = result.stderr.strip().splitlines()[-1] if result.stderr else "nieznany błąd"
        print(f"  ❌ {err}")
        return False

    csvs = list(target.rglob("*.csv"))
    print(f"  ✅ {len(csvs)} plik(ów) CSV")
    return True


def main():
    print("\n" + "═" * 55)
    print("  🏆  GO/NO-GO — Pobieranie 20 datasetów z Kaggle")
    print("═" * 55 + "\n")

    if not check_kaggle():
        sys.exit(1)

    OUTPUT_DIR.mkdir(exist_ok=True)

    ok, fail = 0, 0

    for i, slug in enumerate(DATASETS, 1):
        name = slug.split("/")[1]
        print(f"[{i:02d}/20] {name}")
        success = download(slug, OUTPUT_DIR)
        if success:
            ok += 1
        else:
            fail += 1

    print("\n" + "═" * 55)
    print(f"  ✅ Pobrano:  {ok}/20")
    print(f"  ❌ Błędy:   {fail}/20")
    print(f"  📁 Folder:  {OUTPUT_DIR.resolve()}")
    print("═" * 55 + "\n")

    # Podsumowanie zawartości
    all_csvs = list(OUTPUT_DIR.rglob("*.csv"))
    print(f"Łączna liczba plików CSV: {len(all_csvs)}")
    for csv in sorted(all_csvs):
        size_kb = csv.stat().st_size // 1024
        print(f"  {csv.relative_to(OUTPUT_DIR)}  ({size_kb} KB)")


if __name__ == "__main__":
    main()
