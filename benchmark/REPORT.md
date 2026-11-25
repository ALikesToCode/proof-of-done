# "The agent said done" against "it was done": first measurement

Run on 25 Nov 2026, on one machine. Every number below is counted by `harness/score.ts` from the records in `records/` and can be read in [records/full/results.md](records/full/results.md). Rates are followed by their counts and a 95% Wilson interval.

## Summary

Five coding agents each worked once on 30 small coding tasks with hidden acceptance tests: 150 runs.

- **Agents said done in 149 of 150 runs. In 11 of them the hidden tests failed**: a false-done rate of 7.3% (11 of 150; 4.1% to 12.7%). Five of the 11 rest on a hidden assertion that a careful reader of the task could dispute. Without those assertions it is 4.0% (6 of 150; 1.8% to 8.5%).
- **The app's automatic checks stopped none of the 11.** Every false done came with well-formed evidence of passing visible tests.
- **Independent review through the gate let no false done through** (11 of 11 stopped; 74.1% to 100%). **It also refused 79.7% of the work that was done** (110 of 138; 72.2% to 85.6%).
- **Self-review stopped 6 of the 11** (54.5%; 28.0% to 78.7%) and refused 70.3% of the work that was done (97 of 138).
- **The benchmark does not show that the independent reviewer tells false dones from true ones.** It refused 100% of the false dones and 80% of the true ones. With 11 false dones that gap is within chance (one-sided Fisher exact test, 0.09). The self-reviewing agents refused their false dones less often than their true dones.

So, on these tasks, the gate with a reviewing model and no person removes false dones mostly by refusing nearly everything. That is the result, and it is not a flattering one. The sections below say how it was measured and what limits it.

## Method

A run is one agent working once on one task. The definitions were written down in [PROTOCOL.md](PROTOCOL.md) and committed before the first run; the changes made after the pilot are listed at its end.

1. **Workspace.** A fresh folder gets the task's `TASK.md`, starter code and visible tests. The agent's process runs under `bwrap` with the whole `benchmark/` folder replaced by an empty one, so the hidden tests are not readable.
2. **Contract and prompt.** Every agent gets the same prompt (`harness/prompts.ts`). It names a done contract of two criteria, the same for every task: *c1, every rule in the description is implemented*, and *c2, the provided tests pass, with that file unchanged*. The agent is told that its evidence is checked on arrival and then judged by a reviewer other than itself who cannot open files.
3. **Claim.** The agent writes `proof/evidence.json` with `claim` set to `done` or `not_done` and one or more pieces of evidence per criterion. A run that crashed or left no claim counts as "did not say done" and stays in every denominator.
4. **Truth.** The task's hidden tests run against the files the agent left, in a separate folder, with the task's own copy of the test file. Done means every hidden test passes.
5. **The gate.** The harness drives the app's own services on a work item held in memory: `start-done-contract`, `submit-evidence` for each piece (which runs the checks), `list-evidence-to-review`, `record-verdict`, and the gate answer of `get-done-contract`. Nothing in `src/` was changed or copied.

### The conditions

All conditions are computed on the same runs.

| Condition | The work passes as done when |
| --- | --- |
| No gate | the agent said done |
| Checks only | the agent said done, and every criterion has evidence that passed the app's checks. Not a setting of the app; shown to isolate the checks |
| Self-review | the agent said done, and its own verdicts prove every criterion under the core rules with self-review allowed. The agent gives the verdicts in one more turn of the same session, from the same record and judging rules a reviewer gets |
| Independent review | the agent said done, and the app's gate passes after a reviewer from another vendor's model recorded verdicts |

The independent reviewer answers in a fresh context with the app's Proof Verifier prompt and the judging rules of its review skill, read from `rovo/`. It sees what `list-evidence-to-review` returns: the description, the criteria, the evidence and the check notes. It does not see the code. A reviewer that gives no usable answer has given no verdict, and the gate says no.

### Agents and reviewers

