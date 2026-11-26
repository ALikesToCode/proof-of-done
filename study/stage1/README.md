# Stage 1: the pilot

48 small Python tasks, each with a finished version of the work and an unfinished twin, and the
code that reviews all 96 versions in four cells. The design, the main comparison and the
predictions are in [../PROTOCOL.md](../PROTOCOL.md).

**State on 27 Nov 2026: built, not frozen, not run.** No review of the 48 tasks has been asked.
The code refuses to work on them until `freeze.json` exists and matches the files.

## What is here

| Path | What it holds |
| --- | --- |
| `tasks/<id>/` | One task: `TASK.md` (the task text), `starter/` (the start code and the visible tests), `hidden/` (the acceptance tests), `reference/` (the finished version), `twin/` (the unfinished version), `criteria.json` (the specific criteria), `meta.json` |
| `dev/<id>/` | The development set: the benchmark's six tasks without a partial solution. Two were given a twin |
| `prompts/` | Every prompt a model is sent |
| `harness/` | The code: `validate.py`, `criteria.py`, `freeze.py`, `evidence.py`, `review.py`, `score.py`, and `test_harness.py` |
| `records/dev/` | The development run: 32 evidence records, 32 reviews, `results.md` |

## Where the tasks come from

| Ids | Count | Source |
| --- | --- | --- |
| `t..` | 24 | The benchmark's tasks that ship a partial solution, copied by `harness/import_benchmark.py`. Each `meta.json` lists what was changed in the copy |
| `c..` | 20 | Built on the modules of the control evaluation: the task text rewritten as numbered rules, visible tests for the plain cases, the hidden tests rewritten for `unittest`, and a twin. Most go a little beyond the control evaluation's task |
| `n..` | 4 | New |

Every twin's `meta.json` has `twin_breaks`: the text of `TASK.md` the twin breaks, and the hidden
tests that fail because of it. `validate.py` checks that the quoted text is in `TASK.md` word for
word and that the listed tests are exactly the ones that fail.

Changes to the benchmark's copies:

- The three hidden assertions listed as disputed in the benchmark are removed.
- Tracing every failing test to the task text found two more assertions in `t30_normpath` that rest
  on path convention and not on the text. They are removed.
- The twin of `t03_lru_ttl` had a docstring that named its own gap. It is put back to the starter's.

Known weak points of the task set:

- The twins of `t11_calc` and `t15_glob` use `eval` and `fnmatch`, which their task text forbids.
  A reviewer can refuse them by reading one line. No hidden test checks the ban.
- Some twins differ from the reference by one line (`c02_slugify`, `c07_money`, `c08_intervals`).
- Several `c..` tasks share a topic with a `t..` task (durations, slugs, pagination, an LRU cache,
  working days, a token bucket). The rules and the code differ.
- The task set is checked on Python 3.14, the version the pilot runs on, here and in CI. On
  Python 3.10 the twin of `t06_record` fails two more hidden tests than its `meta.json` lists,
  because it leans on the `csv` module, which changed between the versions. The other 47 tasks
  give the same result on 3.10. The freeze records the Python version.

## Run it

Python 3.14, standard library only, and the `claude` command-line tool signed in. The code runs
on 3.10 or newer; the task set is validated on 3.14.

```
cd study/stage1/harness
python3 -m unittest discover -s . -p 'test_*.py'   # the statistics and the parsers
python3 validate.py                                # all 48 tasks
python3 validate.py --set dev

# the development set, end to end (about 3 minutes)
python3 criteria.py --set dev
python3 evidence.py --set dev
python3 review.py --set dev
python3 score.py --set dev

# the pilot, once the criteria have been read
python3 freeze.py                                  # writes freeze.json; commit it before the next step
python3 evidence.py --set tasks                    # 384 evidence records, 192 of them written by a model
python3 review.py --set tasks                      # 384 reviews
python3 score.py --set tasks                       # records/tasks/results.md
```

Each step skips work whose record exists.

## Before the freeze

1. The specific criteria of 12 of the 48 tasks are read by hand against their `TASK.md`. All 48
   lists passed the second model's check on the first attempt, which says little by itself.
2. An engineer reads a sample of tasks: is each twin honest unfinished work, and does every hidden
   assertion follow from the text?
3. One outside reader has read the protocol.

## What the development run showed

Six tasks, eight versions, 32 reviews, on 27 Nov 2026. It was run to try the code. It is not a
result, and the predictions in the protocol were public before it.

| Cell | Criteria | Evidence | Finished work refused | Twins caught |
| --- | --- | --- | --- | --- |
| 1 | general | worker | 6 of 6 | 2 of 2 |
| 2 | general | harness | 1 of 6 | 2 of 2 |
| 3 | specific | worker | 6 of 6 | 2 of 2 |
| 4 | specific | harness | 1 of 6 | 2 of 2 |

- All 12 refusals under worker evidence left one criterion unproven, the one about the provided
  tests: nothing the worker wrote showed that the test file was unchanged. This is the cause the
  diagnostic of 26 November found.
- With harness evidence, general criteria refused one finished version of six. If the 48 tasks
  behave the same way, prediction 1 cannot hold, because there are not 30 points to gain.
- One of the two refusals under harness evidence was right. The reference solution of `t22_base`
  accepts the Kelvin sign (U+212A) as the digit `k`, which the task text rules out and the hidden
  tests do not check. So a version labelled finished can be unfinished, and every refusal of a
  finished version has to be read before it is counted as a false rejection.
- Both twins were caught in every cell. Two twins say nothing about the catch rate.

Three things were changed after trying them on this set, before any review of the 48:

- The first prompt for the criteria split each rule into parts and gave up to 21 criteria a task.
  It now asks for one criterion per numbered rule (5 to 16 a task).
- The worker no longer sets the claim. Asked to, it answered "incomplete" for one finished version
  whose visible tests did not cover every criterion. The claim is "done" for every version by
  design, and the worker writes the evidence only.
- The reviewer is told how many criteria the contract has, after one answer left the last one out.
