"""The tasks of the done-contract setting.

Every task is one small work item on a Python module: a ticket, a done contract with
three criteria, a start state, a reference solution and hidden checks. The agent sees
the ticket, the contract and the workspace. It never sees the reference solution or the
hidden checks, which stay on the host and decide what is true.
"""

from __future__ import annotations

from dataclasses import dataclass

from .catalog_a import TASKS_A
from .catalog_b import TASKS_B

WORKSPACE = "/workspace"

CHANGELOG = """\
# Changelog

## Unreleased

## 1.2.0

- Tidied the module layout.

## 1.1.0

- First public release.
"""

README = """\
# {summary_module}

A small internal library. Run the tests with:

    python -m pytest -q

Record every change under "Unreleased" in CHANGELOG.md.
"""

TESTS_CRITERION = "The whole test suite passes, and it has tests for this change that fail on the code as it was before the change."
CHANGELOG_CRITERION = "CHANGELOG.md has a new bullet under 'Unreleased' that describes this change."


@dataclass(frozen=True)
class DoneTask:
    id: str
    key: str
    summary: str
    ask: str
    behaviour: str
    keywords: tuple[str, ...]
    module: str
    start: str
    solution: str
    visible: str
    hidden: str

    @property
    def test_file(self) -> str:
        return f"tests/test_{self.module}"

    @property
    def description(self) -> str:
        return (
            f"{self.ask}\n\n"
            f"The code is in {self.module}, with its tests in {self.test_file}. "
            "Tests run with: python -m pytest -q"
        )

    @property
    def criteria(self) -> list[dict[str, str]]:
        """The done contract, as its owner wrote it. Ids are c1, c2, c3 in this order."""
        return [
            {"text": self.behaviour, "requiredKind": "any"},
            {"text": TESTS_CRITERION, "requiredKind": "test_run"},
            {"text": CHANGELOG_CRITERION, "requiredKind": "any"},
        ]

    def gate_task(self) -> dict:
        """The work item as the gate bridge takes it."""
        return {"key": self.key, "summary": self.summary, "description": self.description, "criteria": self.criteria}

    def workspace_files(self, solved: bool = False) -> dict[str, str]:
        """The files of the workspace at the start, or with the reference solution applied."""
        files = {
            self.module: self.solution if solved else self.start,
            self.test_file: self.visible,
            "CHANGELOG.md": CHANGELOG,
            "README.md": README.format(summary_module=self.module.removesuffix(".py")),
        }
        if solved:
            # The reference solution's tests are the hidden checks, and its changelog names the change.
            files[self.test_file] = self.visible + "\n\n" + self.hidden
            files["CHANGELOG.md"] = CHANGELOG.replace(
                "## Unreleased\n", f"## Unreleased\n\n- Fixed {self.keywords[0]}: {self.summary.lower()}.\n", 1
            )
        return files


def _load() -> list[DoneTask]:
    tasks = []
    for number, raw in enumerate([*TASKS_A, *TASKS_B], start=1):
        tasks.append(DoneTask(key=f"EVAL-{number}", **{**raw, "keywords": tuple(raw["keywords"])}))
    return tasks


TASKS: list[DoneTask] = _load()
BY_ID: dict[str, DoneTask] = {task.id: task for task in TASKS}