| Id | Tool and model | Independent reviewer |
| --- | --- | --- |
| claude-haiku | `claude` CLI 2.1.330, `claude-haiku-5-5` | codex-astra |
| claude-haiku45 | `claude` CLI 2.1.330, `claude-haiku-4-5-20251001` | codex-astra |
| codex-astra | `codex` CLI 0.172.0, `gpt-6.2-astra`, reasoning effort low | claude-haiku |
| codex-luna | `codex` CLI 0.172.0, `gpt-5.6-luna`, reasoning effort low | claude-haiku |
| loop-glm | the tool loop in `harness/agents.ts`, `auto:glm-5.2` through MultiLLM-Proxy (served by `nanogpt:zai-org/glm-5.2:thinking` in every run) | claude-haiku |

Both command-line tools ran non-interactively with the owner's settings, instructions and skills switched off. The three models in the first, third and fifth row are the reviewers. The assignment was fixed before the runs it applies to.

## Task selection

The 30 tasks were written for this benchmark. No public benchmark was used, so no task or solution can be in a model's training data, and no per-task container is needed: each task is one Python module (the reference solutions are 14 to 126 lines) with `unittest` tests.

- **14 specification tasks**: implement a function from a written list of rules (a duration parser, a glob matcher, month arithmetic, an INI parser).
- **10 regression tasks**: a bug report names one symptom, and the description states rules the report does not mention (a second function with the same fault, an edge the fix has to keep).
- **6 control tasks**: the visible tests cover every stated rule. A false done is not expected here.

For the 24 non-control tasks, the visible tests cover the plain cases and the hidden tests cover the rest of the stated rules. Each of these tasks ships a *partial* solution: a plausible first attempt that passes every visible test and fails hidden ones. `harness/validate.ts` checks for every task that the reference solution passes both test files, that the starter fails the hidden tests, and that the partial solution passes the visible tests and fails the hidden ones. This choice is deliberate and it biases the set toward false dones: these are tasks where stopping at green visible tests is wrong.

**The pilot** ran the first ten tasks with three agents (claude-haiku, codex-astra, loop-glm). All 30 runs passed the hidden tests: no false done, so no catch rate. In response, twenty denser tasks and two older, smaller models were added. The pilot's records are in `records/pilot/` as a development set and are in no number in this report. Tasks 1 to 10 were run again in the full set, so results are also given for tasks 11 to 30 alone.

**Disputed assertions.** After the runs, every failing hidden assertion of a false done was read against its `TASK.md`. Three assertions, in `t15_glob`, `t21_merge` and `t30_normpath`, test a reading the description does not state plainly. They are listed with reasons in each task's `hidden/disputed.json`. The primary numbers keep them, because the truth was fixed before the runs; a second table drops them.

## Results

### How often agents said done when it was not

| Agent | Runs | Said done | Said done, hidden tests fail |
| --- | --- | --- | --- |
| claude-haiku | 30 | 30 | 1 |
| claude-haiku45 | 30 | 30 | 6 |
| codex-astra | 30 | 30 | 0 |
| codex-luna | 30 | 30 | 3 |
| loop-glm | 30 | 29 | 1 |
| all | 150 | 149 | 11 |

Eight of the 11 false dones are on specification tasks, three on regression tasks and none on control tasks. They fall on six tasks. No agent edited the visible tests, and no agent said "not done": the one run without a claim ended after three model requests with no work and no evidence file. One other run left an unreadable evidence file, and its claim was read from its last message. In every false done the agent's own copy of the visible tests passed.

### The three conditions

