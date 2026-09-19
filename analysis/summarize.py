#!/usr/bin/env python3
"""Export the manuscript tables and per-configuration benchmark statistics."""
from __future__ import annotations

import json
from pathlib import Path
import pandas as pd

from results import ROOT, RESULTS


def fmt_num(x: float, digits: int = 1) -> str:
    if pd.isna(x):
        return ""
    if abs(x - round(x)) < 1e-9:
        return f"{int(round(x))}"
    return f"{x:.{digits}f}"


def write_table2() -> None:
    df = pd.read_csv(RESULTS / "correctness.csv")
    rows = ["| Scenario group | Tests | Result |", "|---|---:|---|"]
    groups = [("Solvency (count, eligibility, condition)", [str(i) for i in range(1, 9)]),
              ("Attestation integrity (S1-S6)", [f"S{i}" for i in range(1, 7)]),
              ("Boundary and tamper (T1-T8)", [f"T{i}" for i in range(1, 9)])]
    for label, ids in groups:
        group = df[df["scenario"].astype(str).isin(ids)]
        passed = int(group["pass"].sum())
        rows.append(f"| {label} | {len(group)} | {passed}/{len(group)} Pass |")
    rows.append(f"| Total | {len(df)} | {int(df['pass'].sum())}/{len(df)} Pass |")
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


def write_performance() -> None:
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
        "Median [interquartile range] over 30 runs per configuration after three complete warmups; "
        "IQR uses the 25th and 75th percentiles with linear interpolation. "
        "All successful measurements are retained; no outlier trimming. "
        "Times include subprocess startup and backend initialization. "
        "Capacity is fixed at N=10. Means and sample standard deviations are provided in the CSV summaries."
    )
    (RESULTS / "performance_by_config.md").write_text("\n".join(rows) + "\n")
    s.to_csv(RESULTS / "bench_summary.csv", index=False)
    summarize_bench(pd.read_csv(RESULTS / "bench_baseline.csv")).to_csv(RESULTS / "bench_baseline_summary.csv", index=False)


def write_table4() -> None:
    df = pd.read_csv(RESULTS / "case_study.csv")
    rows = ["| # | Scenario | Eligible (USDm) | Supply (USDm) | Margin (USDm) | Expected | Observed | Result |",
            "|---|---|---|---|---|---|---|---|"]
    for _, r in df.iterrows():
        expected = "Accept" if r["expected"] else "Reject"
        observed = "Accept" if (r["executed"] and r["proved"] and r["verified"]) else "Reject"
        result = "Pass" if r["pass"] else "FAIL"
        rows.append(f"| {r['scenario']} | {r['name']} | {int(r['effective_total_usdm'])} | {int(r['supply_usdm'])} | {int(r['effective_total_usdm'] - r['supply_usdm']):+d} | {expected} | {observed} | {result} |")
    rows.extend(["", "Illustrative per-bank allocations, not observed historical bank balances. The March 12 rejection is conditional on the constructed policy scenario."])
    (RESULTS / "table4.md").write_text("\n".join(rows) + "\n")


def main() -> None:
    write_table2()
    write_performance()
    write_table4()
    print("Wrote table2.md, table4.md, performance_by_config.md, benchmark summaries")


if __name__ == "__main__":
    main()
