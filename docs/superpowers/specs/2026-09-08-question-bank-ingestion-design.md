# Question Bank Ingestion Pipeline — Design

> Companion to `docs/prd.md` and `docs/phases.md` Phase 1. This pipeline is tooling that
> *produces* content for Phase 1's `questions` collection — it is not itself one of Phase 1's
> user-facing engineering stories, and runs outside the app's normal dev workflow.

## Problem

The CO DMV written-permit-test practice app needs a question bank in Firestore, generated from
the CO DMV Driver Handbook PDF (prose, not an existing Q&A source). Per `prd.md` Section 8,
content must be paraphrased/generated, not reproduced verbatim, and each question must trace back
to a source reference. The bank needs both fact-recall and scenario-style questions
(`prd.md` Section 1's core differentiator), multiple phrasing variations per underlying
rule/fact, and a review gate so nothing incorrect reaches real users before a real DMV test.

## Non-goals

- Not building a general-purpose content-authoring tool for ongoing question edits after this
  initial ingestion — Phase 1 already covers "add/update questions without an app release" as an
  ongoing capability; this pipeline is the *initial bulk population* mechanism.
- Not building a custom review UI. Firebase console is the reviewer interface for v1 — a
  dedicated review tool can be scoped separately later if review volume makes the console
  painful.
- Not handling non-Colorado handbooks or future-edition diffing. Single handbook, single run
  (repeatable if the handbook changes).

## Architecture

Two phases, both driven as Claude Code subagent work (not a standalone script), run from within
this repo's Claude Code session:

### Phase A — Chunk Plan

Run once per handbook (or handbook edition). A subagent reads the full PDF text and produces a
**topic-driven** chunk plan — chunks are drawn at natural section/heading boundaries, not fixed
page counts, so a single topic that runs from the bottom of page 12 into page 13 stays one chunk
rather than being split and processed with partial context. The plan is written to Firestore as
one `ingestionRuns/{runId}` document before any question generation starts, and is the source of
truth for progress/resumability in Phase B.

### Phase B — Chunk Processing (looped, resumable)

For each chunk in the plan with `status: 'pending'` (in order):

1. Re-read that chunk's page range (title + description from the plan give the subagent context
   on what the chunk is about, so it isn't inferring topic boundaries again).
2. Extract the distinct testable facts/rules on that chunk's pages.
3. For each fact: draft one base question + 2-3 phrasing variations (mix of fact-recall and
   scenario framing), all sharing a `conceptId`.
4. Run a self-check pass (see below) over everything just drafted for this chunk.
5. Write all resulting `questions/{questionId}` docs to Firestore.
6. Flip this chunk's `status` to `'done'` in the `ingestionRuns` doc (or `'error'` with a note, if
   something went wrong) and record `questionsGenerated`.
7. Continue to the next `pending` chunk.

Because progress is tracked in Firestore per-chunk, re-invoking the pipeline after an interrupted
run (e.g. a Claude Code session ending mid-handbook) automatically resumes at the first
non-`done` chunk — no separate checkpoint file, no manual resume-page tracking.

This should be driven as a **loop within one Claude Code session** using the SDK's TodoWrite /
iterative-dispatch pattern: one task per chunk, dispatched (or processed inline) in sequence,
each task's completion advancing to the next until the plan is exhausted or the user stops it.

## Data schema

```
ingestionRuns/{runId}
  sourceDoc: string           // e.g. "co-dmv-handbook-2026.pdf"
  createdAt: timestamp
  status: 'planning' | 'processing' | 'complete'
  chunks: [
    {
      chunkId: string
      title: string            // e.g. "Right-of-Way at Intersections"
      pageStart: number
      pageEnd: number
      status: 'pending' | 'done' | 'error'
      questionsGenerated: number
      error: string | null
    }
  ]

questions/{questionId}
  conceptId: string            // groups variations of the same underlying fact/rule
  chunkId: string              // traces back to ingestionRuns chunk
  sourceRef: string            // page/section reference — legal requirement, prd.md Section 8
  type: 'fact' | 'scenario'
  text: string
  choices: string[]
  correctAnswer: string
  status: 'pending_review' | 'flagged' | 'approved' | 'rejected'
  selfCheck: {
    passed: boolean
    notes: string              // present when passed === false
  }
  reviewedBy: string | null
  reviewedAt: timestamp | null
  reviewNotes: string | null
  createdAt: timestamp
```

Variations are **separate documents** sharing a `conceptId`, not an array inside one document —
this lets Phase 2 (weak-card resurfacing), Phase 3 (test assembly), and Phase 4 (per-question
review) treat every variation as an ordinary, independently-trackable `Question`, while still
letting a reviewer query `where('conceptId', '==', x)` to see a whole concept's variations
together.

The app's Firestore queries, from Phase 2 onward, only ever read
`where('status', '==', 'approved')` — `pending_review`, `flagged`, and `rejected` questions are
never visible in the app.

