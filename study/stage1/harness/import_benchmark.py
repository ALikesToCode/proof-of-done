"""One-off: copies the benchmark's tasks into the study.

The 24 tasks with a partial solution go to stage1/tasks/, with `partial/` renamed to
`twin/` and the three disputed hidden assertions removed as each task's
`hidden/disputed.json` says. The six tasks without a partial solution go to stage1/dev/.
`twin_breaks` is left empty here and filled in by hand, so validate.py fails until it is.

Run once: python3 study/stage1/harness/import_benchmark.py
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from lib import DEV_DIR, STAGE_DIR, TASKS_DIR

BENCHMARK = STAGE_DIR.parents[1] / "benchmark" / "tasks"


def main() -> None:
    for source in sorted(BENCHMARK.iterdir()):
        if not (source / "meta.json").is_file():
            continue
        meta = json.loads((source / "meta.json").read_text())
        has_partial = (source / "partial").is_dir()
        target = (TASKS_DIR if has_partial else DEV_DIR) / source.name
        if target.exists():
            print(f"skip {source.name}: already there")
            continue
        target.mkdir(parents=True)
        shutil.copy(source / "TASK.md", target / "TASK.md")
        shutil.copytree(source / "starter", target / "starter")
        shutil.copytree(source / "reference", target / "reference")
        (target / "hidden").mkdir()
        hidden = (source / "hidden" / "test_hidden.py").read_text()
        removed = 0
        disputed = source / "hidden" / "disputed.json"
        if disputed.is_file():
            for entry in json.loads(disputed.read_text()):
                if entry["find"] not in hidden:
                    raise SystemExit(f"{source.name}: disputed text not found")
                hidden = hidden.replace(entry["find"], entry["replace"])
                removed += 1
        (target / "hidden" / "test_hidden.py").write_text(hidden)
        out = {"id": meta["id"], "module": meta["module"], "source": "benchmark" if has_partial else "benchmark-dev", "note": meta["trap"]}
        if has_partial:
            shutil.copytree(source / "partial", target / "twin")
            out["twin_breaks"] = []
        if removed:
            out["disputed_assertions_removed"] = removed
        (target / "meta.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
        print(f"{'task' if has_partial else 'dev '} {source.name}{f', {removed} disputed assertion removed' if removed else ''}")


if __name__ == "__main__":
    main()
