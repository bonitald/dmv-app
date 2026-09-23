# Question Bank Ingestion Scripts

CLI tools used by the question-bank ingestion pipeline
(`docs/superpowers/specs/2026-09-08-question-bank-ingestion-design.md`) to write Firestore
content. Subagents invoke these via `Bash` — they do not have direct Firestore access.

All three commands authenticate via Application Default Credentials
(`gcloud auth application-default login`) against the `dmv-app-dev` Firestore project by
default. Override the project with `GOOGLE_CLOUD_PROJECT=<project-id>`. Never point
`GOOGLE_CLOUD_PROJECT` at `dmv-app-prod` when running these scripts or their tests.

Run this package's own test suite with `npm run test:question-bank` (starts the Firestore
emulator and runs the full `jest.scripts.config.js` suite against it).

## `qb:write-chunk-plan` (Phase A, run once)

```bash
npm run qb:write-chunk-plan -- /path/to/chunk-plan.json
```

Input JSON shape:

```json
{
  "sourceDoc": "DR_2337_Jan2025.pdf",
  "chunks": [
    {
      "chunkId": "right-of-way",
      "title": "Right-of-Way at Intersections",
      "description": "Rules for who yields at 4-way stops, uncontrolled intersections, and roundabouts",
      "pageStart": 12,
      "pageEnd": 13
    }
  ]
}
```

Prints the generated `runId` to stdout — record it, every later command needs it.

## `qb:read-chunk-plan` (resuming an interrupted run)

```bash
npm run qb:read-chunk-plan -- <runId>
```

Prints the full `ingestionRuns/<runId>` document as JSON — `sourceDoc`, overall `status`, and
every chunk's `status`/`questionsGenerated`/`error`. If a driving session (or a Claude Code
session) is interrupted partway through the handbook, run this first: it tells you exactly
which chunks are still `pending` versus `done`/`error`, so Phase B dispatches can resume at the
first non-`done` chunk instead of restarting from the beginning or requiring hand-tracked state.

## `qb:update-chunk-status` (Phase B, once per chunk)

```bash
npm run qb:update-chunk-status -- <runId> <chunkId> pending
npm run qb:update-chunk-status -- <runId> <chunkId> done --questionsGenerated 6
npm run qb:update-chunk-status -- <runId> <chunkId> error --error "page 13 unreadable"
```

`status` must be exactly one of `pending`, `done`, or `error` — `pending` is used to put a
chunk back in flight (e.g. a manual retry).

Marking the last remaining chunk `done` or `error` automatically flips the run's own `status`
to `complete`.

## `qb:write-questions` (Phase B, once per chunk, before marking it done)

```bash
npm run qb:write-questions -- /path/to/questions.json
```

Input JSON shape (array of questions — write all of one chunk's questions in a single call):

```json
[
  {
    "conceptId": "row-4way-stop",
    "chunkId": "right-of-way",
    "sourceRef": "p.12",
    "type": "scenario",
    "text": "You arrive at a 4-way stop at the same time as another car to your right. Who goes first?",
    "choices": ["The car to your right", "You, because you arrived first", "Whoever is faster"],
    "correctAnswer": "The car to your right",
    "selfCheck": { "passed": true, "notes": "" }
  }
]
```

`status` is set automatically: `pending_review` if `selfCheck.passed` is `true`, `flagged`
otherwise. Nothing written by this script is ever `approved` — that only happens via human
review in the Firebase console.

## `qb:publish-topics` (after review, repeatable)

```bash
npm run qb:publish-topics -- <runId>
```

Reads the ingestion run's chunk plan and writes one `topics/{chunkId}` doc per chunk (`title`,
`description`, `order` from the chunk's `pageStart`, and `approvedQuestionCount` — a live count
of that chunk's `approved` questions). This is the read-only topic catalog the app's flashcard
browse UI and baseline assembly section ordering (ph-1-us-8, ph-1-us-9) consume.

Safe to re-run at any time after more questions are reviewed/approved — it's idempotent, always
recomputing `approvedQuestionCount` from the current `questions` collection rather than
incrementing. It holds no question content by design: only title/description/order/count, so a
client reading `topics/{chunkId}` can never extract question text.

## `qb:build-baseline` / `qb:validate-baseline` (fixed baseline diagnostic, ph-1-us-8)

```bash
npm run qb:build-baseline -- v1 /path/to/baseline-selection.json
npm run qb:validate-baseline -- v1
```

`baseline-selection.json` maps each topic to the one approved question a human reviewer
hand-picked for its baseline slot — exactly 45 entries, one per topic:

```json
{
  "right-of-way": "<approved questionId>",
  "freeway-entering-and-driving": "<approved questionId>"
}
```

`build-baseline` checks every question exists, is `approved`, and belongs to the topic it's
listed under, then writes `baselineTests/<version>` as 3 sections of 15, ordered by
`topics/{chunkId}.order`. **Run `qb:publish-topics` first** — a topic missing from `topics`
fails the build. The app reads version `v1`, so use that name for the live baseline.

`validate-baseline` re-checks a published baseline against the current bank and exits non-zero
listing any question that is no longer `approved`. It never swaps questions itself — replace
them in the selection file and re-run `build-baseline`. Re-run it after each review pass.
