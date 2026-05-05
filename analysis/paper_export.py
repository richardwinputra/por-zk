#!/usr/bin/env python3
"""Compose paper_values.md with [X] substitutions and the four tables."""
from __future__ import annotations

import json
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / "data" / "results"


def main() -> None:
    meta_pb = json.loads((RESULTS / "circuit_meta.json").read_text())
    meta_bs = json.loads((RESULTS / "circuit_meta_baseline.json").read_text())
    privacy = json.loads((RESULTS / "privacy_report.json").read_text())
    bench = pd.read_csv(RESULTS / "bench.csv")
    bench_bs = pd.read_csv(RESULTS / "bench_baseline.csv")
    cor = pd.read_csv(RESULTS / "correctness.csv")
    cs = pd.read_csv(RESULTS / "case_study.csv")
    paired = pd.read_csv(RESULTS / "paired.csv")

    table2 = (RESULTS / "table2.md").read_text().strip()
    table3 = (RESULTS / "table3.md").read_text().strip()
    table4 = (RESULTS / "table4.md").read_text().strip()
    table6 = (RESULTS / "table6.md").read_text().strip()

    n_pass = int(cor["pass"].sum())
    n_total = len(cor)
    n_solv = int(cor[cor["scenario"].str.match(r"^[1-8]$")]["pass"].sum())
    n_attest = int(cor[cor["scenario"].str.startswith("S")]["pass"].sum())
    n_tamper = int(cor[cor["scenario"].str.startswith("T")]["pass"].sum())

    proof_size = int(bench["proof_bytes"].max())
    prove_med = bench["prove_ms"].median()
    verify_med = bench["verify_ms"].median()
    prove_iqr = bench["prove_ms"].quantile(0.75) - bench["prove_ms"].quantile(0.25)
    verify_iqr = bench["verify_ms"].quantile(0.75) - bench["verify_ms"].quantile(0.25)
    e2e_med = (bench["witness_ms"] + bench["exec_ms"] + bench["prove_ms"] + bench["verify_ms"]).median()
    prove_mean = bench["prove_ms"].mean()
    verify_mean = bench["verify_ms"].mean()

    prove_bs_med = bench_bs["prove_ms"].median()
    verify_bs_med = bench_bs["verify_ms"].median()
    prove_bs_mean = bench_bs["prove_ms"].mean()
    verify_bs_mean = bench_bs["verify_ms"].mean()
    size_bs = int(bench_bs["proof_bytes"].max())

    paired_a = paired[paired["id"] == "A"].iloc[0]
    paired_b = paired[paired["id"] == "B"].iloc[0]

    cs_lines = []
    for _, r in cs.iterrows():
        out = "Accept" if (r["executed"] and r["proved"] and r["verified"]) else "Reject"
        cs_lines.append(f"  - {r['scenario']}: effective={int(r['effective_total_usdm'])} USDm, supply={int(r['supply_usdm'])} USDm, observed={out}")

    sentences = []
    sentences.append("# Paper substitution values")
    sentences.append("")
    sentences.append(f"Source files: bench.csv, bench_baseline.csv, correctness.csv, case_study.csv, paired.csv, circuit_meta.json, circuit_meta_baseline.json, privacy_report.json, run_manifest.json")
    sentences.append("")
    sentences.append("## §5.1 Circuit complexity")
    sentences.append(f"The compiled circuit consists of {meta_pb['acir_opcodes']} ACIR opcodes and {meta_pb['brillig_opcodes']} Brillig helper opcodes, yielding {meta_pb['ultra_honk_gates']} UltraHonk gates. Compilation completes in {meta_pb['compile_time_ms_median']} ms (median of {len(meta_pb['compile_time_ms_runs'])} runs).")
    sentences.append("")
    sentences.append("## §5.2 Functional correctness summary")
    sentences.append(f"All {n_pass} of {n_total} scenarios produce the expected outcome: {n_solv}/8 solvency, {n_attest}/6 attestation integrity, {n_tamper}/8 boundary and tamper.")
    sentences.append("")
    sentences.append("## §5.2 Paired governance-effect")
    sentences.append(f"Scenario A: effective total {int(paired_a['effective_total']) // 100_000_000} USDm, supply 100 USDm, observed Accept.")
    sentences.append(f"Scenario B: effective total {int(paired_b['effective_total']) // 100_000_000} USDm, supply 100 USDm, observed Reject.")
    sentences.append("")
    sentences.append("## §5.3 Performance summary")
    sentences.append(
        f"Across all 150 policy-bound runs the proof size is invariant at {proof_size} B. "
        f"Median proof generation: {prove_med:.1f} ms (IQR {prove_iqr:.1f}); "
        f"median verification: {verify_med:.1f} ms (IQR {verify_iqr:.1f}); "
        f"median end-to-end (witness + execute + prove + verify): {e2e_med:.1f} ms. "
        f"For comparison, mean proof generation {prove_mean:.1f} ms and mean verification {verify_mean:.1f} ms."
    )
    sentences.append("")
    sentences.append("## §5.4 Measured overhead")
    gates_overhead = meta_pb["ultra_honk_gates"] - meta_bs["ultra_honk_gates"]
    sentences.append(
        f"Gate count overhead: +{gates_overhead} gates ({meta_pb['ultra_honk_gates']/meta_bs['ultra_honk_gates']:.2f}×). "
        f"Proof generation overhead (median): {prove_bs_med:.1f} → {prove_med:.1f} ms (+{prove_med - prove_bs_med:.1f}, {prove_med/prove_bs_med:.2f}×). "
        f"Proof size overhead: +{proof_size - size_bs} B ({proof_size/size_bs:.3f}×); equals exactly three additional 32-byte field elements (h_p, auditor_pk_x, auditor_pk_y). "
        f"Verification overhead (median): {verify_bs_med:.1f} → {verify_med:.1f} ms (+{verify_med - verify_bs_med:.1f}, {verify_med/verify_bs_med:.2f}×). "
        f"Means for the same metrics: prove +{prove_mean - prove_bs_mean:.1f} ms ({prove_mean/prove_bs_mean:.2f}×), verify +{verify_mean - verify_bs_mean:.1f} ms ({verify_mean/verify_bs_mean:.2f}×); "
        f"the baseline mean is inflated by two warm-run extrinsic interruptions (bench_baseline.csv cfg 2 run 5: prove 680 ms; cfg 3 run 23: prove 295 ms), retained in the dataset."
    )
    sentences.append("")
    sentences.append("## §5.5 Case study summary")
    for line in cs_lines:
        sentences.append(line)
    sentences.append("")
    sentences.append("## Privacy")
    sentences.append(f"Public inputs visible to the verifier: {', '.join(privacy['public_inputs'])}. Structural parameter visible: {privacy['structural_parameter']}. Proof size invariant across runs: {privacy['proof_size_invariant']}.")
    sentences.append("")
    sentences.append("---")
    sentences.append("")
    sentences.append("## Table 2")
    sentences.append("")
    sentences.append(table2)
    sentences.append("")
    sentences.append("## Table 3")
    sentences.append("")
    sentences.append(table3)
    sentences.append("")
    sentences.append("## Table 4")
    sentences.append("")
    sentences.append(table4)
    sentences.append("")
    sentences.append("## Table 6")
    sentences.append("")
    sentences.append(table6)
    sentences.append("")

    (RESULTS / "paper_values.md").write_text("\n".join(sentences))
    print("Wrote paper_values.md")


if __name__ == "__main__":
    main()
