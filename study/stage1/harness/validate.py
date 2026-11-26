"""Checks the task set before anything is frozen. For every task:

  - the reference solution passes the visible and the hidden tests,
  - the starting state fails the hidden tests,
  - the unfinished twin passes the visible tests and fails hidden ones,
  - the twin differs from the reference,
  - `meta.json` traces every hidden test that fails on the twin to a sentence of TASK.md:
    `twin_breaks` is a list of {"rule": <text copied from TASK.md>, "tests": [<test names>]},
    each rule is found in TASK.md word for word, and the tests listed are exactly the
    hidden tests that fail on the twin,
  - TASK.md is no longer than the reviewer is shown.

A development task may have no twin; then only the reference and the start are checked.

Run: python3 study/stage1/harness/validate.py [--set tasks|dev] [--tasks a,b]
"""

from __future__ import annotations

import argparse
import re
import sys

from lib import MAX_TASK_TEXT, evaluate, load_tasks

SOURCES = {"tasks": ("benchmark", "control-eval", "new"), "dev": ("benchmark-dev",)}


def squash(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def check(task, which: str) -> tuple[list[str], str]:
    problems: list[str] = []
    for name in ("starter", "reference", "hidden"):
        if not (task.dir / name).is_dir():
            return [f"no {name}/ folder"], ""
    if not (task.dir / "starter" / f"{task.module}.py").is_file():
        problems.append(f"starter/ has no {task.module}.py")
    if not (task.dir / "starter" / "test_visible.py").is_file():
        return problems + ["starter/ has no test_visible.py"], ""
    if task.source not in SOURCES[which]:
        problems.append(f"source is {task.source!r}, expected one of {SOURCES[which]}")
    if len(task.description) > MAX_TASK_TEXT:
        problems.append(f"TASK.md is longer than the reviewer is shown ({MAX_TASK_TEXT} characters)")

    visible = evaluate(task, "reference", "visible")
    hidden = evaluate(task, "reference", "hidden")
    if not visible["ok"]:
        problems.append(f"reference fails visible tests: {', '.join(visible['failing']) or visible['output'][-300:]}")
    if not hidden["ok"]:
        problems.append(f"reference fails hidden tests: {', '.join(hidden['failing']) or hidden['output'][-300:]}")
    if evaluate(task, "starter", "hidden")["ok"]:
        problems.append("the starting state passes the hidden tests")

    note = f"visible {visible['ran']}, hidden {hidden['ran']}"
    if not task.has("twin"):
        if which == "tasks":
            problems.append("no twin/ folder")
        return problems, note + ", no twin"

    twin_visible = evaluate(task, "twin", "visible")
    twin_hidden = evaluate(task, "twin", "hidden")
    if not twin_visible["ok"]:
        problems.append(f"twin fails visible tests: {', '.join(twin_visible['failing']) or twin_visible['output'][-300:]}")
    if twin_hidden["ok"]:
        problems.append("twin passes the hidden tests")
    if twin_hidden["timed_out"]:
        problems.append("twin's hidden test run timed out")
    reference_text = (task.dir / "reference" / f"{task.module}.py").read_text()
    twin_file = task.dir / "twin" / f"{task.module}.py"
    if not twin_file.is_file():
        problems.append(f"twin/ has no {task.module}.py")
    elif twin_file.read_text() == reference_text:
        problems.append("twin is the same as the reference")
    if (task.dir / "twin" / "test_visible.py").exists() or (task.dir / "reference" / "test_visible.py").exists():
        problems.append("a version folder holds test_visible.py; the test file lives in starter/ only")

    breaks = task.meta.get("twin_breaks")
    failing = {name.split(" ")[0] for name in twin_hidden["failing"]}
    if not isinstance(breaks, list) or not breaks:
        problems.append("meta.json has no twin_breaks")
    else:
        text = squash(task.description)
        listed: set[str] = set()
        for entry in breaks:
            rule = squash(str(entry.get("rule", "")))
            if len(rule) < 15 or rule not in text:
                problems.append(f"twin_breaks rule is not text of TASK.md: {rule[:80]!r}")
            listed.update(entry.get("tests", []))
        if listed != failing:
            problems.append(f"twin_breaks lists {sorted(listed)}, the twin fails {sorted(failing)}")
    note += f", twin fails {twin_hidden['failed'] + twin_hidden['errors']} of {twin_hidden['ran']} hidden"
    return problems, note


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--set", default="tasks", choices=("tasks", "dev"))
    parser.add_argument("--tasks")
    args = parser.parse_args()
    tasks = load_tasks(args.set, args.tasks.split(",") if args.tasks else None)
    bad = 0
    for task in tasks:
        problems, note = check(task, args.set)
        bad += bool(problems)
        print(f"{'FAIL' if problems else 'ok  '} {task.id.ljust(18)} {task.source.ljust(13)} {note}")
        for problem in problems:
            print(f"       {problem}")
    print(f"{len(tasks)} tasks, {bad} with problems")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