| Condition | Passed as done | False-done rate (of all runs) | Catch rate | False-rejection rate |
| --- | --- | --- | --- | --- |
| No gate | 149 of 150 | 7.3% (11 of 150; 4.1% to 12.7%) | 0.0% (0 of 11; 0.0% to 25.9%) | 0.0% (0 of 138; 0.0% to 2.7%) |
| Checks only | 148 of 150 | 7.3% (11 of 150; 4.1% to 12.7%) | 0.0% (0 of 11; 0.0% to 25.9%) | 0.7% (1 of 138; 0.1% to 4.0%) |
| Self-review | 46 of 150 | 3.3% (5 of 150; 1.4% to 7.6%) | 54.5% (6 of 11; 28.0% to 78.7%) | 70.3% (97 of 138; 62.2% to 77.3%) |
| Independent review | 28 of 150 | 0.0% (0 of 150; 0.0% to 2.5%) | 100.0% (11 of 11; 74.1% to 100.0%) | 79.7% (110 of 138; 72.2% to 85.6%) |

- False-done rate: runs the condition passed as done whose hidden tests fail, over all runs.
- Catch rate: of the runs that said done with failing hidden tests, the share the condition did not pass.
- False-rejection rate: of the runs that said done with passing hidden tests, the share the condition did not pass.

On tasks 11 to 30 alone the picture is the same: 10 false dones in 100 runs, independent review stopped 10 of 10 and refused 68 of 89 true dones, self-review stopped 6 of 10 and refused 63 of 89.

Without the three disputed assertions, 6 false dones remain. Independent review stopped 6 of 6 and refused 115 of 143 true dones (80.4%). Self-review stopped 5 of 6 and refused 98 of 143 (68.5%).

### Does the review tell false dones from true ones?

A condition that refuses most work catches most false dones without telling them apart. The comparison that matters is the refusal rate on false dones against the refusal rate on true dones.

| Review | Refused, of false dones | Refused, of true dones | Chance of that many if refusals ignored the truth |
| --- | --- | --- | --- |
| Self-review, in the agent's session | 6 of 11 (54.5%) | 97 of 138 (70.3%) | 0.92 |
| Independent review | 11 of 11 (100%) | 110 of 138 (79.7%) | 0.09 |
| Fresh review by claude-haiku, all agents' work | 11 of 11 (100%) | 113 of 138 (81.9%) | 0.12 |
| Fresh review by codex-astra, all agents' work | 10 of 11 (90.9%) | 131 of 138 (94.9%) | 0.89 |
| Fresh review by loop-glm, all agents' work | 6 of 11 (54.5%) | 82 of 138 (59.4%) | 0.74 |

The last column is a one-sided Fisher exact test. No row clears a 5% level on the 150 first runs. With the repeat runs added, the independent gate refused 20 of 20 false dones and 184 of 229 true dones (0.016), but repeats of one task are not independent runs, so that figure overstates the evidence.

Why so many refusals of good work: of the 110 true dones the independent gate refused, the reviewer left both criteria unproven in 69, only c2 ("the provided tests pass, unchanged") in 28, and only c1 ("every rule is implemented") in 13. The reviewers' reasons say the same thing in most cases: a passing run of the visible tests does not show that every rule holds, and nothing in the record shows that the test file is unchanged. Both objections are correct readings of the app's review skill, which says to reject evidence that covers part of a criterion. The reviewer is doing what its instructions say, and the instructions cannot be satisfied from a text record of a test run.

Giving the assigned reviewer the source files did not change this within the noise: it refused 108 of 138 true dones and let 1 of the 11 false dones through.

### By agent and by reviewer

The conditions differ more by model than by condition.

- **codex-astra** refused every one of its own 30 true dones in self-review. Its independent reviewer (claude-haiku) refused 7 of them.
- **loop-glm** accepted 24 of its own 30 runs in self-review, including its one false done. As a fresh reviewer of others' work it stopped 6 of 10 false dones.
- **claude-haiku** as a fresh reviewer stopped 11 of 11 false dones across all agents and refused 113 of 138 true dones.

The full matrix of who reviewed whose work is in `records/full/results.md`. Its cells hold 0 to 6 false dones each, so it supports no claim about same-model against other-model review.

## Noise

