# Benchmark

How often does a coding agent say "done" when the work is not done, and how much of that does the gate stop?

This folder holds the first version of that measurement: 30 small coding tasks with hidden acceptance tests, five agents, and three conditions computed on the same runs. The results, the method and the limits are in [REPORT.md](REPORT.md). The definitions were fixed in [PROTOCOL.md](PROTOCOL.md) before the runs they apply to.

The numbers are from one machine on 25 Nov 2026. Nothing here was read by a second person before it was committed, and the records have not been published.

## What is here

| Path | What it holds |
| --- | --- |
| [REPORT.md](REPORT.md) | The write-up: method, task selection, results, noise, limits |
| [PROTOCOL.md](PROTOCOL.md) | The conditions, the measures and the decision rule, with every change after the first commit |
| `tasks/<id>/` | One task: `TASK.md` (what the agent sees), `starter/` (code and visible tests), `hidden/` (the acceptance tests), `reference/` (a solution that passes them), `partial/` (a plausible solution that passes only the visible tests), `meta.json` |
| `harness/` | The code that runs agents, reviews and scoring |
| `records/pilot/` | The pilot: 30 runs of the first ten tasks by three agents. A development set |
| `records/full/` | The full set: one record per run and per review, the transcripts, `results.md` and `results.json` |

## How the app's rules are used

The harness does not reimplement the rules of proof. For each run it creates a work item in memory, with the stand-ins for Jira and the store that the repository's unit tests use, and drives the app's own services:

- the contract is started from the acceptance criteria in the description (`start-done-contract`),
- each piece of the agent's evidence goes through `submit-evidence`, which runs the checks,
- the reviewer is shown what `list-evidence-to-review` returns, with the Proof Verifier's prompt and the judging rules of the review skill, both read from `rovo/`,
- each verdict goes through `record-verdict`, and the answer is the gate of `get-done-contract`.

The self-review condition has no path through the services, because the app gives an agent no way to judge its own evidence. It is computed with the core rules in `src/core/proof.ts`, with the verdicts marked as not independent and the project setting that allows self-review.

## Reproduce

You need Node.js 22 or newer, Python 3.10 or newer, `bwrap`, the `claude` and `codex` command-line tools signed in, and a MultiLLM-Proxy key in `MULTILLM_API_KEY` for the third reviewer. The models are named in `harness/agents.ts`.

```
npm ci
npx tsx benchmark/harness/validate.ts                      # every task: reference passes, partial fails
npx tsx benchmark/harness/run.ts --set full --reps 1       # 150 agent runs, 4 at a time
npx tsx benchmark/harness/run.ts --set full --reps 2,3 --tasks t01_duration,t04_wrap,t07_slug,t10_paginate,t13_workdays,t16_ini,t19_minstack,t22_base,t25_chunks,t28_bump
npx tsx benchmark/harness/review.ts --set full             # every reviewer on every run
npx tsx benchmark/harness/review.ts --set full --asks 3 --reps 1 --tasks <the same ten tasks>
npx tsx benchmark/harness/audit.ts --set full              # leak check, then scrub of private paths
npx tsx benchmark/harness/score.ts --sets full             # writes records/full/results.md and results.json
```

Each step skips work whose record exists, so it can be stopped and started again. To score the committed records without running any model, the last command is enough.

An agent's process runs with this whole folder replaced by an empty one, so it cannot read the hidden tests. Agents run with full permissions inside their workspace under `/tmp/pod-bench`. Run them only on a machine where that is acceptable.
