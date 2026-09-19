#!/usr/bin/env python3
"""Export the manuscript values; does not modify the manuscript."""
import json
import pandas as pd
from results import RESULTS

METRICS = ['witness_ms', 'exec_ms', 'prove_ms', 'verify_ms', 'end_to_end_ms']
def summarize(frame):
    df = frame.copy()
    df['end_to_end_ms'] = df[['witness_ms','exec_ms','prove_ms','verify_ms']].sum(axis=1)
    return {metric: {'median': float(df[metric].median()), 'q1': float(df[metric].quantile(.25)),
                     'q3': float(df[metric].quantile(.75)), 'iqr': float(df[metric].quantile(.75)-df[metric].quantile(.25)),
                     'mean': float(df[metric].mean()), 'sample_std': float(df[metric].std(ddof=1)),
                     'min': float(df[metric].min()), 'max': float(df[metric].max())} for metric in METRICS}

def main():
    policy = pd.read_csv(RESULTS/'bench.csv'); baseline = pd.read_csv(RESULTS/'bench_baseline.csv')
    meta = json.loads((RESULTS/'circuit_meta.json').read_text())
    base_meta = json.loads((RESULTS/'circuit_meta_baseline.json').read_text())
    manifest = json.loads((RESULTS/'run_manifest.json').read_text())
    summary = {'policy': summarize(policy), 'baseline': summarize(baseline),
               'runs_per_circuit': len(policy), 'proof_bytes_policy': int(policy.proof_bytes.iloc[0]),
               'proof_bytes_baseline': int(baseline.proof_bytes.iloc[0]),
               'gates_policy': meta['ultra_honk_gates'], 'gates_baseline': base_meta['ultra_honk_gates']}
    (RESULTS/'metrics.json').write_text(json.dumps(summary, indent=2)+'\n')
    p,b=summary['policy'],summary['baseline']
    cor=pd.read_csv(RESULTS/'correctness.csv'); cs=pd.read_csv(RESULTS/'case_study.csv'); v=pd.read_csv(RESULTS/'verification.csv')
    config_medians=policy.groupby('config').prove_ms.median()
    lines=['# ZK benchmark results', '',
      'Statistics generated from the recorded ZK experiment.', '',
      '## Configuration and scope', '',
      f"Barretenberg {manifest['bb_version']}, Noir {manifest['nargo_version']}, `ultra_honk --oracle_hash keccak --zk`. "
      f"{len(policy)} policy runs and {len(baseline)} baseline runs, five configurations of 30 each, fixed N=10, three discarded warmups per circuit.",
      f"Environment: {manifest['machine']}; Darwin {manifest['os_release']}; Node {manifest['node_version']}; {manifest['memory_gb']} GB RAM.", '',
      '## Circuit complexity', '',
      f"Policy: {meta['acir_opcodes']:,} ACIR opcodes and {meta['ultra_honk_gates']:,} finalized gates. "
      f"Baseline: {base_meta['acir_opcodes']:,} ACIR opcodes and {base_meta['ultra_honk_gates']:,} finalized gates.",
      f"Median forced compilation: policy {meta['compile_time_ms_median']:.1f} ms; baseline {base_meta['compile_time_ms_median']:.1f} ms (five runs each). "
      'Gate counts exclude proof-system ZK masking overhead.', '',
      '## Correctness and verification', '',
      f"{int(cor['pass'].sum())}/{len(cor)} correctness cases; {int(cs['pass'].sum())}/{len(cs)} separate USDC cases; "
      f"{int(v['pass'].sum())}/{len(v)} verifier cases passed. Validation CSVs retain their recorded experiment provenance.", '',
      '## Performance', '',
      f"Policy proving median {p['prove_ms']['median']:.1f} ms (IQR {p['prove_ms']['iqr']:.1f}); "
      f"verification median {p['verify_ms']['median']:.1f} ms (IQR {p['verify_ms']['iqr']:.1f}); "
      f"median sum of measured stages {p['end_to_end_ms']['median']:.1f} ms. "
      f"Proof size: {summary['proof_bytes_policy']:,} bytes in every run.",
      f"Per-configuration proving medians range from {config_medians.min():.1f} to {config_medians.max():.1f} ms.", '',
      '## Interpretation limits', '',
      'Both circuits use the same ZK settings. Costs compare the whole policy/attestation layer against an unauthenticated arithmetic baseline; they do not isolate eligibility gating alone. '
      'Measurements are wall-clock subprocess times and include process startup/backend initialization. The sum of stages excludes harness cleanup/stat/CSV work. '
      'The circuits were measured sequentially on one machine, with randomized configuration order within each circuit. No analysis or tests launched for this experiment overlapped the timed measurements; other machine activity was not instrumented. '
      'All runs were retained; no outlier cause is inferred from latency alone. Medians/IQRs are descriptive, not confidence intervals. '
      'This is a fixed-N experiment, not a scaling study. '
      'Proof-size invariance is not evidence of privacy; the ZK setting supplies that property.', '']
    for title,file in [('Correctness','table2.md'),('Performance by configuration','performance_by_config.md'),('Policy-layer overhead','table3.md'),('Illustrative USDC example','table4.md')]:
        lines.extend([f'## {title}', '', (RESULTS/file).read_text().strip(), ''])
    (RESULTS/'paper_values.md').write_text('\n'.join(lines))
    print('Wrote metrics.json and paper_values.md')
if __name__=='__main__': main()