## Self-check + human review workflow

The self-check is a **distinct second prompt pass**, not the same reasoning that drafted the
question (fresh eyes catch more). For each drafted question it verifies:

- Exactly one choice is unambiguously correct per the source text.
- Distractors are plausible but clearly wrong — not trick/ambiguous wording.
- Nothing is fabricated beyond what the source chunk's pages actually state.
- Wording is a clear, complete sentence a 15-16 year old would understand.

Anything failing a check → `status: 'flagged'`, `selfCheck.notes` explains why. Anything passing
→ `status: 'pending_review'` (still gated, just not flagged as high-risk).

Human review happens in the **Firebase console**: filter `status == 'flagged'` and review those
first, then spot-check a random sample of `status == 'pending_review'`. Approving flips `status`
to `'approved'` (editing fields first if wording needs a tweak); rejecting flips it to
`'rejected'` (excluded from the app, kept rather than deleted, for audit/debugging the
generation prompt later).

Nothing reaches the app without an explicit `'approved'` status — self-check reduces review
burden, it does not replace review.

## Subagent prompts

### Phase A prompt (chunk plan)

```
You are building a topic-driven chunk plan for the CO DMV Driver Handbook PDF at <path>.

Read the entire document. Identify the natural topic/section boundaries (chapter headings,
sub-section headings, or clear topic shifts in the prose) — a chunk must never split a single
rule or topic across two chunks just because it crosses a page boundary. If a topic starts on
page 12 and finishes on page 13, that is ONE chunk spanning pages 12-13.

For each chunk, output:
  - title: short human-readable topic name
  - pageStart, pageEnd
  - description: one sentence on what this chunk covers (used later to give a chunk-processing
    subagent context without re-reading the whole document)

Skip chunks that are pure boilerplate/no testable content (title pages, table of contents, index,
appendix forms) — do not generate a chunk entry for those.

Write the result as an `ingestionRuns/{runId}` document per the schema in
docs/superpowers/specs/2026-09-08-question-bank-ingestion-design.md, with every chunk's status
set to 'pending'.
```

### Phase B prompt (per chunk — looped)

```
You are generating DMV practice-test questions for one chunk of the CO DMV Driver Handbook.

Chunk: <chunkId> — "<title>" (pages <pageStart>-<pageEnd>)
Chunk description: <description>

1. Read pages <pageStart>-<pageEnd> of <path>.
2. Identify every distinct testable fact or rule stated on these pages.
3. For each fact/rule, draft:
   - ONE base question
   - 2-3 phrasing variations of the same underlying fact — vary wording, vary which distractors
     appear, and mix fact-recall phrasing with scenario/situational framing
     (e.g. "You're approaching a 4-way stop and another car arrives at the same time...")
   All variations of one fact share the same conceptId (generate a stable id per fact).
4. Every question must be PARAPHRASED, never copied verbatim from the handbook text (legal
   requirement — prd.md Section 8). Every question must include a sourceRef pointing back to the
   page/section it came from.
5. Do not fabricate any rule, number, or exception not actually stated on these pages.
6. Classify each question's `type` as 'fact' or 'scenario'.

Then, as a SEPARATE self-check pass (re-read what you just drafted with fresh scrutiny, don't
reuse your generation reasoning), for each question verify:
   - exactly one choice is unambiguously correct per the source text
   - distractors are plausible but clearly wrong, not ambiguous/trick wording
   - nothing is fabricated beyond the source pages
   - wording is clear and complete for a 15-16 year old reader
   Set status to 'flagged' (with selfCheck.notes explaining why) if any check fails, otherwise
   'pending_review'.

Write all resulting questions to the `questions` collection per the schema in
docs/superpowers/specs/2026-09-08-question-bank-ingestion-design.md.

Finally, update this chunk's entry in the `ingestionRuns/{runId}` document: set status to 'done'
and questionsGenerated to the count you wrote. If anything failed (couldn't read pages, Firestore
write error), set status to 'error' with a note instead, and do not mark it done.
```

## Testing / validation

- Run Phase A once, manually inspect the resulting chunk plan in Firestore for sane
  page ranges before starting Phase B (cheap to eyeball, expensive to redo generation on a bad
  plan).
- After the first few Phase B chunks, manually review a sample in the Firebase console to
  validate the self-check pass is actually catching what it should — tune the prompt if it's
  systematically too lenient or too strict before running the rest of the handbook.
- Track `questionsGenerated` per chunk and total `flagged` vs `pending_review` counts as a rough
  health signal for the run.

## Open questions (carried forward, not blocking)

- Exact target question-bank size / number of distinct practice tests is still undefined per
  `prd.md` Section 9 — this pipeline generates from handbook content coverage, not a fixed count;
  revisit sizing after the first full run.
- Whether a dedicated review tool (beyond Firebase console) is worth building depends on review
  volume in practice — defer that decision until after the first run's flagged/pending counts are
  known.
