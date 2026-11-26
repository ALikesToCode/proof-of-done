"""Writes the specific criteria of each task and checks them against the task text.

One fixed model is given TASK.md and nothing else, and writes one criterion per rule.
The line about the provided tests is added after its list. A second model compares the
list with the task text and reports what is missing, added or changed. A list with a
mismatch is written again, with the report, at most twice. The result goes to
<task>/criteria.json, with every attempt kept.

  python3 criteria.py --set dev                 # write lists that do not exist yet
  python3 criteria.py --set tasks --tasks a,b --force
  python3 criteria.py --set tasks --recheck     # run the checker again on the lists as they are (after a hand edit)

A list that is still not clean after three attempts is written with "clean": false and
is fixed by hand before the freeze.
"""

from __future__ import annotations

import argparse
import json
from concurrent.futures import ThreadPoolExecutor

from lib import CRITERIA_CHECK_MODEL, CRITERIA_MODEL, Task, ask, extract_json, load_tasks, prompt, tests_criterion, write_json

MAX_ATTEMPTS = 3
FINDINGS = ("missing", "added", "changed")


def parse_criteria(answer) -> list[str] | None:
    items = answer.get("criteria") if isinstance(answer, dict) else None
    if not isinstance(items, list) or not 1 <= len(items) <= 30:
        return None
    rules = [item.strip() for item in items if isinstance(item, str) and item.strip()]
    return rules if len(rules) == len(items) else None


def parse_check(answer) -> dict | None:
    if not isinstance(answer, dict):
        return None
    out = {}
    for name in FINDINGS:
        value = answer.get(name, [])
        if not isinstance(value, list):
            return None
        out[name] = [str(item) for item in value if str(item).strip()]
    return out


def numbered(criteria: list[str]) -> str:
    return "\n".join(f"  c{index}: {text}" for index, text in enumerate(criteria, start=1))


def check_list(task: Task, criteria: list[str]) -> dict:
    user = f"The description of the task:\n\n{task.description}\n\nThe criteria:\n{numbered(criteria)}"
    turn = ask(CRITERIA_CHECK_MODEL, prompt("criteria-checker.txt"), user)
    findings = parse_check(extract_json(turn["text"])) if turn["ok"] else None
    out = {"ok": findings is not None, "findings": findings, "error": turn["error"], "reported_model": turn["reported_model"]}
    if findings is None:
        out["answer"] = turn["text"][-2000:]
    return out


def write_list(task: Task) -> dict:
    history = []
    report = None
    for _ in range(MAX_ATTEMPTS):
        user = f"The description of the task (the code goes in {task.module}.py):\n\n{task.description}"
        if report:
            user += (
                "\n\nAn earlier list for this description was checked against it, and these mismatches were found. "
                f"Write the whole list again without them.\n{json.dumps(report, indent=2, ensure_ascii=False)}"
            )
        turn = ask(CRITERIA_MODEL, prompt("criteria-writer.txt"), user)
        rules = parse_criteria(extract_json(turn["text"])) if turn["ok"] else None
        if rules is None:
            history.append({"criteria": None, "error": turn["error"] or "no usable list", "answer": turn["text"][-2000:], "check": None})
            continue
        criteria = [*rules, tests_criterion()]
        check = check_list(task, criteria)
        history.append({"criteria": criteria, "reported_model": turn["reported_model"], "check": check})
        if check["ok"] and not any(check["findings"].values()):
            break
        report = check["findings"] if check["ok"] else None
    usable = [entry for entry in history if entry["criteria"]]
    last = usable[-1] if usable else None
    return {
        "task": task.id,
        "criteria": last["criteria"] if last else [],
        "clean": bool(last and last["check"]["ok"] and not any(last["check"]["findings"].values())),
        "written_by": CRITERIA_MODEL,
        "checked_by": CRITERIA_CHECK_MODEL,
        "edited_by_hand": False,
        "attempts": len(history),
        "history": history,
    }


def recheck(task: Task) -> dict:
    record = json.loads((task.dir / "criteria.json").read_text())
    check = check_list(task, record["criteria"])
    record["clean"] = bool(check["ok"] and not any(check["findings"].values()))
    record["history"].append({"criteria": record["criteria"], "rechecked": True, "check": check})
    return record


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--set", default="dev", choices=("tasks", "dev"))
    parser.add_argument("--tasks")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--recheck", action="store_true")
    parser.add_argument("--parallel", type=int, default=4)
    args = parser.parse_args()
    tasks = load_tasks(args.set, args.tasks.split(",") if args.tasks else None)
    if args.recheck:
        todo = [task for task in tasks if (task.dir / "criteria.json").is_file()]
    else:
        todo = [task for task in tasks if args.force or not (task.dir / "criteria.json").is_file()]
    print(f"{len(todo)} lists to {'check again' if args.recheck else 'write'} ({len(tasks) - len(todo)} left as they are)")

    def job(task: Task) -> None:
        record = recheck(task) if args.recheck else write_list(task)
        write_json(task.dir / "criteria.json", record)
        last = record["history"][-1]["check"] or {}
        findings = last.get("findings") or {}
        print(f"{'clean' if record['clean'] else 'CHECK'} {task.id.ljust(18)} {len(record['criteria'])} criteria, {record['attempts']} attempts"
              + ("" if record["clean"] else f"  {json.dumps(findings, ensure_ascii=False)[:300]}"))

    with ThreadPoolExecutor(max_workers=max(1, min(args.parallel, 6))) as pool:
        list(pool.map(job, todo))


if __name__ == "__main__":
    main()
