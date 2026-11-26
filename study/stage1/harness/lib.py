"""Shared pieces of the stage 1 harness: paths, the task set, running a task's tests
against a version of the work, and asking a model in a fresh context with no tools.

Standard library only; the task set is validated on Python 3.14. Model calls go through
the `claude` command-line tool.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

STAGE_DIR = Path(__file__).resolve().parents[1]
TASKS_DIR = STAGE_DIR / "tasks"
DEV_DIR = STAGE_DIR / "dev"
PROMPTS_DIR = STAGE_DIR / "prompts"
RECORDS_DIR = STAGE_DIR / "records"

VISIBLE_COMMAND = "python3 -m unittest test_visible -v"
VERSIONS = ("reference", "twin")
MAX_TASK_TEXT = 5500

REVIEWER_MODEL = "claude-haiku-5-5"
WORKER_MODEL = "claude-sonnet-5-5"
CRITERIA_MODEL = "claude-opus-5-5"
CRITERIA_CHECK_MODEL = "claude-sonnet-5-5"


def tests_criterion() -> str:
    return "The provided tests in test_visible.py pass, with that file unchanged"


def general_criteria(module: str) -> list[str]:
    """The two lines the benchmark of 25 November used for every task."""
    return [f"Every rule in the description is implemented in {module}.py", tests_criterion()]


@dataclass(frozen=True)
class Task:
    id: str
    module: str
    source: str
    dir: Path
    description: str
    meta: dict

    def version_dir(self, version: str) -> Path:
        return self.dir / version

    def has(self, version: str) -> bool:
        return self.version_dir(version).is_dir()

    def specific_criteria(self) -> list[str]:
        """The frozen list for this task: one criterion per rule, then the line about the provided tests."""
        path = self.dir / "criteria.json"
        return json.loads(path.read_text())["criteria"]

    def criteria(self, form: str) -> list[str]:
        if form == "general":
            return general_criteria(self.module)
        if form == "specific":
            return self.specific_criteria()
        raise ValueError(form)


def load_tasks(which: str = "tasks", only: list[str] | None = None) -> list[Task]:
    root = {"tasks": TASKS_DIR, "dev": DEV_DIR}[which]
    tasks = []
    for path in sorted(root.iterdir()):
        if not (path / "meta.json").is_file():
            continue
        meta = json.loads((path / "meta.json").read_text())
        if meta["id"] != path.name:
            raise ValueError(f"{path.name}: meta.json has id {meta['id']}")
        if only and meta["id"] not in only:
            continue
        tasks.append(Task(meta["id"], meta["module"], meta["source"], path, (path / "TASK.md").read_text(), meta))
    for name in only or []:
        if not any(task.id == name for task in tasks):
            raise ValueError(f"No task {name}")
    return tasks


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run_unittest(cwd: Path, module: str, timeout: int = 120) -> dict:
    """Runs `python3 -m unittest <module> -v` in a folder and reads the counts from its output."""
    env = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "HOME": str(cwd), "LANG": "C.UTF-8", "PYTHONDONTWRITEBYTECODE": "1"}
    started = time.monotonic()
    try:
        done = subprocess.run(["python3", "-B", "-m", "unittest", module, "-v"], cwd=cwd, env=env, capture_output=True, text=True, timeout=timeout)
        output, code, timed_out = done.stderr + done.stdout, done.returncode, False
    except subprocess.TimeoutExpired as error:
        output = ((error.stderr or b"").decode("utf8", "replace") if isinstance(error.stderr, bytes) else (error.stderr or "")) + "\n[timed out]"
        code, timed_out = None, True
    ran = int(m.group(1)) if (m := re.search(r"^Ran (\d+) tests?", output, re.M)) else 0
    failed = int(m.group(1)) if (m := re.search(r"failures=(\d+)", output)) else 0
    errors = int(m.group(1)) if (m := re.search(r"errors=(\d+)", output)) else 0
    failing = sorted(set(re.findall(r"^(?:FAIL|ERROR): (\S+)", output, re.M)))
    ok = (not timed_out) and code == 0 and ran > 0 and failed == 0 and errors == 0 and re.search(r"^OK", output, re.M) is not None
    return {
        "ok": ok,
        "ran": ran,
        "failed": failed,
        "errors": errors,
        "exit": code,
        "timed_out": timed_out,
        "failing": failing,
        "output": output,
        "seconds": round(time.monotonic() - started, 3),
    }


def evaluate(task: Task, version: str, which: str) -> dict:
    """Runs one of a task's test files against one version of the work, in a fresh folder that
    holds that version's files and the task's own copy of the test file."""
    source, module = {
        "visible": (task.dir / "starter" / "test_visible.py", "test_visible"),
        "hidden": (task.dir / "hidden" / "test_hidden.py", "test_hidden"),
    }[which]
    with tempfile.TemporaryDirectory(prefix=f"pod-study-{task.id}-") as folder:
        work = Path(folder)
        for item in sorted(task.version_dir(version).iterdir()):
            if item.name.startswith(".") or item.name in ("__pycache__", "test_visible.py", "test_hidden.py"):
                continue
            if item.is_dir():
                shutil.copytree(item, work / item.name)
            else:
                shutil.copy(item, work / item.name)
        shutil.copy(source, work / f"{module}.py")
        return run_unittest(work, module)


def solution_files(task: Task, version: str) -> list[dict]:
    """The code of one version, as the reviewer is shown it."""
    files = []
    for item in sorted(task.version_dir(version).rglob("*.py")):
        if "__pycache__" in item.parts or item.name in ("test_visible.py", "test_hidden.py"):
            continue
        files.append({"name": str(item.relative_to(task.version_dir(version))), "text": item.read_text()})
    return files


# Variables a parent session sets that would tie a child `claude` to it.
_CLAUDE_PARENT_VARS = (
    "CLAUDE_CODE_CHILD_SESSION",
    "CLAUDE_CODE_MESSAGING_SOCKET",
    "CLAUDE_CODE_MESSAGING_TOKEN",
    "CLAUDE_CODE_SESSION_ID",
    "CLAUDE_CODE_CHILD_NOTES_DIR",
    "CLAUDE_CODE_ENTRYPOINT",
    "CLAUDE_CODE_SESSION_ATTENDED",
    "CLAUDE_CODE_AUTO_MODE_SERVER",
    "CLAUDE_CODE_AUTO_MODE_MODEL",
    "CLAUDE_EFFORT",
    "CLAUDECODE",
    "CLAUDE_PID",
    "CLAUDE_AGENT_SDK_VERSION",
)


def ask(model: str, system: str, user: str, timeout: int = 300) -> dict:
    """One question to a model in a fresh context: no tools, no settings, no saved session."""
    env = {name: value for name, value in os.environ.items() if name not in _CLAUDE_PARENT_VARS}
    args = ["claude", "-p", "--model", model, "--setting-sources", "", "--strict-mcp-config", "--system-prompt", system,
            "--tools", "", "--output-format", "json", "--no-session-persistence"]
    started = time.monotonic()
    with tempfile.TemporaryDirectory(prefix="pod-study-ask-") as folder:
        try:
            done = subprocess.run(args, cwd=folder, env=env, input=user, capture_output=True, text=True, timeout=timeout)
            stdout, stderr, code, timed_out = done.stdout, done.stderr, done.returncode, False
        except subprocess.TimeoutExpired:
            stdout, stderr, code, timed_out = "", "", None, True
    seconds = round(time.monotonic() - started, 3)
    result = None
    for line in reversed(stdout.strip().splitlines()):
        if line.startswith("{"):
            try:
                result = json.loads(line)
                break
            except json.JSONDecodeError:
                continue
    if isinstance(result, list):
        result = next((event for event in reversed(result) if isinstance(event, dict) and event.get("type") == "result"), None)
    ok = bool(result) and result.get("is_error") is not True and not timed_out and isinstance(result.get("result"), str)
    usage = (result or {}).get("usage") or {}
    number = lambda value: value if isinstance(value, (int, float)) else 0
    return {
        "ok": ok,
        "text": (result or {}).get("result", "") if ok else "",
        "error": None if ok else ("timed out" if timed_out else (stderr.strip()[-500:] or f"exit {code}")),
        "asked_model": model,
        "reported_model": "+".join(sorted(((result or {}).get("modelUsage") or {}).keys())) or None,
        "input_tokens": number(usage.get("input_tokens")) + number(usage.get("cache_creation_input_tokens")) + number(usage.get("cache_read_input_tokens")),
        "output_tokens": number(usage.get("output_tokens")),
        "cost_usd": (result or {}).get("total_cost_usd"),
        "seconds": seconds,
    }


def extract_json(text: str):
    """The first JSON object in a model's answer, with or without a code fence around it."""
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    for candidate in (fenced.group(1) if fenced else None, text):
        if not candidate:
            continue
        start, end = candidate.find("{"), candidate.rfind("}")
        if start < 0 or end <= start:
            continue
        try:
            return json.loads(candidate[start : end + 1])
        except json.JSONDecodeError:
            continue
    return None


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def read_json(path: Path):
    return json.loads(path.read_text())


def prompt(name: str) -> str:
    return (PROMPTS_DIR / name).read_text().strip()
