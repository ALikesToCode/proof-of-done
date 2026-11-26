"""Tests of the parts of the harness that decide a number: the statistics, the reading of
a reviewer's answer and the reading of a worker's record. No model is called.

Run: python3 -m unittest discover -s study/stage1/harness -p 'test_*.py'
"""

import unittest

import score
from evidence import parse_worker
from review import parse_answer


def reviews_for(pattern: dict) -> list[dict]:
    """pattern[(version, cell)] is a list of 0/1 refusals, one per task."""
    out = []
    for (version, cell), values in pattern.items():
        for index, value in enumerate(values):
            out.append({"task": f"t{index}", "source": "benchmark", "version": version, "cell": cell, "accepted": not value, "usable": True,
                        "calls": [{"ok": True, "input_tokens": 100, "output_tokens": 10, "seconds": 1.0}]})
    return out


class Statistics(unittest.TestCase):
    def test_mcnemar_matches_the_diagnostic(self):
        self.assertAlmostEqual(score.mcnemar_exact(28, 1), 1.1175870895385742e-07)
        self.assertEqual(score.mcnemar_exact(0, 0), 1.0)
        self.assertEqual(score.mcnemar_exact(3, 3), 1.0)
        self.assertAlmostEqual(score.mcnemar_exact(5, 0), 0.0625)

    def test_wilson(self):
        low, high = score.wilson(0, 59)
        self.assertEqual(low, 0.0)
        self.assertAlmostEqual(high, 0.0611, places=3)
        low, high = score.wilson(24, 48)
        self.assertAlmostEqual(low, 0.3639, places=3)
        self.assertAlmostEqual(high, 0.6361, places=3)

    def test_bootstrap_of_a_constant(self):
        self.assertEqual(score.bootstrap([1.0] * 10, resamples=200), (1.0, 1.0))

    def test_paired_difference(self):
        reviews = reviews_for({("reference", 2): [1, 1, 1, 0], ("reference", 4): [0, 0, 1, 0]})
        result = score.paired(reviews, "reference", 2, 4)
        self.assertEqual((result["refused_a"], result["refused_b"], result["tasks"]), (3, 1, 4))
        self.assertEqual(result["difference_points"], 50.0)
        self.assertEqual((result["refused_only_in_a"], result["refused_only_in_b"]), (2, 0))
        self.assertEqual(result["mcnemar_p"], 0.5)

    def test_predictions(self):
        refuse, accept = [1] * 10, [0] * 10
        reviews = reviews_for({("reference", 1): refuse, ("reference", 2): [1] * 5 + [0] * 5, ("reference", 3): accept, ("reference", 4): accept,
                               ("twin", 1): refuse, ("twin", 2): refuse, ("twin", 3): refuse, ("twin", 4): [1] * 8 + [0] * 2})
        result = score.score(reviews)
        self.assertEqual([item["holds"] for item in result["predictions"]], [True, True, False])
        self.assertEqual(result["predictions"][0]["value_points"], 50.0)
        self.assertEqual(result["predictions"][2]["value_points"], 20.0)
        self.assertEqual(result["cells"][3]["twins_caught"]["k"], 8)
        self.assertIn("Does not hold", score.render(result, "dev"))


class Answers(unittest.TestCase):
    def test_reviewer_answer(self):
        good = {"criteria": [{"criterion": "c2", "decision": "Not proven", "reason": "x"}, {"criterion": "c1", "decision": "proven", "reason": "y"}]}
        self.assertEqual([row["decision"] for row in parse_answer(good, ["c1", "c2"])], ["proven", "not_proven"])
        self.assertIsNone(parse_answer({"criteria": [{"criterion": "c1", "decision": "proven"}]}, ["c1", "c2"]))
        self.assertIsNone(parse_answer({"criteria": [{"criterion": "c1", "decision": "accepted"}]}, ["c1"]))
        self.assertIsNone(parse_answer({"criteria": [{"criterion": "c1", "decision": "proven"}, {"criterion": "c1", "decision": "proven"}]}, ["c1"]))
        self.assertIsNone(parse_answer(None, ["c1"]))

    def test_worker_record(self):
        piece = {"criterion": "c1", "kind": "test_run", "summary": "s", "passed": 4, "failed": 0, "excerpt": "$ cmd\nOK"}
        other = {"criterion": "c2", "kind": "other", "summary": "s", "excerpt": "seen"}
        pieces, problem = parse_worker({"note": "n", "evidence": [piece, other]}, ["c1", "c2"])
        self.assertEqual(problem, "")
        self.assertEqual(pieces["c1"][0]["recordedBy"], "worker")
        self.assertEqual(parse_worker({"evidence": []}, ["c1", "c2"])[1], "no evidence list")
        self.assertEqual(parse_worker({"evidence": [piece]}, ["c1", "c2"])[1], "no evidence for c2")
        self.assertEqual(parse_worker({"evidence": [{**piece, "passed": "4"}, other]}, ["c1", "c2"])[0], None)
        self.assertEqual(parse_worker({"evidence": [{**piece, "criterion": "c9"}, other]}, ["c1", "c2"])[0], None)


if __name__ == "__main__":
    unittest.main()
