"""Report final (post-review) question text/choices sharing an N-word run with the handbook."""
import glob
import json
import os
import re
import sys

here = os.path.dirname(os.path.abspath(__file__))
N = int(os.environ.get("NGRAM", "8"))


def words(s):
    return re.findall(r"[a-z0-9%$]+", s.lower().replace("’", "'").replace("'", ""))


handbook = []
for path in sorted(glob.glob(os.path.join(here, "..", "pages", "page-*.txt"))):
    handbook += words(open(path, encoding="utf-8").read())
grams = {tuple(handbook[i:i + N]) for i in range(len(handbook) - N + 1)}

total = 0
for chunk in sys.argv[1:]:
    exported = {q["id"]: q for q in json.load(open(os.path.join(here, f"{chunk}.export.json"), encoding="utf-8"))}
    reviews = {r["id"]: r for r in json.load(open(os.path.join(here, f"{chunk}.review.json"), encoding="utf-8"))}
    for qid, q in exported.items():
        r = reviews.get(qid, {})
        if r.get("verdict") == "flagged":
            continue
        fields = [("text", r.get("text", q["text"]))] + [
            (f"choice{i}", c) for i, c in enumerate(r.get("choices", q["choices"]))
        ]
        for name, value in fields:
            w = words(value)
            hits = [" ".join(w[i:i + N]) for i in range(len(w) - N + 1) if tuple(w[i:i + N]) in grams]
            if hits:
                total += 1
                print(f"{chunk} {qid} {name}: \"{hits[0]}\"  <- {value}")
print(f"{total} field(s) with a {N}-word handbook run")
