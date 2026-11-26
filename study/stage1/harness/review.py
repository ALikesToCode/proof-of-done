"""Asks the reviewer about every version of the work in every cell.

  cell 1  general criteria,  evidence written by a worker
  cell 2  general criteria,  evidence recorded by the harness
  cell 3  specific criteria, evidence written by a worker
  cell 4  specific criteria, evidence recorded by the harness

Each review is one question in a fresh context with no tools. The reviewer sees the task
text, the criteria, the evidence under each criterion and the files as they are after the
work, and answers "proven" or "not_proven" once per criterion. The work is accepted when
every criterion is proven. Anything else is a refusal, including an answer that cannot be
read. A call that fails before the model answers is asked again, at most twice.

The order of the reviews is random, from the seed in freeze.json. A review whose file
exists is skipped.

  python3 review.py --set dev [--tasks a,b] [--parallel 4]
"""

from __future__ import annotations

import argparse
import datetime
import json
import random
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from evidence import evidence_path, load as load_evidence
from lib import RECORDS_DIR, REVIEWER_MODEL, VERSIONS, Task, ask, extract_json, load_tasks, prompt, solution_files, write_json

CELLS = {1: ("general", "worker"), 2: ("general", "harness"), 3: ("specific", "worker"), 4: ("specific", "harness")}
MAX_CALLS = 3
WORK_ITEM = "STUDY-1"


def review_path(which: str, task_id: str, version: str, cell: int) -> Path:
    return RECORDS_DIR / which / "reviews" / f"{task_id}__{version}__cell{cell}.json"


def reviewer_message(task: Task, version: str, evidence: dict) -> str:
    record = {
        "workItem": WORK_ITEM,
        "description": task.description.strip(),
        "claim": "The coding agent says this work item is done.",
        "criteria": evidence["criteria"],
    }
    ids = [criterion["id"] for criterion in evidence["criteria"]]
    files = [*solution_files(task, version), {"name": "test_visible.py", "text": (task.dir / "starter" / "test_visible.py").read_text()}]
    return "\n\n".join([
        "The record of one work item is given below. Give your answers in your reply.",
        prompt("reviewer-rules.txt"),
        f"The work item and its done contract:\n{json.dumps(record, indent=2, ensure_ascii=False)}",
        "The files of the work item as they are after the work:\n" + "\n".join(f"--- {item['name']} ---\n{item['text']}" for item in files),
        f"The contract has {len(ids)} criteria: {ids[0]} to {ids[-1]}.\n" + prompt("reviewer-answer.txt"),
    ])


def parse_answer(answer, ids: list[str]) -> list[dict] | None:
    """One decision per criterion, or None when the answer cannot be read or leaves a criterion out."""
    rows = answer.get("criteria") if isinstance(answer, dict) else None
    if not isinstance(rows, list):
        return None
    found: dict[str, dict] = {}
    for row in rows:
        if not isinstance(row, dict):
            return None
        name = str(row.get("criterion", "")).strip()
        decision = str(row.get("decision", "")).strip().lower().replace(" ", "_").replace("-", "_")
        if name not in ids or name in found or decision not in ("proven", "not_proven"):
            return None
        found[name] = {"criterion": name, "decision": decision, "reason": str(row.get("reason", "")).strip()}
    return [found[name] for name in ids] if len(found) == len(ids) else None


def review(which: str, task: Task, version: str, cell: int) -> dict:
    form, kind = CELLS[cell]
    evidence = load_evidence(which, task.id, version, form, kind)
    ids = [criterion["id"] for criterion in evidence["criteria"]]
    message = reviewer_message(task, version, evidence)
    calls, verdicts, turn = [], None, None
    for _ in range(MAX_CALLS):
        turn = ask(REVIEWER_MODEL, prompt("reviewer-system.txt"), message)
        calls.append({"ok": turn["ok"], "error": turn["error"], "input_tokens": turn["input_tokens"], "output_tokens": turn["output_tokens"],
                      "seconds": turn["seconds"], "cost_usd": turn["cost_usd"]})
        if turn["ok"]:
            verdicts = parse_answer(extract_json(turn["text"]), ids)
            break
    return {
        "task": task.id,
        "source": task.source,
        "version": version,
        "cell": cell,
        "form": form,
        "kind": kind,
        "at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "reviewer": REVIEWER_MODEL,
        "reported_model": turn["reported_model"] if turn else None,
        "answered": bool(turn and turn["ok"]),
        "usable": verdicts is not None,
        "accepted": verdicts is not None and all(row["decision"] == "proven" for row in verdicts),
        "verdicts": verdicts,
        "criteria": len(ids),
        "calls": calls,
        "answer": turn["text"][-6000:] if turn else "",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--set", default="dev", choices=("tasks", "dev"))
    parser.add_argument("--tasks")
    parser.add_argument("--parallel", type=int, default=4)
    args = parser.parse_args()
    seed = 0
    if args.set == "tasks":
        from freeze import require_frozen
        seed = require_frozen()["seed"]
    tasks = load_tasks(args.set, args.tasks.split(",") if args.tasks else None)
    jobs = [(task, version, cell) for task in tasks for version in VERSIONS if task.has(version) for cell in CELLS]
    missing = [f"{task.id} {version} cell {cell}" for task, version, cell in jobs if not evidence_path(args.set, task.id, version, *CELLS[cell]).is_file()]
    if missing:
        print(f"{len(missing)} reviews have no evidence record yet, for example {missing[0]}. Run evidence.py first.")
        return 1
    random.Random(seed).shuffle(jobs)
    todo = [job for job in jobs if not review_path(args.set, job[0].id, job[1], job[2]).is_file()]
    print(f"{len(todo)} reviews to ask ({len(jobs) - len(todo)} already recorded), seed {seed}")
    done = [0]

    def job(item) -> None:
        task, version, cell = item
        record = review(args.set, task, version, cell)
        write_json(review_path(args.set, task.id, version, cell), record)
        done[0] += 1
        if done[0] % 20 == 0 or not record["usable"]:
            state = "accepted" if record["accepted"] else "refused" if record["usable"] else "no usable answer"
            print(f"{done[0]}/{len(todo)} {task.id} {version} cell {cell}: {state}")

    with ThreadPoolExecutor(max_workers=max(1, min(args.parallel, 6))) as pool:
        list(pool.map(job, todo))
    print("finished")
    return 0


if __name__ == "__main__":
    sys.exit(main())