**Running again.** Ten tasks (every third one) were run three times by every agent: 50 task and agent pairs. Between repeats the hidden-test result changed in 6 pairs, the claim in none, the self-review answer in 16 and the independent gate answer in 9.

| Condition | Measure | Repeat 1 | Repeat 2 | Repeat 3 | Largest gap (points) |
| --- | --- | --- | --- | --- | --- |
| No gate | False-done rate | 8.0% | 8.0% | 10.0% | 2.0 |
| Self-review | Catch rate | 75.0% | 75.0% | 80.0% | 5.0 |
| Self-review | False-rejection rate | 73.9% | 63.0% | 66.7% | 10.9 |
| Independent review | Catch rate | 100.0% | 100.0% | 100.0% | 0.0 |
| Independent review | False-rejection rate | 78.3% | 82.6% | 80.0% | 4.3 |

**Asking again.** On the first runs of the same ten tasks, each fresh review was asked three times on the same record. The independent gate answer changed in 8 of 49 runs, and its false-rejection rate moved between 77.8% and 86.7% (8.9 points). Per reviewer, the gate answer changed in 7 runs for claude-haiku, 4 for codex-astra and 14 for loop-glm.

**The decision rule.** PROTOCOL.md calls a difference real only when the 95% interval of the difference (a bootstrap that resamples tasks) excludes zero and the difference is larger than the largest repeat gap above.

| Comparison | Measure | Difference (points) | 95% interval | Largest repeat gap | Verdict |
| --- | --- | --- | --- | --- | --- |
| Independent minus no gate | False-done rate | -7.3 | -14.0 to -2.0 | 2.0 | real |
| Independent minus no gate | False-rejection rate | +79.7 | +75.2 to +84.0 | 8.9 | real |
| Self-review minus no gate | False-done rate | -4.0 | -8.7 to -0.7 | 2.0 | real |
| Independent minus self-review | False-done rate | -3.3 | -6.7 to -0.7 | 0.0 | real |
| Independent minus self-review | Catch rate | +45.5 | +15.4 to +80.0 | 5.0 | real |
| Independent minus self-review | False-rejection rate | +9.4 | +3.1 to +15.6 | 10.9 | cannot tell apart |
| With the source minus independent | all three | | | | cannot tell apart |

By the rule, independent review stopped more false dones than self-review, at a false-rejection rate the benchmark cannot tell apart from self-review's. The rule does not ask whether a condition discriminates. The table in the section before does, and its answer is "not shown".

## Time and cost

The full set took 2 hours 23 minutes of wall time (15:26 to 17:49 UTC), four model processes at a time: 250 agent runs and 1,286 reviews. Median working time per run was 30 to 63 seconds by agent; the longest run took 243 seconds. Disk use for all records is 17 MB.

| Agent | Runs | Median work time (s) | Mean input tokens | Mean output tokens | Cost the tool reported |
| --- | --- | --- | --- | --- | --- |
| claude-haiku | 50 | 30 | 157,012 | 6,716 | $0.34 |
| claude-haiku45 | 50 | 47 | 290,094 | 7,512 | $4.45 |
| codex-astra | 50 | 46 | 104,956 | 1,275 | not reported |
| codex-luna | 50 | 63 | 179,304 | 2,656 | not reported |
| loop-glm | 50 | 49 | 23,927 | 3,907 | not reported |

The dollar figures are what the `claude` tool printed for its own requests, which went through a local proxy on a subscription. They are the tool's list-price estimate, not a bill. `codex` ran on a subscription login and prints no cost. The gateway reported $0.00 for the GLM requests. Input tokens are mostly cached re-reads of the conversation. Reviews added 494 calls to claude-haiku ($0.65 reported), 446 to codex-astra and 346 to loop-glm.

A run of 50 tasks under the same protocol would be about 5/3 of this: by straight scaling, close to 4 hours and the same per-run token counts. That is an estimate, not a measurement. Running was never the limit. Writing twenty more tasks with fair hidden tests was.

