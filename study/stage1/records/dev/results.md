# Stage 1 results, set `dev`

32 reviews of 6 tasks. Shares are followed by their 95% Wilson interval.

| Cell | Criteria | Evidence | Finished work refused | Unfinished twins caught | No usable answer | Tokens in / out per review | Seconds per review |
|---|---|---|---|---|---|---|---|
| 1 | general | worker | 6 of 6 (100%, 61 to 100) | 2 of 2 (100%, 34 to 100) | 0 of 8 | 3245 / 1002 | 6.2 |
| 2 | general | harness | 1 of 6 (17%, 3 to 56) | 2 of 2 (100%, 34 to 100) | 0 of 8 | 3275 / 791 | 5.2 |
| 3 | specific | worker | 6 of 6 (100%, 61 to 100) | 2 of 2 (100%, 34 to 100) | 0 of 8 | 4311 / 1749 | 9.6 |
| 4 | specific | harness | 1 of 6 (17%, 3 to 56) | 2 of 2 (100%, 34 to 100) | 0 of 8 | 4560 / 1262 | 7.1 |

## Main comparison

Finished work refused, harness evidence: general criteria (cell 2) against specific criteria (cell 4).

- **Finished work, cell 2 against cell 4:** 1 of 6 against 1 of 6, a difference of 0.0 points (95% interval -50.0 to 50.0). Refused only in the first: 1; only in the second: 1; exact McNemar p = 1.

Read with it: the unfinished twins caught in the same two cells.

- **Twins caught, cell 2 against cell 4:** 2 of 2 against 2 of 2, a difference of 0.0 points (95% interval 0.0 to 0.0). Refused only in the first: 0; only in the second: 0; exact McNemar p = 1.

## Other comparisons

- **Finished work, general criteria, worker evidence (1) against harness evidence (2):** 6 of 6 against 1 of 6, a difference of 83.3 points (95% interval 50.0 to 100.0). Refused only in the first: 5; only in the second: 0; exact McNemar p = 0.062.
- **Finished work, specific criteria, worker evidence (3) against harness evidence (4):** 6 of 6 against 1 of 6, a difference of 83.3 points (95% interval 50.0 to 100.0). Refused only in the first: 5; only in the second: 0; exact McNemar p = 0.062.
- **Finished work, worker evidence, general (1) against specific (3):** 6 of 6 against 6 of 6, a difference of 0.0 points (95% interval 0.0 to 0.0). Refused only in the first: 0; only in the second: 0; exact McNemar p = 1.
- **Twins caught, worker evidence, general (1) against specific (3):** 2 of 2 against 2 of 2, a difference of 0.0 points (95% interval 0.0 to 0.0). Refused only in the first: 0; only in the second: 0; exact McNemar p = 1.
- **Interaction, finished work refused:** the effect of specific criteria under worker evidence minus the same under harness evidence is 0.0 points (95% interval -50.0 to 50.0).
- **Interaction, twins caught:** the effect of specific criteria under worker evidence minus the same under harness evidence is 0.0 points (95% interval 0.0 to 0.0).

## Predictions

1. With harness evidence, specific criteria refuse at least 30 points less finished work than general criteria. Measured: 0.0 points. Does not hold.
2. Under general criteria, harness evidence refuses less finished work than worker-written evidence. Measured: 83.3 points. Holds.
3. Specific criteria catch at most 10 points fewer unfinished twins than general criteria (with harness evidence). Measured: 0.0 points. Holds.

## By source of the task (not planned as a test)

| Source | Cell | Finished refused | Twins caught |
|---|---|---|---|
| benchmark-dev | 1 | 6 of 6 | 2 of 2 |
| benchmark-dev | 2 | 1 of 6 | 2 of 2 |
| benchmark-dev | 3 | 6 of 6 | 2 of 2 |
| benchmark-dev | 4 | 1 of 6 | 2 of 2 |
