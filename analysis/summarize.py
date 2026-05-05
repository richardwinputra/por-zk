#!/usr/bin/env python3
"""Build Markdown tables 2, 3, 5 from the result CSVs."""
from __future__ import annotations

import json
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / "data" / "results"


def fmt_num(x: float, digits: int = 1) -> str:
    if pd.isna(x):
        return ""
    if abs(x - round(x)) < 1e-9:
        return f"{int(round(x))}"
    return f"{x:.{digits}f}"


def write_table2() -> None:
    df = pd.read_csv(RESULTS / "correctness.csv")
    rows = ["| # | Scenario | Expected | Observed | Result |", "|---|---|---|---|---|"]
    for _, r in df.iterrows():
        expected = "Accept" if r["expectAccept"] else "Reject"
        observed = "Accept" if (r["executed"] and r["proved"] and r["verified"]) else "Reject"
        result = "Pass" if r["pass"] else "FAIL"
        rows.append(f"| {r['scenario']} | {r['name']} | {expected} | {observed} | {result} |")
    (RESULTS / "table2.md").write_text("\n".join(rows) + "\n")


def summarize_bench(df: pd.DataFrame) -> pd.DataFrame:
    g = df.groupby("config")
    out = pd.DataFrame({
        "witness_ms_mean": g["witness_ms"].mean(),
        "witness_ms_std": g["witness_ms"].std(ddof=1),
        "witness_ms_median": g["witness_ms"].median(),
        "witness_ms_iqr": g["witness_ms"].quantile(0.75) - g["witness_ms"].quantile(0.25),
        "exec_ms_mean": g["exec_ms"].mean(),
        "exec_ms_std": g["exec_ms"].std(ddof=1),
        "exec_ms_median": g["exec_ms"].median(),
        "exec_ms_iqr": g["exec_ms"].quantile(0.75) - g["exec_ms"].quantile(0.25),
        "prove_ms_mean": g["prove_ms"].mean(),
        "prove_ms_std": g["prove_ms"].std(ddof=1),
        "prove_ms_median": g["prove_ms"].median(),
        "prove_ms_iqr": g["prove_ms"].quantile(0.75) - g["prove_ms"].quantile(0.25),
        "verify_ms_mean": g["verify_ms"].mean(),
        "verify_ms_std": g["verify_ms"].std(ddof=1),
        "verify_ms_median": g["verify_ms"].median(),
        "verify_ms_iqr": g["verify_ms"].quantile(0.75) - g["verify_ms"].quantile(0.25),
        "proof_bytes_unique": g["proof_bytes"].nunique(),
        "proof_bytes": g["proof_bytes"].max(),
    }).reset_index()
    return out


def write_table3() -> None:
    df = pd.read_csv(RESULTS / "bench.csv")
    s = summarize_bench(df)
    rows = [
        "| Accounts | Proof gen. (ms, median [IQR]) | Verification (ms, median [IQR]) | Execution (ms, median [IQR]) | Witness (ms, median [IQR]) | Proof size (B) |",
        "|---|---|---|---|---|---|",
    ]
    for _, r in s.iterrows():
        rows.append(
            f"| {int(r['config'])} | "
            f"{fmt_num(r['prove_ms_median'])} [{fmt_num(r['prove_ms_iqr'])}] | "
            f"{fmt_num(r['verify_ms_median'])} [{fmt_num(r['verify_ms_iqr'])}] | "
            f"{fmt_num(r['exec_ms_median'])} [{fmt_num(r['exec_ms_iqr'])}] | "
            f"{fmt_num(r['witness_ms_median'])} [{fmt_num(r['witness_ms_iqr'])}] | "
            f"{int(r['proof_bytes'])} |"
        )
    rows.append("")
    rows.append(
        "Reported as median [interquartile range] across 30 repetitions per configuration; mean and standard deviation are in `bench_summary.csv` for completeness. Median is reported in the table because two warm runs in `bench_baseline.csv` (cfg 2 run 5; cfg 3 run 23) experienced extrinsic OS-scheduling interruption (`prove_ms` 680 and 295, vs typical ~115); medians are unaffected, the means are inflated by ~7 ms. The outlier rows are retained in the dataset."
    )
    (RESULTS / "table3.md").write_text("\n".join(rows) + "\n")
    s.to_csv(RESULTS / "bench_summary.csv", index=False)


def write_table6() -> None:
    df = pd.read_csv(RESULTS / "case_study.csv")
    rows = ["| # | Scenario | Effective (USDm) | Supply (USDm) | Expected | Observed | Result |",
            "|---|---|---|---|---|---|---|"]
    for _, r in df.iterrows():
        expected = "Accept" if r["expected"] else "Reject"
        observed = "Accept" if (r["executed"] and r["proved"] and r["verified"]) else "Reject"
        result = "Pass" if r["pass"] else "FAIL"
        rows.append(f"| {r['scenario']} | {r['name']} | {int(r['effective_total_usdm'])} | {int(r['supply_usdm'])} | {expected} | {observed} | {result} |")
    (RESULTS / "table6.md").write_text("\n".join(rows) + "\n")


def main() -> None:
    write_table2()
    write_table3()
    write_table6()
    print("Wrote table2.md, table3.md, table6.md, bench_summary.csv")


if __name__ == "__main__":
    main()
