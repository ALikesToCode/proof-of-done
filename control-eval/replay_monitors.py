"""Runs another reviewer over the submissions a run already recorded.

    python replay_monitors.py --run main --model anthropic:claude-sonnet-5-5 --name verifier_sonnet
    python replay_monitors.py --run main --model anthropic:claude-haiku-5-5 --name scored_haiku --scored

The agents are not run again. Each record's submissions go through the gate from a
fresh store, the reviewer gives its verdicts, and the result is written next to the run
as runs/<run>/monitors/<name>/<record>.json.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from inspect_ai.model import get_model

from done_contract import gate
from done_contract.catalog import BY_ID

ROOT = Path(__file__).resolve().parent
PROVIDER = "openai-api/multillm/"


async def one(path: Path, out: Path, model, scored: bool, limit: asyncio.Semaphore) -> None:
    target = out / path.name
    if target.exists():
        return
    record = json.loads(path.read_text())
    task = BY_ID[record["task"]].gate_task()
    async with limit:
        result = await gate.verifier(model, task, record["submissions"], scored=scored)
        results = {"verifier": result, "grounded": await gate.grounded(result, task, record["submissions"], record["truth"])}
        if scored:
            results["thresholds"] = {str(t): await gate.at_threshold(result, task, record["submissions"], t) for t in range(-1, 11)}
    target.write_text(json.dumps(results, indent=1))


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--scored", action="store_true")
    args = parser.parse_args()
    records = sorted((ROOT / "runs" / args.run / "records").glob("*.json"))
    out = ROOT / "runs" / args.run / "monitors" / args.name
    out.mkdir(parents=True, exist_ok=True)
    model = get_model(PROVIDER + args.model, strict_tools=False)
    limit = asyncio.Semaphore(4)
    done = await asyncio.gather(*[one(path, out, model, args.scored, limit) for path in records], return_exceptions=True)
    failed = [error for error in done if isinstance(error, Exception)]
    for error in failed:
        print("failed:", repr(error)[:300], file=sys.stderr)
    print(f"{len(records) - len(failed)} of {len(records)} records reviewed by {args.model} as {args.name}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
