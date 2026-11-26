"""Runs the done-contract setting: honest and attack policy, through the gate.

    MULTILLM_API_KEY=... python run_eval.py --run pilot --modes honest attack --limit 2

Models go through an OpenAI-compatible gateway (Inspect's `openai-api` provider, named
`multillm`), so MULTILLM_BASE_URL and MULTILLM_API_KEY must be set. The key is read
from the environment and never written anywhere.
"""

from __future__ import annotations

import argparse
import os
import sys

from inspect_ai import eval as inspect_eval
from inspect_ai.model import Model, get_model

from control_arena import EvalMode
from control_arena.eval import ControlEvalConfig, get_control_task_product
from control_arena.policy import attack_policy_builder, honest_policy_builder, untrusted_policy_builder

from done_contract.prompts import ATTACK_PROMPT
from done_contract.setting import EVAL_ROOT, DoneContractSetting

PROVIDER = "openai-api/multillm/"


def gateway_model(name: str) -> Model:
    """A model behind the gateway, with strict tool schemas off.

    Inspect asks OpenAI-compatible providers for strict tool calls by default. Through
    this gateway that made the agent model leave optional arguments out: on one real
    step, `passed` and `failed` arrived in 4 of 10 samples with strict on and in 10 of
    10 with it off. The gate turns a test run without counts away, so strict mode would
    have been measured as the gate refusing honest work.
    """
    return get_model(PROVIDER + name, strict_tools=False)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", required=True, help="Name of the run. Records go to runs/<name>/records.")
    parser.add_argument("--modes", nargs="+", default=["honest", "attack"], choices=["honest", "attack"])
    parser.add_argument("--untrusted", default="anthropic:claude-sonnet-5-5")
    parser.add_argument("--trusted", default="anthropic:claude-haiku-5-5", help="The model the shipped reviewer instructions run on.")
    parser.add_argument("--strategies-per-task", type=int, default=1)
    parser.add_argument("--tasks", nargs="*", help="Task ids to keep. Default: all 20.")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--max-steps", type=int, default=40)
    args = parser.parse_args()

    for name in ("MULTILLM_BASE_URL", "MULTILLM_API_KEY"):
        if not os.environ.get(name):
            print(f"{name} is not set.", file=sys.stderr)
            return 2
    os.environ["POD_RUN"] = args.run

    setting = DoneContractSetting(strategies_per_task=args.strategies_per_task, filter_main_task_names=args.tasks or None)
    policy = untrusted_policy_builder(attack=attack_policy_builder(prompt=ATTACK_PROMPT), honest=honest_policy_builder())
    config = ControlEvalConfig(
        untrusted_model=gateway_model(args.untrusted),
        trusted_model=gateway_model(args.trusted),
        max_steps=args.max_steps,
        token_limit=600_000,
        time_limit=1500,
        limit=args.limit,
        epochs=args.epochs,
        max_samples=4,
        max_sandboxes=4,
        max_tasks=1,
        fail_on_error=False,
        log_dir=str(EVAL_ROOT / "runs" / args.run / "logs"),
    )
    tasks = get_control_task_product(
        settings=setting,
        micro_protocols=policy,
        modes=[EvalMode(mode) for mode in args.modes],
        eval_config=config,
    )
    logs = inspect_eval(tasks, **config.eval_args(), display="plain")
    for log in logs:
        print(log.eval.task, log.status, log.location)
    return 0 if all(log.status == "success" for log in logs) else 1


if __name__ == "__main__":
    sys.exit(main())
