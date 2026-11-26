"""Fixes the materials of stage 1 before the first review.

  python3 freeze.py            # writes study/stage1/freeze.json; refuses when one exists
  python3 freeze.py --check    # exits 1 when a file differs from the freeze

The freeze holds the SHA-256 of every file under tasks/ and prompts/ and of the harness,
the model names and the seed for the order of the reviews. evidence.py and review.py
refuse to work on the task set without a freeze that matches the files.
"""

from __future__ import annotations

import argparse
import datetime
import sys

from lib import CRITERIA_CHECK_MODEL, CRITERIA_MODEL, PROMPTS_DIR, REVIEWER_MODEL, STAGE_DIR, TASKS_DIR, WORKER_MODEL, load_tasks, read_json, sha256, write_json

FREEZE = STAGE_DIR / "freeze.json"
DEFAULT_SEED = 20261206
EXPECTED_TASKS = 48


def current_files() -> dict[str, str]:
    files = {}
    for root in (TASKS_DIR, PROMPTS_DIR, STAGE_DIR / "harness"):
        for path in sorted(root.rglob("*")):
            if path.is_file() and "__pycache__" not in path.parts:
                files[str(path.relative_to(STAGE_DIR))] = sha256(path)
    return files


def differences() -> list[str]:
    if not FREEZE.is_file():
        return ["there is no freeze.json"]
    frozen, now = read_json(FREEZE)["files"], current_files()
    out = [f"changed: {name}" for name in sorted(frozen) if name in now and now[name] != frozen[name]]
    out += [f"gone: {name}" for name in sorted(frozen) if name not in now]
    out += [f"new: {name}" for name in sorted(now) if name not in frozen]
    return out


def require_frozen() -> dict:
    found = differences()
    if found:
        raise SystemExit("The task set is not frozen, or a file differs from the freeze:\n  " + "\n  ".join(found[:20]))
    return read_json(FREEZE)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    args = parser.parse_args()
    if args.check:
        found = differences()
        print("\n".join(found) if found else "The files match the freeze.")
        return 1 if found else 0
    if FREEZE.is_file():
        print("freeze.json exists. A freeze is made once; a later change is recorded in the protocol.")
        return 1
    tasks = load_tasks("tasks")
    problems = []
    if len(tasks) != EXPECTED_TASKS:
        problems.append(f"{len(tasks)} tasks, expected {EXPECTED_TASKS}")
    for task in tasks:
        path = task.dir / "criteria.json"
        if not path.is_file():
            problems.append(f"{task.id}: no criteria.json")
        elif not read_json(path).get("clean"):
            problems.append(f"{task.id}: the criteria list is not clean")
    if problems:
        print("Not frozen:\n  " + "\n  ".join(problems))
        return 1
    write_json(FREEZE, {
        "frozen_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "seed": args.seed,
        "models": {"reviewer": REVIEWER_MODEL, "worker_evidence": WORKER_MODEL, "criteria": CRITERIA_MODEL, "criteria_check": CRITERIA_CHECK_MODEL},
        "tasks": len(tasks),
        "files": current_files(),
    })
    print(f"Frozen: {len(tasks)} tasks. Run validate.py before committing freeze.json.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
