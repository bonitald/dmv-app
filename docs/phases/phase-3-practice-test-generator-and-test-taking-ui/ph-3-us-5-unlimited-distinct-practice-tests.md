# Unlimited, distinct practice tests

**ID:** ph-3-us-5
**Layer:** Parent
**Children:** ph-3-us-6 (Backend)
**Status:** Not Started

## Story
As a teen user,
I want to take as many practice tests as I like, for free, and get different questions each time,
So that practicing again actually teaches me something new instead of repeating the test I just
took.

## Context
- **Product area**: Phase 3 (`docs/phases.md`, third bullet); `prd.md` Section 2 MVP goal
  "unlimited practice tests, free" and Section 5 "Practice test generator" (Must). No paywall,
  no usage cap in MVP (`prd.md` Section 6, monetization deferred).
- **Layer**: mostly Backend. `assembleTest` currently allows repeats across a user's tests
  (ph-1-us-4 flagged this: "revisit if practice starts feeling repetitive"). ph-3-us-6 adds
  repeat-avoidance.
- **No Frontend child**: "start another test" is just starting a test again from the Practice tab
  or the results screen, which ph-3-us-4 and Phase 4 already cover. A separate frontend child
  would be empty.
- Unlike `getFlashcards`, `assembleTest` has no rate limit and should keep none: it never returns
  answers, so repeated calls can't scrape the answer key, and a cap would contradict
  "unlimited".
- `freeTestUsedAt` (the future subscription's "free test") is set by the **baseline** only
  (ph-1-us-8). Practice tests never touch it, and nothing is gated in MVP.

## Acceptance Criteria
- [ ] Given a user has taken any number of practice tests, when they start another, then it's
  assembled with no paywall, limit, or "come back later" message.
- [ ] Given a user has recently taken practice tests, when a new one is assembled, then it avoids
  questions from their recent tests as far as the approved pool allows (ph-3-us-6).
- [ ] Given a user starts a practice test, when it completes, then `freeTestUsedAt` is unchanged.

## Dependencies
- **Children**: ph-3-us-6 (repeat-avoidance in `assembleTest`).
- **Uses**: ph-3-us-4 (start a test), Phase 4 (results screen's "take another test").
