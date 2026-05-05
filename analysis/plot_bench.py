#!/usr/bin/env python3
"""Bar chart of proof-generation time vs real-account count, with IQR error bars."""
from __future__ import annotations

from pathlib import Path
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / "data" / "results"


def main() -> None:
    df = pd.read_csv(RESULTS / "bench.csv")
    g = df.groupby("config")["prove_ms"]
    medians = g.median()
    q1 = g.quantile(0.25)
    q3 = g.quantile(0.75)
    err_low = (medians - q1).values
    err_high = (q3 - medians).values
    configs = medians.index.tolist()

    fig, ax = plt.subplots(figsize=(5.0, 3.4))
    bars = ax.bar(configs, medians.values, yerr=[err_low, err_high], capsize=4,
                  color="#4477aa", edgecolor="black", linewidth=0.6)
    ax.set_xlabel("Real-account count")
    ax.set_ylabel("Proof generation (ms)")
    ax.set_title("Proof generation time (median with IQR, n = 30)")
    ax.set_xticks(configs)
    ax.grid(axis="y", linestyle=":", alpha=0.6)
    top = (medians + (q3 - medians)).max()
    ax.set_ylim(0, top * 1.12)
    pad = top * 0.02
    for b, m, eh in zip(bars, medians.values, err_high):
        ax.text(b.get_x() + b.get_width() / 2, b.get_height() + eh + pad,
                f"{m:.0f}", ha="center", va="bottom", fontsize=8)
    plt.tight_layout()
    plt.savefig(RESULTS / "figure1.pdf", dpi=300)
    plt.savefig(RESULTS / "figure1.png", dpi=300)
    print("Wrote figure1.pdf, figure1.png")


if __name__ == "__main__":
    main()
