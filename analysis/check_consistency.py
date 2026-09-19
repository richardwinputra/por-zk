#!/usr/bin/env python3
"""Independent stdlib checks of recorded measurements and generated summaries."""
import csv
import hashlib
import json
import math
import statistics as stats
from pathlib import Path
from results import ROOT, RESULTS, VALIDATION
from zipfile import ZipFile

STAGES = ['witness_ms','exec_ms','prove_ms','verify_ms']
def load(name):
    with (RESULTS/name).open() as f: return list(csv.DictReader(f))
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def close(a,b):
    assert math.isclose(float(a),float(b),rel_tol=1e-10,abs_tol=1e-7),(a,b)
def main():
    metrics=json.loads((RESULTS/'metrics.json').read_text())
    flags=['-s','ultra_honk','--oracle_hash','keccak','--zk']
    manifest=json.loads((RESULTS/'run_manifest.json').read_text())
    setup=json.loads((RESULTS/'setup.json').read_text())
    assert manifest['proof_configuration']['flags']==flags and setup['proof_flags']==flags
    provenance = ROOT/'data/provenance'
    source_index = json.loads((provenance/'source-index.json').read_text())
    for rel, h in source_index['active_source_sha256'].items():
        assert digest(ROOT/rel) == h, f'Active source changed: {rel}'
    with ZipFile(provenance/'measurement-sources.zip') as archived:
        for rel, h in manifest['source_sha256'].items():
            source = ROOT/rel
            if source.exists() and digest(source) == h:
                continue
            assert source_index['measured_source_sha256'].get(rel) == h, rel
            assert hashlib.sha256(archived.read(rel)).hexdigest() == h, rel
    for a in setup['artifacts']:
        compiled = ROOT/a['circuit']/'target'/f"{a['circuit']}.json"
        if digest(compiled) != a['circuit_sha256']:
            reference = json.loads((ROOT/'data/provenance/compiled-artifacts.json').read_text())
            expected = next(x for x in reference['artifacts'] if x['circuit'] == a['circuit'])
            assert expected['measured_sha256'] == a['circuit_sha256']
            data = json.loads(compiled.read_text())
            for entry in data.get('file_map', {}).values():
                entry.pop('path', None)
            normalized = hashlib.sha256(json.dumps(data, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
            assert normalized == expected['without_debug_paths_sha256'], a['circuit']
        assert digest(ROOT/a['circuit']/'target/vk-zk/vk')==a['vk_sha256']
    results={}
    for key,file,meta_file,summary_file in [('policy','bench.csv','benchmark_policy_run.json','bench_summary.csv'),('baseline','bench_baseline.csv','benchmark_baseline_run.json','bench_baseline_summary.csv')]:
        rows=load(file); run=json.loads((RESULTS/meta_file).read_text())
        assert len(rows)==150 and run['measured_runs']==150 and run['warmup_runs']==3
        assert run['proof_flags']==flags
        assert {(int(r['config']),int(r['run'])) for r in rows}=={(c,n) for c in range(1,6) for n in range(30)}
        assert [int(r['sequence']) for r in rows]==list(range(1,151))
        assert all(r['ok']=='true' and r['cold_or_warm']=='warm' for r in rows)
        for r in rows:
            for col in STAGES:
                value=float(r[col]); assert math.isfinite(value) and value>=0
                if col!='witness_ms': assert value>0
        sizes={int(r['proof_bytes']) for r in rows}; assert len(sizes)==1 and min(sizes)>0
        assert sizes=={metrics[f'proof_bytes_{key}']}
        for metric in STAGES+['end_to_end_ms']:
            values=[sum(float(r[c]) for c in STAGES) if metric=='end_to_end_ms' else float(r[metric]) for r in rows]
            q=stats.quantiles(values,n=4,method='inclusive')
            expected={'median':stats.median(values),'q1':q[0],'q3':q[2],'iqr':q[2]-q[0],'mean':stats.mean(values),'sample_std':stats.stdev(values),'min':min(values),'max':max(values)}
            for statistic,value in expected.items(): close(value,metrics[key][metric][statistic])
        per_config=load(summary_file)
        assert len(per_config)==5
        for summary in per_config:
            group=[r for r in rows if int(r['config'])==int(summary['config'])]
            assert len(group)==30
            for metric in STAGES:
                values=[float(r[metric]) for r in group]; q=stats.quantiles(values,n=4,method='inclusive')
                close(stats.median(values),summary[metric+'_median']);close(q[2]-q[0],summary[metric+'_iqr'])
                close(stats.mean(values),summary[metric+'_mean']);close(stats.stdev(values),summary[metric+'_std'])
        results[file]={'rows':len(rows),'verified':150,'unique_config_run_pairs':150,'proof_bytes':next(iter(sizes))}
    assert metrics['proof_bytes_policy']-metrics['proof_bytes_baseline']==3*32
    for key,name in [('policy','circuit_meta.json'),('baseline','circuit_meta_baseline.json')]:
        meta=json.loads((RESULTS/name).read_text());assert meta['proof_flags']==flags
        assert len(meta['compile_time_ms_runs'])==5
        close(stats.median(meta['compile_time_ms_runs']),meta['compile_time_ms_median'])
        assert meta['ultra_honk_gates']==metrics[f'gates_{key}']
    record = json.loads((RESULTS/'validation_provenance.json').read_text())
    for file, h in record['sha256'].items():
        assert digest(RESULTS/file) == h, file
    if RESULTS == ROOT/'data/results/benchmarks':
        for rel, h in source_index['measurement_data_sha256'].items():
            assert digest(ROOT/rel) == h, rel
    expected_ids=[str(i) for i in range(1,9)]+[f'S{i}' for i in range(1,7)]+[f'T{i}' for i in range(1,9)]
    correctness=load('correctness.csv'); assert [r['scenario'] for r in correctness]==expected_ids
    for file,count in [('correctness.csv',22),('paired.csv',2),('case_study.csv',3),('verification.csv',15)]:
        rows=load(file);assert len(rows)==count and all(r['pass']=='true' for r in rows)
        assert digest(RESULTS/file)==digest(VALIDATION/file)
    for r in correctness:
        if r['expectAccept']=='false': assert r['failure_reason']==r['expected_failure'] and r['failure_stage']=='execute'
    for file in ['table2.md','table3.md','table4.md','performance_by_config.md','paper_values.md','figure2.pdf','figure2.png','overhead_per_config.csv']:
        assert (RESULTS/file).stat().st_size>0,file
    for row in load('overhead_per_config.csv'):
        close(float(row['policy_med_prove_ms'])-float(row['baseline_med_prove_ms']),row['prove_overhead_ms_median'])
        close(float(row['policy_med_verify_ms'])-float(row['baseline_med_verify_ms']),row['verify_overhead_ms_median'])
    report={'assessment':'Share with noted caveats','independent_recalculation':'Python statistics median, inclusive quartiles, mean and sample standard deviation agree with pandas exports',
      'benchmarks':results,'validation_provenance_verified':True,'source_and_key_hashes_verified':True,
      'caveats':['One machine and fixed N=10; not a scaling study.','Circuits measured sequentially; between-session conditions may affect comparison.','Subprocess wall-clock timings include startup and initialization.','No outliers removed or causal explanations inferred.']}
    (RESULTS/'analysis_validation.json').write_text(json.dumps(report,indent=2)+'\n')
    print('PASS: 300 verified measurements; independent statistics, provenance, source/key hashes checked.')
if __name__=='__main__': main()
