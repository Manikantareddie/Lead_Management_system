"""
YottaFlex Reproducibility Verification CLI (Assessment Step 10).

Regenerates synthetic CRM datasets twice using the exact same seed (20261022)
into isolated temporary destinations, computes SHA-256 hashes for all exported
tables and format deliverables, and asserts 100% bitwise parity across runs.
"""

import hashlib
import os
import shutil
import sys
import tempfile
from pathlib import Path

# Ensure src/ is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from generator.generate import generate, DEFAULT_CONFIG
from generator.export import export_json


def compute_sha256(filepath: Path) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def count_lines(filepath: Path) -> int:
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        return sum(1 for _ in f)


def verify_reproducibility(seed: int = 20261022, verbose: bool = True) -> bool:
    tmp_base = Path(tempfile.mkdtemp(prefix="yottaflex_repro_"))
    dir1 = tmp_base / "run_1"
    dir2 = tmp_base / "run_2"
    gt1 = tmp_base / "gt_1"
    gt2 = tmp_base / "gt_2"

    try:
        config1 = dict(DEFAULT_CONFIG)
        config1["seed"] = seed
        config1["output_dir"] = str(dir1)
        config1["ground_truth_dir"] = str(gt1)

        config2 = dict(DEFAULT_CONFIG)
        config2["seed"] = seed
        config2["output_dir"] = str(dir2)
        config2["ground_truth_dir"] = str(gt2)

        if verbose:
            print(f"[*] Executing Run 1 (seed={seed})...")
        res1 = generate(config1, inject_anomalies=True)
        export_json(res1, dir1)

        if verbose:
            print(f"[*] Executing Run 2 (seed={seed})...")
        res2 = generate(config2, inject_anomalies=True)
        export_json(res2, dir2)

        files1 = sorted([p.name for p in dir1.glob("*.csv")] + [p.name for p in dir1.glob("*.json")])
        files2 = sorted([p.name for p in dir2.glob("*.csv")] + [p.name for p in dir2.glob("*.json")])

        if files1 != files2:
            print(f"[FAIL] Output file lists differ between runs: {files1} vs {files2}")
            return False

        all_matched = True
        table_rows = []

        for filename in files1:
            p1 = dir1 / filename
            p2 = dir2 / filename

            lines1 = count_lines(p1)
            lines2 = count_lines(p2)
            hash1 = compute_sha256(p1)
            hash2 = compute_sha256(p2)

            is_match = (lines1 == lines2) and (hash1 == hash2)
            if not is_match:
                all_matched = False

            table_rows.append((
                filename,
                f"{lines1:,}",
                f"{lines2:,}",
                hash1[:10] + "...",
                hash2[:10] + "...",
                "PASS" if is_match else "FAIL",
            ))

        # Check ground truth output as well
        gt_csv1 = gt1 / "exceptions.csv"
        gt_csv2 = gt2 / "exceptions.csv"
        if gt_csv1.exists() and gt_csv2.exists():
            gl1 = count_lines(gt_csv1)
            gl2 = count_lines(gt_csv2)
            gh1 = compute_sha256(gt_csv1)
            gh2 = compute_sha256(gt_csv2)
            gt_match = (gl1 == gl2) and (gh1 == gh2)
            if not gt_match:
                all_matched = False
            table_rows.append((
                "exceptions.csv (ground_truth)",
                f"{gl1:,}",
                f"{gl2:,}",
                gh1[:10] + "...",
                gh2[:10] + "...",
                "PASS" if gt_match else "FAIL",
            ))

        if verbose:
            print("\n" + "=" * 90)
            print(f" YottaFlex Step 10 Reproducibility Audit (Seed: {seed})")
            print("=" * 90)
            header = f"{'Deliverable File':<36} | {'Run 1 Lines':<12} | {'Run 2 Lines':<12} | {'SHA256 Match':<14} | {'Status'}"
            print(header)
            print("-" * 90)
            for fname, l1, l2, h1, h2, status in table_rows:
                match_str = "Identical" if status == "PASS" else "Mismatch"
                print(f"{fname:<36} | {l1:<12} | {l2:<12} | {match_str:<14} | {status}")
            print("=" * 90)

            if all_matched:
                print(f"[SUCCESS] 100% Bitwise Reproducibility Confirmed: All {len(table_rows)} files matched across seeds.\n")
            else:
                print(f"[ERROR] Non-deterministic outputs detected during verification.\n")

        return all_matched

    finally:
        shutil.rmtree(tmp_base, ignore_errors=True)


if __name__ == "__main__":
    seed_arg = int(sys.argv[1]) if len(sys.argv) > 1 else 20261022
    success = verify_reproducibility(seed=seed_arg, verbose=True)
    sys.exit(0 if success else 1)

