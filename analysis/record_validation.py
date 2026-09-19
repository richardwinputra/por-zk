"""Record the validation evidence accompanying a freshly collected experiment."""
import hashlib
import json
from results import ROOT, RESULTS, VALIDATION

if RESULTS == ROOT / 'data/results/benchmarks':
    raise ValueError('Recorded paper provenance is read-only; select a fresh experiment')
files = ['correctness.csv', 'paired.csv', 'case_study.csv', 'verification.csv', 'smoke.json']
for name in files:
    if (RESULTS/name).read_bytes() != (VALIDATION/name).read_bytes():
        raise ValueError(f'Validation evidence differs: {name}')
record = {'source': str(VALIDATION.relative_to(ROOT)) if VALIDATION.is_relative_to(ROOT) else str(VALIDATION),
          'note': 'Validation evidence collected for this experiment.',
          'sha256': {name: hashlib.sha256((RESULTS/name).read_bytes()).hexdigest() for name in files}}
(RESULTS/'validation_provenance.json').write_text(json.dumps(record, indent=2) + '\n')
print('Recorded validation provenance')
