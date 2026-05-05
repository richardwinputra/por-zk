#!/usr/bin/env python3
"""Compute Table 4 by joining bench.csv (policy-bound) and bench_baseline.csv (solvency-only)."""
from __future__ import annotations

import json
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / "data" / "results"


def main() -> None:
    pb = pd.read_csv(RESULTS / "bench.csv")
    bs = pd.read_csv(RESULTS / "bench_baseline.csv")
    meta_pb = json.loads((RESULTS / "circuit_meta.json").read_text())
    meta_bs = json.loads((RESULTS / "circuit_meta_baseline.json").read_text())

    pb_med = pb.groupby("config")[["prove_ms", "verify_ms", "proof_bytes"]].median()
    bs_med = bs.groupby("config")[["prove_ms", "verify_ms", "proof_bytes"]].median()
    pb_mean = pb.groupby("config")[["prove_ms", "verify_ms", "proof_bytes"]].mean()
    bs_mean = bs.groupby("config")[["prove_ms", "verify_ms", "proof_bytes"]].mean()

    # Primary statistic: median across all 150 runs per circuit
    prove_pb = pb["prove_ms"].median()
    prove_bs = bs["prove_ms"].median()
    verify_pb = pb["verify_ms"].median()
    verify_bs = bs["verify_ms"].median()
    size_pb = pb["proof_bytes"].max()
    size_bs = bs["proof_bytes"].max()
    gates_pb = meta_pb["ultra_honk_gates"]
    gates_bs = meta_bs["ultra_honk_gates"]

    # Secondary: means (sensitive to the two baseline outliers identified in summarize.py)
    prove_pb_mean = pb["prove_ms"].mean()
    prove_bs_mean = bs["prove_ms"].mean()
    verify_pb_mean = pb["verify_ms"].mean()
    verify_bs_mean = bs["verify_ms"].mean()

    rows = [
        "| Metric | Solvency-only baseline | Policy-bound circuit | Overhead (absolute) | Overhead (×) |",
        "|---|---|---|---|---|",
    ]
    rows.append(f"| Gate count (UltraHonk) | {gates_bs} | {gates_pb} | {gates_pb - gates_bs:+d} | {gates_pb / gates_bs:.2f}× |")
    rows.append(f"| Proof generation (ms, median) | {prove_bs:.1f} | {prove_pb:.1f} | {prove_pb - prove_bs:+.1f} | {prove_pb / prove_bs:.2f}× |")
    rows.append(f"| Proof size (B) | {size_bs} | {size_pb} | {size_pb - size_bs:+d} | {size_pb / size_bs:.3f}× |")
    rows.append(f"| Verification (ms, median) | {verify_bs:.1f} | {verify_pb:.1f} | {verify_pb - verify_bs:+.1f} | {verify_pb / verify_bs:.2f}× |")
    rows.append("")
    rows.append(
        f"Median across 150 repetitions per circuit (5 configurations × 30 repetitions, randomized order). "
        f"For comparison, the same metrics computed from means: prove {prove_bs_mean:.1f} → {prove_pb_mean:.1f} ms ({prove_pb_mean - prove_bs_mean:+.1f}, {prove_pb_mean / prove_bs_mean:.2f}×), "
        f"verify {verify_bs_mean:.1f} → {verify_pb_mean:.1f} ms ({verify_pb_mean - verify_bs_mean:+.1f}, {verify_pb_mean / verify_bs_mean:.2f}×). "
        f"Means for the baseline are inflated by two warm-run extrinsic interruptions (`bench_baseline.csv` cfg 2 run 5: prove 680 ms; cfg 3 run 23: prove 295 ms). "
        f"The proof-size overhead of {size_pb - size_bs} B equals exactly three additional 32-byte field elements: the policy-bound circuit exposes three Field-typed public inputs ({{h_p, auditor_pk_x, auditor_pk_y}}) absent from the baseline."
    )

    (RESULTS / "table4.md").write_text("\n".join(rows) + "\n")

    # Per-config detail for the appendix: report both medians and means
    detail = pd.concat([
        pb_med.add_prefix("policy_med_"),
        bs_med.add_prefix("baseline_med_"),
        pb_mean.add_prefix("policy_mean_"),
        bs_mean.add_prefix("baseline_mean_"),
    ], axis=1).reset_index()
    detail["prove_overhead_ms_median"] = detail["policy_med_prove_ms"] - detail["baseline_med_prove_ms"]
    detail["verify_overhead_ms_median"] = detail["policy_med_verify_ms"] - detail["baseline_med_verify_ms"]
    detail["prove_overhead_ms_mean"] = detail["policy_mean_prove_ms"] - detail["baseline_mean_prove_ms"]
    detail["verify_overhead_ms_mean"] = detail["policy_mean_verify_ms"] - detail["baseline_mean_verify_ms"]
    detail.to_csv(RESULTS / "overhead_per_config.csv", index=False)

    print("Wrote table4.md, overhead_per_config.csv")


if __name__ == "__main__":
    main()
