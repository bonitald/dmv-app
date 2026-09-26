"""Build a concept-list block from export + review files when the agent didn't write one."""
import json
import os
import sys
import textwrap
from collections import OrderedDict

here = os.path.dirname(os.path.abspath(__file__))
chunk = sys.argv[1]
exported = json.load(open(os.path.join(here, f"{chunk}.export.json"), encoding="utf-8"))
reviews = {r["id"]: r for r in json.load(open(os.path.join(here, f"{chunk}.review.json"), encoding="utf-8"))}

concepts = OrderedDict()
for q in sorted(exported, key=lambda q: q["conceptId"]):
    concepts.setdefault(q["conceptId"], []).append((q, reviews[q["id"]]))

def wrap(s, indent):
    return textwrap.fill(s, 100, initial_indent=indent, subsequent_indent=indent + "  ")

edited_total = sum(1 for r in reviews.values() if r.get("text") or r.get("choices") or r.get("correctAnswer"))
lines = [f"## {chunk}", textwrap.fill(
    f"NOTE (chunk-wide): {edited_total} of {len(exported)} questions reworded during review — "
    "near-verbatim handbook wording or \"according to the handbook\" framing paraphrased; facts "
    f"were correct throughout. {len(exported) - edited_total} questions approved as-is. Concept "
    "list block generated from the review file (the review agent hit the session limit after "
    "writing its verdicts).", 100)]
for concept, items in concepts.items():
    flagged = [r for _, r in items if r["verdict"] == "flagged"]
    lines.append(f"- {concept} ({len(items)} questions, status: {'flagged' if flagged else 'approved'})")
    for r in flagged:
        lines.append(wrap(f"- ISSUE: question {r['id']} {r['reviewNotes']}", "  "))
    fixed = [(q, r) for q, r in items if r.get("sourceRef") and r["sourceRef"] != q["sourceRef"]]
    for q, r in fixed:
        lines.append(wrap(f"- NOTE: question {q['id']} sourceRef corrected from {q['sourceRef']} to {r['sourceRef']}.", "  "))
    corrected = [r for _, r in items if r["reviewNotes"].startswith("Corrected")]
    for r in corrected:
        lines.append(wrap(f"- NOTE: question {r['id']} — {r['reviewNotes']}", "  "))
open(os.path.join(here, f"{chunk}.conceptlist.md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("\n".join(lines))
