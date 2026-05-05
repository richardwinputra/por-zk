#!/usr/bin/env python3
"""Strip absolute machine-specific paths out of result CSVs and compiled
circuit JSONs, leaving only the repo-relative `circuit/src/main.nr:LINE:COL`
form. Run from the repo root after experiments complete.

The Noir/bb toolchain captures the absolute source-file path in two places:
  1. error messages emitted by `nargo execute`, which the TS runners persist
     into `data/results/correctness.csv` and `data/results/case_study.csv`.
  2. the `file_map` debug section of compiled circuit JSON.

Neither path affects proof generation or verification (the `bytecode` field
and the `hash` it's keyed to are unchanged); they're diagnostic only. This
script rewrites both in place to remove personally identifying information
from the published artifact.
"""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Strip any absolute prefix up through the repo root marker `/por-zk/`.
# The enclosing directory may contain spaces ("My Drive", "Research Paper"...),
# so we allow any character except newline/quote in the prefix.
ABS_PATH_RE = re.compile(r"/[^\n\"]*?/por-zk/")

# Strip the user-home prefix from nargo's local crate cache, e.g.
#   /Users/<user>/nargo/github.com/noir-lang/schnorr/v0.1.3/src/lib.nr
# becomes
#   nargo/github.com/noir-lang/schnorr/v0.1.3/src/lib.nr
NARGO_CACHE_RE = re.compile(r"(?:/Users/[^/\"\n]+|/home/[^/\"\n]+)/(\.?nargo/)")

# Catch-all: strip any remaining "/Users/<user>/" or "/home/<user>/" home prefix
# that didn't match one of the more specific rules above.
HOME_PREFIX_RE = re.compile(r"/Users/[^/\"\n]+/|/home/[^/\"\n]+/")


def scrub(text: str) -> str:
    text = ABS_PATH_RE.sub("", text)
    text = NARGO_CACHE_RE.sub(r"\1", text)
    text = HOME_PREFIX_RE.sub("", text)
    return text


def scrub_csv(path: Path) -> tuple[int, int]:
    """Return (rows_touched, total_rows)."""
    if not path.exists():
        return (0, 0)
    with path.open(newline="") as f:
        reader = csv.reader(f)
        rows = list(reader)
    if not rows:
        return (0, 0)
    header = rows[0]
    body = rows[1:]
    touched = 0
    for r in body:
        for i, cell in enumerate(r):
            new = scrub(cell)
            if new != cell:
                r[i] = new
                touched += 1
    with path.open("w", newline="") as f:
        w = csv.writer(f, quoting=csv.QUOTE_MINIMAL, lineterminator="\n")
        w.writerow(header)
        w.writerows(body)
    return (touched, len(body))


def scrub_circuit_json(path: Path) -> int:
    """Return number of file_map entries rewritten."""
    if not path.exists():
        return 0
    j = json.loads(path.read_text())
    fm = j.get("file_map")
    if not isinstance(fm, dict):
        return 0
    n = 0
    for k, entry in fm.items():
        if isinstance(entry, dict) and isinstance(entry.get("path"), str):
            new = scrub(entry["path"])
            if new != entry["path"]:
                entry["path"] = new
                n += 1
    # preserve compact serialization (these files are written without indent)
    path.write_text(json.dumps(j, separators=(",", ":")))
    return n


def main() -> int:
    targets_csv = [
        ROOT / "data" / "results" / "correctness.csv",
        ROOT / "data" / "results" / "case_study.csv",
    ]
    targets_json = [
        ROOT / "circuit" / "target" / "circuit.json",
        ROOT / "circuit_baseline" / "target" / "circuit_baseline.json",
    ]

    for p in targets_csv:
        touched, total = scrub_csv(p)
        print(f"csv  {p.relative_to(ROOT)}: {touched}/{total} rows scrubbed")
    for p in targets_json:
        n = scrub_circuit_json(p)
        print(f"json {p.relative_to(ROOT)}: {n} file_map entries scrubbed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
