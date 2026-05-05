#!/usr/bin/env python3
"""Sanity-check shape and outcome consistency across result files."""
from __future__ import annotations

import json
import sys
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / "data" / "results"

EXPECTED_SCENARIOS = (
    [str(i) for i in range(1, 9)]
    + [f"S{i}" for i in range(1, 7)]
    + [f"T{i}" for i in range(1, 9)]
)


def fail(msg: str, *, errors: list[str]) -> None:
    errors.append(msg)


def main() -> int:
    errors: list[str] = []

    # correctness.csv
    cor = pd.read_csv(RESULTS / "correctness.csv")
    if list(cor["scenario"]) != EXPECTED_SCENARIOS:
        fail(f"correctness.csv: scenarios={list(cor['scenario'])} expected={EXPECTED_SCENARIOS}", errors=errors)
    if not (cor["pass"]).all():
        fail(f"correctness.csv: {(~cor['pass']).sum()} scenarios mismatched expected outcome", errors=errors)

    # bench.csv & bench_baseline.csv
    for name in ("bench.csv", "bench_baseline.csv"):
        df = pd.read_csv(RESULTS / name)
        if len(df) != 150:
            fail(f"{name}: expected 150 rows, found {len(df)}", errors=errors)
        for col in ("witness_ms", "exec_ms", "prove_ms", "verify_ms", "proof_bytes"):
            if df[col].isna().any():
                fail(f"{name}: NaN in column {col}", errors=errors)
        sizes = df["proof_bytes"].unique()
        if len(sizes) != 1:
            fail(f"{name}: proof_bytes varies across runs: {sizes}", errors=errors)

    # case_study.csv
    cs = pd.read_csv(RESULTS / "case_study.csv")
    if list(cs["scenario"]) != ["9a", "9b", "9c"]:
        fail(f"case_study.csv: unexpected scenarios {list(cs['scenario'])}", errors=errors)
    if not cs["pass"].all():
        fail(f"case_study.csv: {(~cs['pass']).sum()} scenarios mismatched expected outcome", errors=errors)

    # circuit_meta files exist
    for f in ("circuit_meta.json", "circuit_meta_baseline.json", "run_manifest.json", "table2.md",
              "table3.md", "table4.md", "table6.md", "figure1.pdf", "privacy_report.json"):
        if not (RESULTS / f).exists():
            fail(f"missing {f}", errors=errors)

    if errors:
        for e in errors:
            print("FAIL:", e)
        return 1
    print("OK: all consistency checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
