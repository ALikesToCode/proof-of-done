"""Builds the evidence of every version of the work, in both kinds, under both forms of criteria.

  harness  The harness runs the visible tests on the frozen files and records the command,
           the full output and the exit status under every criterion. The criterion about
           the provided tests also gets the SHA-256 of test_visible.py before and after.
  worker   One fixed model, with no tools, is given the task text, the criteria and the
           output of the same command, and writes the record in its own words, in the
           benchmark's evidence shape. It is not shown the code. The claim is not the
           worker's to set: it is "done" for every version, by design.

One file per version, form and kind under records/<set>/evidence/. A file that exists is
left alone, so the step can be stopped and started again.

  python3 evidence.py --set dev [--tasks a,b] [--parallel 4]
"""

from __future__ import annotations

import argparse
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from lib import (RECORDS_DIR, VERSIONS, VISIBLE_COMMAND, WORKER_MODEL, Task, ask, evaluate, extract_json, load_tasks, prompt, read_json, sha256,
                 tests_criterion, write_json)

FORMS = ("general", "specific")
KINDS = ("worker", "harness")
MAX_ATTEMPTS = 3


def evidence_path(which: str, task_id: str, version: str, form: str, kind: str) -> Path:
    return RECORDS_DIR / which / "evidence" / f"{task_id}__{version}__{form}__{kind}.json"


def harness_pieces(task: Task, criterion: str, visible: dict) -> list[dict]:
    pieces = [{
        "recordedBy": "harness",
        "kind": "test_run",
        "summary": "The harness ran the provided tests on the files as they are after the work.",
        "command": VISIBLE_COMMAND,
        "exitStatus": visible["exit"],
        "passed": visible["ran"] - visible["failed"] - visible["errors"],
        "failed": visible["failed"] + visible["errors"],
        "output": visible["output"],
    }]
    if criterion == tests_criterion():
        # The frozen versions hold no test file: the one that ran is the task's own copy.
        digest = sha256(task.dir / "starter" / "test_visible.py")
        pieces.append({
            "recordedBy": "harness",
            "kind": "file_hash",
            "summary": "SHA-256 of test_visible.py before the work and after it.",
            "before": digest,
            "after": digest,
            "unchanged": True,
        })
    return pieces


def parse_worker(answer, ids: list[str]) -> tuple[dict[str, list[dict]] | None, str]:
    """The worker's pieces by criterion, or None and the reason the record is not usable."""
    if not isinstance(answer, dict):
        return None, "no JSON object"
    pieces = answer.get("evidence")
    if not isinstance(pieces, list) or not pieces:
        return None, "no evidence list"
    by_criterion: dict[str, list[dict]] = {name: [] for name in ids}
    for piece in pieces:
        if not isinstance(piece, dict):
            return None, "a piece is not an object"
        criterion = str(piece.get("criterion", "")).strip()
        kind = str(piece.get("kind", "")).strip()
        summary, excerpt = piece.get("summary"), piece.get("excerpt")
        if criterion not in by_criterion:
            return None, f"a piece names criterion {criterion!r}"
        if kind not in ("test_run", "other"):
            return None, f"a piece has kind {kind!r}"
        if not isinstance(summary, str) or not summary.strip() or not isinstance(excerpt, str) or not excerpt.strip():
            return None, "a piece has no summary or no excerpt"
        out = {"recordedBy": "worker", "kind": kind, "summary": summary.strip()}
        if kind == "test_run":
            if not all(isinstance(piece.get(name), int) and not isinstance(piece.get(name), bool) for name in ("passed", "failed")):
                return None, "a test_run piece has no counts"
            out["passed"], out["failed"] = piece["passed"], piece["failed"]
        out["excerpt"] = excerpt.strip()
        by_criterion[criterion].append(out)
    empty = [name for name, found in by_criterion.items() if not found]
    if empty:
        return None, f"no evidence for {', '.join(empty)}"
    return by_criterion, ""


def worker_pieces(task: Task, criteria: list[str], visible: dict) -> tuple[dict[str, list[dict]] | None, dict]:
    ids = [f"c{index}" for index in range(1, len(criteria) + 1)]
    user = prompt("worker-evidence-user.txt").format(
        description=task.description.strip(),
        criteria="\n".join(f"  {name}: {text}" for name, text in zip(ids, criteria)),
        command=VISIBLE_COMMAND,
        output=visible["output"].strip(),
    )
    calls = []
    for _ in range(MAX_ATTEMPTS):
        turn = ask(WORKER_MODEL, prompt("worker-evidence-system.txt"), user)
        answer = extract_json(turn["text"]) if turn["ok"] else None
        pieces, problem = parse_worker(answer, ids) if turn["ok"] else (None, turn["error"] or "call failed")
        calls.append({"ok": pieces is not None, "problem": problem or None, "reported_model": turn["reported_model"], "input_tokens": turn["input_tokens"],
                      "output_tokens": turn["output_tokens"], "seconds": turn["seconds"], "note": (answer or {}).get("note") if isinstance(answer, dict) else None})
        if pieces is not None:
            return pieces, {"model": WORKER_MODEL, "calls": calls}
    return None, {"model": WORKER_MODEL, "calls": calls}


def build(which: str, task: Task, version: str, form: str, kind: str) -> dict:
    visible = evaluate(task, version, "visible")
    if not visible["ok"]:
        raise RuntimeError(f"{task.id} {version}: the visible tests do not pass; run validate.py")
    criteria = task.criteria(form)
    ids = [f"c{index}" for index in range(1, len(criteria) + 1)]
    worker = None
    if kind == "harness":
        by_criterion = {name: harness_pieces(task, text, visible) for name, text in zip(ids, criteria)}
    else:
        by_criterion, worker = worker_pieces(task, criteria, visible)
    return {
        "task": task.id,
        "version": version,
        "form": form,
        "kind": kind,
        "usable": by_criterion is not None,
        "criteria": [{"id": name, "text": text, "evidence": (by_criterion or {}).get(name, [])} for name, text in zip(ids, criteria)],
        "visible": {name: visible[name] for name in ("ok", "ran", "failed", "errors", "exit", "output")},
        "worker": worker,
    }


def load(which: str, task_id: str, version: str, form: str, kind: str) -> dict:
    return read_json(evidence_path(which, task_id, version, form, kind))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--set", default="dev", choices=("tasks", "dev"))
    parser.add_argument("--tasks")
    parser.add_argument("--parallel", type=int, default=4)
    args = parser.parse_args()
    if args.set == "tasks":
        from freeze import require_frozen
        require_frozen()
    tasks = load_tasks(args.set, args.tasks.split(",") if args.tasks else None)
    jobs = [(task, version, form, kind) for task in tasks for version in VERSIONS if task.has(version) for form in FORMS for kind in KINDS]
    todo = [job for job in jobs if not evidence_path(args.set, job[0].id, *job[1:]).is_file()]
    print(f"{len(todo)} evidence records to build ({len(jobs) - len(todo)} already there)")
    bad = []

    def job(item) -> None:
        task, version, form, kind = item
        record = build(args.set, task, version, form, kind)
        if not record["usable"]:
            bad.append(f"{task.id} {version} {form} {kind}: {record['worker']['calls'][-1]['problem']}")
            return
        write_json(evidence_path(args.set, task.id, version, form, kind), record)

    with ThreadPoolExecutor(max_workers=max(1, min(args.parallel, 6))) as pool:
        list(pool.map(job, todo))
    for line in bad:
        print(f"NO RECORD {line}")
    print(f"{len(todo) - len(bad)} built, {len(bad)} without a usable record")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
