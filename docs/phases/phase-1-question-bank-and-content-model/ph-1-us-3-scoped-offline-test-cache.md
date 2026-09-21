# Scoped offline caching for an in-progress test

**ID:** ph-1-us-3
**Layer:** Parent
**Children:** ph-1-us-4 (Backend), ph-1-us-5 (Frontend)
**Status:** Not Started

## Story
As a teen user,
I want the question set for a practice test I've started to be available on my device even if I
lose connectivity mid-test,
So that I'm not interrupted or lose progress partway through a test.

## Context
- **Product area**: Phase 1 (`docs/phases.md`) — narrowed scope, see note below.
- **Layer**: cross-cutting (Backend Cloud Function + Frontend local cache)
- Originally scoped in `docs/phases.md` as caching "question and flashcard content... after
  first download" (i.e. the whole bank). That was deliberately narrowed during phase planning:
  caching the entire question bank on-device (or exposing it via an open Firestore query) would
  let any client bulk-extract all 1,400+ questions — a real risk for content that's expensive to
  generate and legally required to be paraphrased (`prd.md` Section 8). This story instead caches
  **only the specific question set assigned to one in-progress test**, fetched through a
  server-side assembly function rather than a direct collection read.
- General flashcard-mode offline caching (Phase 2) is explicitly out of scope here.

## Acceptance Criteria
- [ ] Given a teen user starts a practice test while online, when the test's question set is
  assembled, then only those specific questions are cached locally — not the full bank.
- [ ] Given a cached in-progress test, when the device goes offline mid-test, then the user can
  continue answering questions from the cached set without interruption.
- [ ] Given a test is completed or abandoned, when the session ends, then its cached question set
  is cleared from local storage (no indefinite local accumulation of question content).
- [ ] Given no direct Firestore read/query path to the `questions` collection exists for clients
  (ph-1-us-1), when a client is inspected/reverse-engineered, then the only way to obtain
  question content is by legitimately starting a test through the `assembleTest` function
  (ph-1-us-4), which returns a bounded set, not the whole bank.

## Scope update (2026-09-20)
The same "cache only what one session needs" mechanism now serves three kinds of sessions, not
just practice tests:
- **Practice test** — as originally written.
- **Concept mini-quiz** (ph-1-us-7) — small, short-lived; same cache and clear-on-finish rules.
- **Baseline section** (ph-1-us-8) — cache only the *current section's* questions. Unlike a
  practice test, an unfinished baseline is **not abandoned** when the user pauses: the baseline
  is a fixed set, and the user's progress is stored server-side, so it can resume, possibly on
  another phone. Local cache can be cleared safely when the section ends or the app is reset,
  since the server is the source of truth.
- Flashcards (ph-1-us-10) are not part of this story's cache; whether to cache them offline is a
  Phase 2 decision.

Additional acceptance criteria:
- [ ] Given a user pauses a baseline between sections, when they return (any device), then the
  local cache is rebuilt from the server's stored assignment rather than assumed to exist.
- [ ] Given a paused baseline, when the local cache is cleared, then the baseline itself is not
  treated as abandoned or lost.

## Dependencies
- **Blocked by**: ph-1-us-1 (schema + deny-all read rule), ph-1-us-4, ph-1-us-5.
- Related: ph-1-us-7 (topic mini-quiz), ph-1-us-8 (baseline).
- Loosely related to Phase 3 (`Test Attempt` recording) — this story builds the underlying
  "assemble and cache a scoped question set" mechanism; Phase 3 is what actually drives *when*
  a test starts and records its outcome. Phase 1 builds the primitive; Phase 3 wires it into a
  full test-taking flow.

## Notes
No separate Tasks/Test Notes here — see child stories ph-1-us-4 and ph-1-us-5.
