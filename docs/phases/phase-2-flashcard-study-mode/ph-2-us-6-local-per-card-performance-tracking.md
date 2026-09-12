# Local per-card performance tracking

**ID:** ph-2-us-6
**Layer:** Parent
**Status:** Not Started

## Story
As a teen user,
I want the app to remember which flashcards I've seen and gotten wrong,
So that the app can prioritize showing me what I actually need to practice (ph-2-us-4), without
me having to manually flag "weak" cards myself.

## Context
- **Product area**: Phase 2 (`docs/phases.md`)
- **Layer**: Frontend (Expo/React Native) — no Backend split. `docs/phases.md`'s Phase 2 bullet
  is explicit that this is tracked "locally," and `prd.md` doesn't call for cross-device sync of
  study performance — only the driving log and pass/fail outcome are described as
  device-identifier-linked Firestore data (`prd.md` Section 7). Treat local-only as the deliberate
  MVP scope, not an oversight.
- This is the data source ph-2-us-4's weighting logic reads from — build this first, or at least
  land its interface first, since ph-2-us-4 is blocked on it.

## Acceptance Criteria
- [ ] Given a teen user answers a flashcard (correct/incorrect, or reveals-and-self-assesses,
  depending on the viewer's interaction model from ph-2-us-3), when the result is recorded, then
  local storage is updated with that card's seen count, miss count, and last-seen result.
- [ ] Given the app is closed and reopened, when the user returns to a previously-studied topic,
  then their prior performance history for those cards is still present (not reset).
- [ ] Given a card has been seen before, when performance data is read, then it correctly reflects
  cumulative history (not just the most recent single result) — miss count and seen count must
  both persist and accumulate.
- [ ] Given local storage is empty/uninitialized for a card (first time seeing it), when
  performance is read, then it returns a clear "no history" result rather than throwing or
  returning a misleading zero/default that looks the same as "answered correctly every time."

## Dependencies
- **Blocked by**: ph-2-us-3 (flashcard viewer this hooks into for capturing results).
- Feeds: ph-2-us-4 (weak-card resurfacing reads this data).

## Test Notes
- **Happy path**: answer a card wrong twice, right once; stored history reflects 3 seen, 2
  missed, most-recent result correct.
- **Edge cases**: a card studied across two separate app sessions (persistence survives app
  restart); very large history (many topics/cards) doesn't noticeably slow the app.
- **Failure modes**: local storage read/write failure (e.g. storage full or corrupted) should
  degrade to treating the card as "no history" rather than crashing the flashcard flow.

## Tasks
- [ ] Choose and set up the local storage mechanism (e.g. AsyncStorage, or SQLite if the driving
  logger's storage work from Phase 6 lands first and a shared mechanism makes sense) — keep the
  read/write interface isolated so ph-2-us-4 doesn't need to know the storage implementation.
- [ ] Implement record-result and read-history functions keyed by card id.
- [ ] Wire result recording into the flashcard viewer's reveal/advance interaction (ph-2-us-3).

## Questions
- Whether this local performance data should ever sync to Firestore (e.g. to survive a
  reinstall, or to feed the pass-rate analysis in Phase 5/8) is not addressed in `prd.md` —
  flagging as a future consideration rather than building sync now, consistent with the
  device-identity-doesn't-survive-reinstall limitation already accepted in `docs/phases.md`
  Phase 0.
