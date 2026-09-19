"""Select recorded measurements or a separately collected experiment."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESULTS = (ROOT / os.environ.get('POR_RESULTS_DIR', 'data/results/benchmarks')).resolve()
VALIDATION = (ROOT / os.environ.get('POR_VALIDATION_DIR', 'data/results/validation')).resolve()
if RESULTS == ROOT / 'data/results' or ROOT / 'OLD' in RESULTS.parents:
    raise ValueError('Select a benchmark directory outside OLD')
