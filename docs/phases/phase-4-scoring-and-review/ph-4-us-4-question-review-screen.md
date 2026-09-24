# Question review screen

**ID:** ph-4-us-4
**Layer:** Frontend
**Parent:** ph-4-us-2
**Status:** Not Started

## Story
As a teen user,
I want to step through a finished test question by question, with my answer and the right answer
clearly marked,
So that I can see exactly where I went wrong and learn the right answer.

## Context
- **Product area**: Phase 4 (`docs/phases.md`, second bullet).
- **Layer**: Frontend (Expo/React Native).
- Backed by ph-4-us-3 (text, choices, explanation on `perQuestion` / `baselineReview`) — not
  built yet. Until it lands, a review opened right after a test can use the questions still in
  memory from the runner; past attempts can't show text.
- Source data: the `scoreTest` response right after submitting, or the saved
  `users/{uid}/testAttempts/{testId}` doc later (client-readable). For the baseline, use
  `baselineReview` from the final section's attempt.
- Uses the quiz question card from ph-3-us-4 in a read-only "review" state: the user's choice and
  the correct choice are marked; this is where the Scenario question card mockup's answer
  feedback states and explanation panel belong (`docs/design/mockups.md`).
- When there's no explanation, the fallback is the handbook topic (`chunkId` → `topics` title),
  with a link to study that concept's flashcards (ph-2-us-3).

## Acceptance Criteria
- [ ] Given the user opens a review, when it loads, then the first question shows its text, all
  choices, the user's choice marked right or wrong, and the correct choice highlighted.
- [ ] Given the user skipped a question, when it's reviewed, then it shows "Not answered" and the
  correct choice.
- [ ] Given a question has an `explanation`, when it's reviewed, then the explanation panel shows
  it.
- [ ] Given a question has no explanation, when it's reviewed, then it shows "From the handbook:
  <topic title>" with a "Study this concept" link to that topic's flashcards.
- [ ] Given a review, when the user switches "Missed only" on, then only wrong and skipped
  questions are shown, and it's the default when there's at least one miss.
- [ ] Given a question is `unavailable`, when it's reviewed, then it shows "This question was
  removed" and isn't counted.
- [ ] Given a baseline that's still in progress, when its attempts are opened, then no review is
  offered (answers are held back until the baseline is complete).
- [ ] Given a scenario question, when it's reviewed, then it keeps the scenario treatment
  (ph-2-us-5).
- [ ] Given the device is offline, when the user opens a past attempt's review, then it loads
  from Firestore's local cache if it was loaded before, or shows the no-connection state.

## UI/UX Notes
- **Screens/flows**: results (ph-4-us-1, ph-2-us-9, ph-4-us-6) or missed questions (ph-4-us-5) →
  review. Swipe or Next/Previous between questions; a question strip showing right/wrong dots.
- Right in `success`, wrong in `alert`, per existing tokens.

## Dependencies
- **Parent**: ph-4-us-2 — the user-facing review.
- **Backed by**: ph-4-us-3 (not built yet); `scoreTest` / `testAttempts` (ph-1-us-11, built).
- **Blocked by**: ph-3-us-4 (quiz card to reuse).

## Test Notes
- **Happy path**: review a 25-question practice test, missed-only on and off.
- **Edge cases**: all correct (missed-only has nothing; show "No misses" and turn the filter
  off); all skipped; a question with explanation and one without; baseline review of 45.
- **Failure modes**: attempt doc missing text (pre-ph-4-us-3) shows "question text
  unavailable"; offline with nothing cached.

## Tasks
- [ ] Add a "review" state to the quiz question card (marked choices, explanation panel).
- [ ] Build the review screen (navigation, question strip, missed-only filter).
- [ ] Load from a `scoreTest` result or a `testAttempts` doc (including `baselineReview`).
- [ ] Topic-title fallback and "Study this concept" navigation into the Study tab.

## Questions
None outstanding.
