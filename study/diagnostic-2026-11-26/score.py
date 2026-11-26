"""Scores results.json: the same reviewer on the same finished runs, before and after one
truthful line of evidence (the test file's SHA-256 before and after) was added for c2."""
import collections, json, math, os

rows = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "results.json")))
table = collections.defaultdict(collections.Counter)
why = collections.Counter()
for row in rows:
    def proven(side, criterion):
        return any(v["decision"] == "accepted" for v in row[side]["verdicts"] if v["criterion"] == criterion)
    before, after = row["before"]["gate"], row["after"]["gate"]
    added = [v for v in row["after"]["verdicts"] if v.get("added")]
    for key in {row["agent"], "all", "all but codex-astra" if row["agent"] != "codex-astra" else "all"}:
        t = table[key]
        t["n"] += 1
        t["gate before"] += before
        t["gate after"] += after
        for c in ("c1", "c2"):
            t[f"{c} before"] += proven("before", c)
            t[f"{c} after"] += proven("after", c)
        t["added line accepted"] += bool(added and added[0]["decision"] == "accepted")
        t["gained"] += (not before) and after
        t["lost"] += before and not after
    if added and added[0]["decision"] == "rejected":
        text = added[0]["reason"].lower()
        part = any(w in text for w in ("part", "both", "half", "alone", "only that", "not that the tests pass", "nothing shows the tests"))
        why["covers only part of the criterion" if part else "other"] += 1

cols = ["n", "gate before", "gate after", "c2 before", "c2 after", "c1 before", "c1 after", "added line accepted", "gained", "lost"]
print("worker".ljust(22) + "".join(c.rjust(len(c) + 2) for c in cols))
for key in sorted(table):
    print(key.ljust(22) + "".join(str(table[key][c]).rjust(len(c) + 2) for c in cols))
t = table["all but codex-astra"]
b, c = t["gained"], t["lost"]
p = min(1.0, 2 * sum(math.comb(b + c, k) for k in range(min(b, c) + 1)) / 2 ** (b + c))
print(f"Exact McNemar test, all but codex-astra: gained {b}, lost {c}, p = {p:.2g}")
print("Reasons for rejecting the added line:", dict(why))
