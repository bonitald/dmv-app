# Question review brief (shared by every review agent)

You are the human-review gate for a Colorado DMV written-permit practice app for teens (15-16).
Every question you approve goes live to real students preparing for the real test, so accuracy
matters more than speed. You review ONE chunk (topic section) of the question bank.

Scratchpad root (call it SP):
`C:/Users/eldyd/AppData/Local/Temp/claude/c--Users-eldyd-OneDrive-Documents-SlateStack-Apps-dmv-app/43768de4-34e8-44ac-9add-d2aad1437f19/scratchpad`

## Inputs
- `SP/review/<chunkId>.export.json` — every pending_review question in your chunk.
- `SP/pages/page-NN.txt` — text extracted from the Colorado Driver Handbook PDF, one file per
  PDF page. **sourceRef "p.N" means PDF page N = `page-NN.txt`** (zero-padded, e.g. p.5 →
  page-05.txt). The file header shows this. Read your chunk's pages AND one page either side
  (topics straddle pages; wrong sourceRefs are usually off by one).
- Do NOT read the PDF itself, do NOT touch Firestore, do NOT edit any file in the repo.

## Rules every question must pass (from the ingestion spec + README)
1. Exactly one choice is unambiguously correct per the handbook text.
2. Exactly **4 choices**. `correctAnswer` must match one choice string character-for-character.
3. Distractors are plausible but clearly wrong — no trick/ambiguous wording, no distractor that
   is arguably also correct.
4. Nothing fabricated beyond what the handbook pages actually state (numbers, exceptions, ages,
   distances, fines, points — check every one).
5. Clear, complete wording a 15-16 year old understands.
6. **Paraphrased, never copied.** Legal requirement. Reword when the stem, the correct answer, or a
   distractor reuses a distinctive handbook clause verbatim or near-verbatim (roughly 8+ word
   run, or the handbook sentence with only synonym swaps / reordering). Also reword any
   "according to the handbook / what does the handbook say/recommend" framing — questions should
   read as normal driving-knowledge questions. Rewording must keep the meaning, keep 4 choices,
   and keep the correct answer in the SAME array position.
7. Colorado-only: flag anything depending on another state's rule or on general/federal info
   that contradicts Colorado law.
8. sourceRef must point at the PDF page where the fact actually appears; correct it if wrong.

## Verdicts
- **approved** — passes as-is, or passes after you reword (rule 6), fix sourceRef (rule 8), or
  make a small, unambiguous correctness fix where the handbook clearly states the right answer
  (e.g. a mislabeled term, a threshold phrased ">=" where the handbook says "over"). Say exactly
  what you changed in reviewNotes.
- **flagged** — needs a content decision you can't make from the source alone: the handbook
  doesn't support the fact, the question is ambiguous and fixing it would change what it tests,
  two choices are defensibly correct, or the fact can't be verified because the relevant page is
  image-only / missing from the text extraction (PDF pages 31-32 extract as nearly empty). Do NOT
  guess from general driving knowledge to approve something the text doesn't show. Leave
  text/choices unchanged on flagged questions; explain precisely in reviewNotes (quote the
  handbook, name the page, propose the fix).
- Never use `rejected`, never leave a question out.

## Outputs (write both, then reply)
1. `SP/review/<chunkId>.review.json` — JSON array with ONE entry for EVERY question in the export:
   ```json
   {
     "id": "<question id>",
     "verdict": "approved" | "flagged",
     "reviewedBy": "claude-agent-review-pilot",
     "reviewNotes": "...",
     "sourceRef": "p.N",          // only if you changed it
     "text": "...",               // only if you changed it
     "choices": ["a","b","c","d"],// only if you changed any choice (always all 4)
     "correctAnswer": "..."       // include whenever choices change or the answer text changes
   }
   ```
   reviewNotes styles (keep them factual, one or two sentences):
   - as-is: `"Verified against handbook p.N; approved as-is."`
   - reworded: `"Auto-reworded during review: <what was near-verbatim/framed>; content unchanged."`
   - corrected: `"Corrected during review: <what and why, citing p.N>."`
   - flagged: full explanation as described above.
   Then run the verbatim checker on your chunk:
   `PYTHONIOENCODING=utf-8 python SP/review/verbatim.py <chunkId>` — it lists every final stem or
   choice (flagged ones excluded) that shares an 8-word run with the handbook. Reword each hit
   unless the run is an unavoidable fixed term (e.g. "rear-facing child restraint system in the
   rear seat"). Also compare answers to the handbook by eye — a synonym-swapped handbook sentence
   won't show up in the checker but still violates rule 6.
   Validate the file yourself before finishing (e.g. a short `node -e` script): parseable,
   same count and ids as the export, every choices array length 4, every correctAnswer (new or
   original) is in its choices.
2. `SP/review/<chunkId>.conceptlist.md` — the block that will replace this chunk's section in
   `docs/dmv-reference/concept-list.md`, matching the existing style exactly. Example of the
   format (from already-reviewed chunks):
   ```
   ## <chunkId>
   NOTE (chunk-wide): 21 of 35 questions reworded during review — <why>; facts were correct
   throughout. 14 questions approved as-is.
   - concept-a (3 questions, status: approved)
   - concept-b (3 questions, status: approved)
     - NOTE: 1 question reworded during review — <why>; content unchanged.
   - concept-c (3 questions, status: flagged)
     - ISSUE: question <id> <what's wrong, handbook page, what decision is needed>. The other 2
       questions in this concept were reviewed and approved.
   ```
   Concept status is `flagged` if any of its questions is flagged, else `approved`. Use a
   chunk-wide NOTE when most of the chunk was reworded for the same reason (then skip repeating
   it per concept); use per-concept NOTEs for anything specific (sourceRef corrections,
   correctness fixes, reworded distractors). Wrap lines at ~100 chars.

## Reply to the orchestrator (keep it short — under 150 words)
Counts: approved as-is / reworded / corrected / flagged. List each flagged question id with a
one-line reason. Nothing else — the files carry the detail.
