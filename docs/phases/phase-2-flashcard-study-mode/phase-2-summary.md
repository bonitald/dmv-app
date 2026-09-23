# Phase 2: Flashcard Study Mode — Summary

## Status: Not Started

Depends on Phase 1 (question bank). Only one of this phase's four `docs/phases.md` bullets
(browsing by topic) needed a Backend/Frontend split — the other three are locally-scoped or
purely client-side ordering/rendering logic and stay single stories.

## Stories

| ID | Title | Layer | Parent | Status |
|----|-------|-------|--------|--------|
| ph-2-us-1 | Browse flashcards organized by topic | Parent | — | Not Started |
| ph-2-us-2 | `listFlashcardsByTopic` callable Cloud Function | Backend | ph-2-us-1 | Not Started |
| ph-2-us-3 | Flashcard browse UI by topic | Frontend | ph-2-us-1 | Not Started |
| ph-2-us-4 | Weak/missed cards resurface more often | Parent | — | Not Started |
| ph-2-us-5 | Scenario cards woven into the flashcard flow | Parent | — | Not Started |
| ph-2-us-6 | Local per-card performance tracking | Parent | — | Not Started |

## Key decisions made during planning

- **Flashcard browsing needs a second Cloud Function** (`listFlashcardsByTopic`, ph-2-us-2),
  mirroring `assembleTest` from Phase 1. `firestore.rules` stays deny-all on `questions`
  (ph-1-us-1) — browsing by topic can't use a direct client query, so it goes through a paginated
  callable function instead, extending Phase 1's extraction-prevention decision to this second
  read path.
- **`ph-2-us-4` (resurfacing), `ph-2-us-5` (scenario cards), and `ph-2-us-6` (local performance
  tracking) each stay single stories with no Backend/Frontend split** — they're either pure
  client-side logic/rendering over data the backend already returns (scenario `type` flag was
  already added in ph-1-us-1) or explicitly local-only per `docs/phases.md`'s own wording
  ("tracked locally"). Splitting them would have produced hollow Backend children with no real
  content.
- **Flashcard performance data is local-only for MVP, not synced to Firestore** — consistent with
  `prd.md` not calling for cross-device sync of study performance, and with the already-accepted
  device-identity-doesn't-survive-reinstall limitation from Phase 0.

## Open items carried into implementation

- Full-topic flashcard browsing is in some tension with Phase 1's bulk-extraction-prevention
  goal (a client can still page through an entire topic, and eventually every topic) — flagged
  as an open product/security tradeoff on ph-2-us-2 rather than resolved unilaterally, since
  topic-organized browsing is an explicit `prd.md` Must-have.
- Exact weak-card weighting formula is unspecified — ph-2-us-4 starts with a simple, tunable
  formula rather than a fully-designed spaced-repetition curve.
- Whether local per-card performance data should ever sync to Firestore (e.g. surviving a
  reinstall, or feeding Phase 5/8 pass-rate analysis) is unresolved — flagged on ph-2-us-6 as a
  future consideration, not built now.
- Whether `Flashcard` becomes its own Firestore entity distinct from `Question` (`prd.md` Section
  7 leaves this open) is deferred — ph-2-us-2 assumes a 1:1 mapping to `Question` for MVP.
