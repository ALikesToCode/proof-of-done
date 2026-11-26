"""Scores the reviews of stage 1 and writes the tables the protocol names.

  python3 score.py --set tasks     # writes records/tasks/results.md and results.json
  python3 score.py --set dev

The unit is the task. A refusal is any review that did not accept the work, including one
with no usable answer. Shares carry 95% Wilson intervals. Differences between two cells
are paired by task: a 95% interval from resampling tasks (10,000 resamples, fixed seed)
and an exact McNemar test.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
from pathlib import Path

from lib import RECORDS_DIR, read_json, write_json

CELLS = {1: ("general", "worker"), 2: ("general", "harness"), 3: ("specific", "worker"), 4: ("specific", "harness")}
RESAMPLES = 10_000
BOOTSTRAP_SEED = 1


def wilson(k: int, n: int, z: float = 1.959964) -> tuple[float, float]:
    if n == 0:
        return (0.0, 1.0)
    p = k / n
    centre = p + z * z / (2 * n)
    spread = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return (max(0.0, (centre - spread) / (1 + z * z / n)), min(1.0, (centre + spread) / (1 + z * z / n)))


def mcnemar_exact(b: int, c: int) -> float:
    """Two-sided exact test on the discordant pairs."""
    n = b + c
    if n == 0:
        return 1.0
    tail = sum(math.comb(n, i) for i in range(min(b, c) + 1)) / 2**n
    return min(1.0, 2 * tail)


def bootstrap(values: list[float], seed: int = BOOTSTRAP_SEED, resamples: int = RESAMPLES) -> tuple[float, float]:
    """95% percentile interval of the mean of per-task values, resampling tasks."""
    if not values:
        return (float("nan"), float("nan"))
    rng = random.Random(seed)
    n = len(values)
    means = sorted(sum(rng.choices(values, k=n)) / n for _ in range(resamples))
    return (means[int(0.025 * resamples)], means[int(0.975 * resamples) - 1])


def load_reviews(which: str) -> list[dict]:
    folder = RECORDS_DIR / which / "reviews"
    return [read_json(path) for path in sorted(folder.glob("*.json"))] if folder.is_dir() else []


def refused(reviews: list[dict], version: str, cell: int) -> dict[str, int]:
    """Task id to 1 (refused) or 0 (accepted) for one version in one cell."""
    return {r["task"]: 0 if r["accepted"] else 1 for r in reviews if r["version"] == version and r["cell"] == cell}


def paired(reviews: list[dict], version: str, cell_a: int, cell_b: int) -> dict:
    """Share refused in cell_a minus share refused in cell_b, over the tasks that have both."""
    a, b = refused(reviews, version, cell_a), refused(reviews, version, cell_b)
    tasks = sorted(set(a) & set(b))
    diffs = [a[t] - b[t] for t in tasks]
    only_a = sum(1 for t in tasks if a[t] and not b[t])
    only_b = sum(1 for t in tasks if b[t] and not a[t])
    low, high = bootstrap([float(d) for d in diffs])
    n = len(tasks)
    return {
        "version": version, "cells": [cell_a, cell_b], "tasks": n,
        "refused_a": sum(a[t] for t in tasks), "refused_b": sum(b[t] for t in tasks),
        "difference_points": round(100 * sum(diffs) / n, 1) if n else None,
        "interval_points": [round(100 * low, 1), round(100 * high, 1)] if n else None,
        "refused_only_in_a": only_a, "refused_only_in_b": only_b, "mcnemar_p": mcnemar_exact(only_a, only_b),
    }


def interaction(reviews: list[dict], version: str) -> dict:
    """The effect of specific criteria under worker evidence minus the same under harness evidence."""
    cells = {cell: refused(reviews, version, cell) for cell in CELLS}
    tasks = sorted(set.intersection(*(set(values) for values in cells.values()))) if all(cells.values()) else []
    values = [float((cells[1][t] - cells[3][t]) - (cells[2][t] - cells[4][t])) for t in tasks]
    low, high = bootstrap(values)
    return {"version": version, "tasks": len(tasks), "points": round(100 * sum(values) / len(values), 1) if values else None,
            "interval_points": [round(100 * low, 1), round(100 * high, 1)] if values else None}


def score(reviews: list[dict]) -> dict:
    cells = []
    for cell, (form, kind) in CELLS.items():
        row = {"cell": cell, "criteria": form, "evidence": kind}
        for version, name in (("reference", "finished_refused"), ("twin", "twins_caught")):
            values = refused(reviews, version, cell)
            k, n = sum(values.values()), len(values)
            row[name] = {"k": k, "n": n, "share": round(k / n, 4) if n else None, "wilson": [round(x, 4) for x in wilson(k, n)]}
        mine = [r for r in reviews if r["cell"] == cell]
        calls = [call for r in mine for call in r["calls"]]
        row["reviews"] = len(mine)
        row["no_usable_answer"] = sum(1 for r in mine if not r["usable"])
        row["calls"] = len(calls)
        row["failed_calls"] = sum(1 for call in calls if not call["ok"])
        row["input_tokens_per_review"] = round(sum(call["input_tokens"] for call in calls) / len(mine)) if mine else None
        row["output_tokens_per_review"] = round(sum(call["output_tokens"] for call in calls) / len(mine)) if mine else None
        row["seconds_per_review"] = round(sum(call["seconds"] for call in calls) / len(mine), 1) if mine else None
        cells.append(row)
    main = paired(reviews, "reference", 2, 4)
    evidence_effect = paired(reviews, "reference", 1, 2)
    catch_harness = paired(reviews, "twin", 2, 4)
    catch_worker = paired(reviews, "twin", 1, 3)
    predictions = [
        {"number": 1, "text": "With harness evidence, specific criteria refuse at least 30 points less finished work than general criteria.",
         "value_points": main["difference_points"], "holds": main["difference_points"] is not None and main["difference_points"] >= 30},
        {"number": 2, "text": "Under general criteria, harness evidence refuses less finished work than worker-written evidence.",
         "value_points": evidence_effect["difference_points"], "holds": evidence_effect["difference_points"] is not None and evidence_effect["difference_points"] > 0},
        {"number": 3, "text": "Specific criteria catch at most 10 points fewer unfinished twins than general criteria (with harness evidence).",
         "value_points": catch_harness["difference_points"], "holds": catch_harness["difference_points"] is not None and catch_harness["difference_points"] <= 10},
    ]
    sources = sorted({r["source"] for r in reviews})
    by_source = {source: {cell: {version: (lambda v: [sum(v.values()), len(v)])(refused([r for r in reviews if r["source"] == source], version, cell))
                                 for version in ("reference", "twin")} for cell in CELLS} for source in sources}
    return {
        "reviews": len(reviews), "tasks": len({r["task"] for r in reviews}), "cells": cells,
        "main_comparison": main, "evidence_effect_general": evidence_effect, "evidence_effect_specific": paired(reviews, "reference", 3, 4),
        "criteria_effect_worker": paired(reviews, "reference", 1, 3),
        "catch_difference_harness": catch_harness, "catch_difference_worker": catch_worker,
        "interaction_finished": interaction(reviews, "reference"), "interaction_twins": interaction(reviews, "twin"),
        "predictions": predictions, "by_source": by_source,
    }


def share(cell: dict) -> str:
    if not cell["n"]:
        return "none"
    return f"{cell['k']} of {cell['n']} ({100 * cell['share']:.0f}%, {100 * cell['wilson'][0]:.0f} to {100 * cell['wilson'][1]:.0f})"


def pair_line(name: str, result: dict) -> str:
    if not result["tasks"]:
        return f"- **{name}:** no pairs."
    return (f"- **{name}:** {result['refused_a']} of {result['tasks']} against {result['refused_b']} of {result['tasks']}, "
            f"a difference of {result['difference_points']} points (95% interval {result['interval_points'][0]} to {result['interval_points'][1]}). "
            f"Refused only in the first: {result['refused_only_in_a']}; only in the second: {result['refused_only_in_b']}; exact McNemar p = {result['mcnemar_p']:.2g}.")


def render(result: dict, which: str) -> str:
    lines = [f"# Stage 1 results, set `{which}`", "",
             f"{result['reviews']} reviews of {result['tasks']} tasks. Shares are followed by their 95% Wilson interval.", "",
             "| Cell | Criteria | Evidence | Finished work refused | Unfinished twins caught | No usable answer | Tokens in / out per review | Seconds per review |",
             "|---|---|---|---|---|---|---|---|"]
    for row in result["cells"]:
        lines.append(f"| {row['cell']} | {row['criteria']} | {row['evidence']} | {share(row['finished_refused'])} | {share(row['twins_caught'])} | "
                     f"{row['no_usable_answer']} of {row['reviews']} | {row['input_tokens_per_review']} / {row['output_tokens_per_review']} | {row['seconds_per_review']} |")
    lines += ["", "## Main comparison", "", "Finished work refused, harness evidence: general criteria (cell 2) against specific criteria (cell 4).", "",
              pair_line("Finished work, cell 2 against cell 4", result["main_comparison"]), "",
              "Read with it: the unfinished twins caught in the same two cells.", "",
              pair_line("Twins caught, cell 2 against cell 4", result["catch_difference_harness"]), "",
              "## Other comparisons", "",
              pair_line("Finished work, general criteria, worker evidence (1) against harness evidence (2)", result["evidence_effect_general"]),
              pair_line("Finished work, specific criteria, worker evidence (3) against harness evidence (4)", result["evidence_effect_specific"]),
              pair_line("Finished work, worker evidence, general (1) against specific (3)", result["criteria_effect_worker"]),
              pair_line("Twins caught, worker evidence, general (1) against specific (3)", result["catch_difference_worker"])]
    for name, key in (("finished work refused", "interaction_finished"), ("twins caught", "interaction_twins")):
        item = result[key]
        if item["tasks"]:
            lines.append(f"- **Interaction, {name}:** the effect of specific criteria under worker evidence minus the same under harness evidence is "
                         f"{item['points']} points (95% interval {item['interval_points'][0]} to {item['interval_points'][1]}).")
    lines += ["", "## Predictions", ""]
    for item in result["predictions"]:
        lines.append(f"{item['number']}. {item['text']} Measured: {item['value_points']} points. {'Holds.' if item['holds'] else 'Does not hold.'}")
    lines += ["", "## By source of the task (not planned as a test)", "", "| Source | Cell | Finished refused | Twins caught |", "|---|---|---|---|"]
    for source, cells in result["by_source"].items():
        for cell, versions in cells.items():
            lines.append(f"| {source} | {cell} | {versions['reference'][0]} of {versions['reference'][1]} | {versions['twin'][0]} of {versions['twin'][1]} |")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--set", default="tasks", choices=("tasks", "dev"))
    args = parser.parse_args()
    reviews = load_reviews(args.set)
    if not reviews:
        print("No reviews recorded.")
        return 1
    result = score(reviews)
    folder: Path = RECORDS_DIR / args.set
    write_json(folder / "results.json", result)
    text = render(result, args.set)
    (folder / "results.md").write_text(text)
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