## Limits

A sceptical reader should weigh these before using any number above.

1. **Eleven false dones.** Every catch rate here has a denominator of 11, or 6 without the disputed assertions. The intervals are wide and per-agent cells are useless.
2. **The party that wrote the tasks wrote the hidden tests.** Five of 11 false dones turned on three assertions later judged disputable. That audit was done by the same hand, after the results were known. No second person has read the tasks.
3. **The contract is generic and hard to prove.** "Every rule in the description is implemented" cannot be shown by a test run of visible tests, and the reviewers said so. A contract written per task, with criteria a test run can prove, would likely move the false-rejection rate a great deal. This benchmark did not test that.
4. **One submission, no second round.** In the app a rejection costs one more submission, and the agent can answer the reviewer's reason. Here a rejection is final. The false-rejection rate is therefore the rate of first-round refusals, not of work that never passes.
5. **No person.** The app's design has a person hold the gate and confirm the reviewing agent's verdicts. Every verdict here is a model's. The numbers describe an unattended reviewing model, which is the weakest form of the gate.
6. **The reviewer is a stand-in.** It gets the Proof Verifier's prompt and the review skill's judging rules as text, in a plain model call. It is not the Rovo agent, has no Teamwork Graph, and gives all its verdicts in one JSON answer.
7. **Self-review is a construction.** The app gives an agent no way to judge its own evidence. The condition was built for the benchmark: one extra turn in the agent's session and the core rules with self-review allowed. It mostly measures how each model answers "would a strict reviewer accept this?": one model refused all of its own correct work.
8. **Reviewer and agent are confounded.** claude-haiku is the independent reviewer for three agents and codex-astra for two. "Independent review" in the main table is a mix of two reviewers with very different refusal rates (82% and 95% across all work).
9. **The agents knew a reviewer was coming**, and the evidence format (a JSON file, not tool calls) was made for the benchmark. Agents under a real gate may write different evidence.
10. **Small, single-file Python tasks**, chosen to have traps. The false-done rate says nothing about the rate on real tickets, larger changes or other languages. The six control tasks had no false done.
11. **Unequal harnesses.** Two agents ran in vendor tools with their own system prompts; one ran in a 60-line tool loop. Differences between agents are differences between whole stacks.
12. **One day, one sample.** Repeats cover ten tasks. Model versions are as served on 25 Nov 2026.
13. **Isolation was checked by pattern only.** The hidden tests were masked with `bwrap`, and `harness/audit.ts` searched all 498 transcripts for the names an agent would need to reach them and found none. That is not a proof that no agent could.
14. **Analyses added after the runs.** The disputed-assertion table, the discrimination test and the breakdown of refusals were added after the numbers were seen. PROTOCOL.md marks them.

## What it does not show

- It does not show that Proof of Done reduces false dones in a team's work. No team, no person and no Jira site took part.
- It does not show that an independent reviewer is better at spotting unfinished work than the agent itself. It shows that the independent reviewers refused more, and that refusing more stopped more.
- It does not show the cost of the gate in practice. An 80% first-round refusal of good work would be unusable as a final answer, and the benchmark did not measure what a second round or a per-task contract would recover.
- It does not rank the five agents. The gaps between them are within what 30 runs each can show.

## What to measure next

The data points at three follow-ups, in order of value: a second submission round after a rejection; contracts with criteria a test run can prove; and a person's verdicts on a sample, to compare with the models'. Each needs more false dones than 11, which means more tasks or weaker agents.

## Files

- [PROTOCOL.md](PROTOCOL.md): the definitions and every change to them.
- [records/full/results.md](records/full/results.md) and `results.json`: all tables, including per-agent tables and the reviewer matrix.
- `records/full/runs/`, `reviews/`, `transcripts/`: one record per run and per review, and the raw output of each agent turn. Home-directory paths were replaced by `harness/audit.ts`.
- [README.md](README.md): how to reproduce.
