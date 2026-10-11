# Slice 4b — Mini-quiz, Recommendation and Progress — Design

> Companion to `docs/build-order.md` (Slice 4b). The stories are the detailed spec:
> ph-2-us-6, ph-2-us-8, ph-2-us-9, ph-2-us-4 and the concept report part of ph-4-us-6 (parent
> ph-2-us-10 holds the status transitions table). This doc records how they fit together and
> the decisions made on 2026-10-11 that the stories left open or that change them.

## Goal

A teen who has studied a topic's flashcards (or skipped them) takes a short quiz on that topic,
sees what they missed and a recommendation, and picks what to do next. Their next pass through
the topic concentrates on what they missed, and the Progress tab shows every topic as strong /
shaky / likely gap.

**Device test** (from `build-order.md`, extended): finish a deck → "Take the mini-quiz" → submit
→ results with missed questions and a recommendation → Review Again opens only the missed cards
→ "Show all cards" opens the full deck → retake → Come Back Later opens the next topic and the
first one shows "needs revisit" → reopen it: only its missed cards → Mark Reviewed → the list
shows "reviewed" → Progress tab shows the topic as strong / shaky / likely gap with "N of M
right in your latest quiz". Also: "Skip to quiz" on any card; a big topic gets more than
10 questions.

## Decisions (2026-10-11)

| # | Question | Decision | Changes a story? |
|---|----------|----------|------------------|
| 1 | Starting the quiz without the flashcards | A "Skip to quiz" link beside the card counter on every card (changed from first card only after device testing, 2026-10-11). Nothing new on the concept list. | Resolves ph-2-us-8's open question |
| 2 | "Come Back Later" status | Always `needs-revisit`, whatever the score. | Confirms ph-2-us-9's assumption |
| 3 | Mini-quiz results layout | One screen: score, recommendation, missed questions with the right answer, "Review answers" (existing `Review` screen), three choices. | No |
| 4 | Practice-test evidence in the strength rule | `conceptStrength` handles it now; the loader passes none until Slice 5a. | No |
| 5 | Progress tab order | Handbook order by default, with a "Needs work first" sort. | No |
| 6 | Mini-quiz force-quit resume | **Not stored.** Mini-quizzes stay out of `quizSession` (it holds one active test per user, so a mini-quiz would drop an in-progress baseline). A killed quiz is abandoned; a new one gets a new `testId`. Offline at submit still holds answers on screen. | Narrows ph-3-us-1 to baseline and practice |
| 7 | Quiz size | Scales with the topic: `round(approved / 3)`, at least 5, at most 15; all of them if fewer than 5. Decided **on the server** in `assembleMiniQuiz`; the client stops sending `count`. | Yes: ph-2-us-8 said "up to 10" |
| 8 | Review Again | Opens **only the cards missed** in that quiz (skipped count as missed), with "Show all cards". A perfect score opens the full deck. | Yes: ph-2-us-4 said every card appears once per pass |
| 9 | Reopening a *needs revisit* topic | Opens on only the cards missed in its last quiz, with "Show all cards". | Yes: ph-2-us-4 |
| 10 | "N of M right" on the report | `scoreTest` also saves `latestMiniQuizCorrect` and `latestMiniQuizTotal` on Concept Progress. Records from before this show the percentage only. | Yes: ph-2-us-11 schema |

`functions/` is already on Node 22 (7343149), so the backend changes can deploy.

## Backend

**`assembleMiniQuiz`** (`functions/src/assembleMiniQuiz.ts`): the count comes from the topic's
approved pool: `clamp(round(pool / 3), 5, 15)`, or the whole pool when it has fewer than 5.
`MAX_MINI_QUIZ_COUNT` becomes 15. An explicit `count` is still accepted and capped at 15 (keeps
the contract and existing tests); the app no longer sends one. `excludeIds` behaviour is
unchanged: repeats are allowed when the pool minus exclusions is smaller than the count.

**`scoreTest`** (`functions/src/scoreTest.ts`): the mini-quiz Concept Progress merge adds
`latestMiniQuizCorrect` (number) and `latestMiniQuizTotal` (number) beside the existing score
fields, in the same batch. Status is still untouched.

**Rules**: no change. The existing `conceptProgress` rule only lets clients write `status` and
`statusUpdatedAt`; a new rules test proves the two new fields are denied.

Both functions follow the `cloud-function-documentation` skill. `functions/README.md` documents
the scaled count and the new fields. Deploy functions to dev.

## Client data

**Card performance** (ph-2-us-6). Pure `src/study/cardPerformanceData.ts`, AsyncStorage layer
`src/study/cardPerformance.ts`.

- Key per user and topic: `dmv-app:card-perf:{uid}:{chunkId}` (the story's key plus the uid,
  like the other local keys, so Slice 6 can clear it on sign-out).
- Per question: `graded`, `missed`, `correctStreak`, `lastCorrect`. Per topic:
  `lastQuizMissedIds` (questions missed in the topic's most recent quiz, skipped included).
- `recordQuizResults(uid, perQuestion)`: groups by `chunkId`, skips `unavailable` and
  `correct: null` entries, replaces each topic's `lastQuizMissedIds`, and clears that topic's
  saved deck pass so the next open builds a fresh one.
- `readTopicHistory(uid, chunkId)`: an explicit "no history" when nothing is stored. Read or
  write failures are logged and read as no history.
- Local-only: after a reinstall, a *needs revisit* topic has no missed list and opens the full
  deck.

**Deck passes** (ph-2-us-4). `src/study/deckOrder.ts`:
`buildPass(cards, history, mode, random)`, random source injected.

| Mode | Cards | Order |
|---|---|---|
| `missed-only` | cards in `lastQuizMissedIds` | shuffled |
| `full` | every card, once | weighted shuffle: weight 3 if missed before and `correctStreak < 2`, else 1 (never graded = 1) |

`missed-only` falls back to `full` when it would be empty (perfect score, no history, or missed
IDs no longer in the deck). Weighted shuffle: key `random() ** (1 / weight)`, sort descending.

| Trigger | Pass |
|---|---|
| Review Again | `missed-only` |
| Open a *needs revisit* topic with no saved pass | `missed-only` |
| Open any other topic with no saved pass, "Start this concept over", "Show all cards", "See all cards" | `full` |
| Reopen with a saved pass | that pass, at the same card |

**Saved pass.** The per-topic deck position in `src/profile/localFlags.ts` grows from a card id
to `{ mode, cardIds, cardId }`, so resuming keeps the same order. An old plain-string value is
read as "no saved pass". End of deck clears it, as now.

**Concept Progress** (ph-2-us-12): `toProgress` also reads `latestMiniQuizCorrect` and
`latestMiniQuizTotal`. 4a carry-forward: the viewer and the list ignore a first snapshot that is
empty and from cache only, so a stale cache can't make a reviewed topic look not started (and
trigger `markOpened`).

**Strength** (ph-4-us-6). Pure `src/progress/conceptStrength.ts`:
`conceptStrength(evidence) → { strength, source, correct?, total? }`, implementing the rule on
ph-4-us-6 (mini-quiz → practice with ≥ 3 answers → baseline Got it / Missed it → not tested;
bands 80 / 50). `useConceptEvidence` combines `useTopics`, `useConceptProgress` and the final
baseline attempt (`useBaselineProgress` → `useTestAttempt(baseline-{version}-3)` →
`baselineReview`). Practice evidence is empty until 5a.

## Screens and navigation

**Routes**: `MiniQuiz: { chunkId }` (unchanged). `Flashcards: { chunkId, pass?: { mode:
'missed-only' | 'full'; nonce: number } }` — a new `pass` param starts that pass in the mounted
viewer (4a carry-forward: Review Again returns to the existing route with `popTo`, no remount, no
`getFlashcards` call).

**`MiniQuizScreen`** (ph-2-us-8) replaces the placeholder. One screen, phases *loading →
running → results*, like `BaselineScreen`.

- Loading: `markOpened(chunkId)`; `assembleMiniQuiz({ chunkId, excludeIds })`, `excludeIds`
  from an in-memory map of each topic's last quiz question IDs. `not-found` → "Nothing here
  yet"; offline → `NoConnection` with retry; other errors → "Something went wrong" + Try again.
- Running: `QuizRunner`, title "Mini-quiz · {topic title}". Leaving asks for confirmation
  (`usePreventRemove`).
- Submit: `scoreTest`. Offline → `waiting-for-connection` holds the answers and sends them when
  back online. `already-exists` → read that attempt (`useTestAttempt`) and show it. Success →
  `recordQuizResults(uid, perQuestion)` (a failure there is logged; results still show) →
  results.

**Results** (ph-2-us-9), same screen:

- "7 of 10 · 70%".
- Recommendation: `move-on` → "You've got this one — ready to move on."; `review-again` →
  "Worth another look before moving on."
- Missed questions: question, your answer (or "Skipped"), the right answer. None missed →
  "You got every one right."
- "Review answers" → `Review` with this `testId`.
- Three buttons, the recommended one primary, the others secondary but enabled:
  - **Review Again**: `setStatusFromChoice('review-again')` → `popTo('Flashcards', { chunkId,
    pass: { mode: 'missed-only', nonce } })`.
  - **Come Back Later, Continue to Next Concept**: `needs-revisit` → next topic by `order` with
    `approvedQuestionCount > 0`; replaces Flashcards(A) + MiniQuiz(A) with Flashcards(B). Last
    topic → concept list.
  - **Mark Reviewed**: `reviewed` → concept list.
- Note: "You can restart any concept from the concept list."
- Status writes are fire-and-forget (Firestore queues them offline); navigation never waits.
  Back without choosing writes nothing.

**Flashcard viewer** changes (ph-2-us-3, ph-2-us-4):

- Builds its pass with `buildPass` from the cached deck and `readTopicHistory`, per the trigger
  table; waits for both the saved pass and Concept Progress (decides `missed-only` for *needs
  revisit*).
- Missed-only banner: "Reviewing the {n} you missed · Show all cards".
- Every card: "Skip to quiz" beside the "N of M" counter → `MiniQuiz` (hidden at the end of the deck, where "Take the mini-quiz" is the main action).
- End of a `full` pass: "Take the mini-quiz", "Start this concept over" (as now). End of a
  `missed-only` pass: "Take the mini-quiz", "See all cards".

**`ConceptReportScreen`** (ph-4-us-6) replaces the Progress tab placeholder (`ProgressHome`).

- Intro: "A rough guide from your quizzes and baseline."
- Sort toggle: *Handbook order* (default) / *Needs work first* (likely gap and Missed it, then
  shaky, then not tested, then strong and Got it; handbook order within each group).
- Row: title, strength chip (`success`/`successSoft` strong and Got it, `secondary`/
  `secondarySoft` shaky, `alert` likely gap and Missed it, neutral not tested; always with a
  text label), basis line: "10 of 15 right in your latest quiz" / "70% in your latest quiz"
  (older records) / "From 1 baseline question" / "Not tested yet". Tap → `openConcept`.
  "Coming soon" topics show "Not tested yet" and aren't pressable.
- Empty (no baseline, no quiz): what fills this in, with "Start your baseline" and "Go to the
  concept list".
- Topics read fails → `NoConnection` with retry. Baseline attempt fails → those rows "Not tested
  yet" plus a "Couldn't load your baseline" note with Try again. Concept Progress comes from
  Firestore's cache offline.

## Story updates

- ph-2-us-4: missed-only passes (Review Again, *needs revisit*); "every card once" applies to
  `full` passes.
- ph-2-us-8: scaled quiz size; Skip to quiz; no force-quit resume.
- ph-2-us-11: `latestMiniQuizCorrect` / `latestMiniQuizTotal`.
- ph-2-us-6: key includes uid; `lastQuizMissedIds`.
- ph-3-us-1: mini-quiz part dropped (decision 6).
- Statuses and `build-order.md` at the end of the slice.

## Testing

| Suite | Covers |
|-------|--------|
| `npm run test:rules` | client can't write `latestMiniQuizCorrect` / `latestMiniQuizTotal` |
| `npm run test:functions` | scaled count (pool 3 → 3, 9 → 5, 31 → 10, 60 → 15, explicit count capped at 15); new score fields merged |
| `npm run test:app` | `cardPerformanceData` (accumulate, skip unavailable/null, missed list replaced, no history); `buildPass` (missed-only, fallback, every card once in full, weighting tends earlier, deterministic with injected random); saved-pass parsing incl. old string; `conceptStrength` bands and boundaries (80, 50, 3 practice answers), baseline-only, none; sort order; next-topic helper (skips empty, last topic) |
| `npm run test:components` | mini-quiz load/error states, submit, offline hold, `already-exists`, results (missed list, recommendation highlight, all choices enabled, navigation per choice); viewer banner, Skip to quiz, end-of-pass buttons, `pass` param restarts; concept report rows, sort, empty and baseline-error states |

Then: deploy functions to dev and run the device test above on the Android emulator with a user
who has taken the baseline, plus a fresh one for the empty Progress state.

## Out of scope for 4b

Practice-test evidence in the report and "Topics to work on" (Slice 5a); practice and baseline
results feeding card performance (ph-4-us-5, Slice 5b); syncing card performance to Firestore;
strength markers on the concept list; clearing local study data on sign-out (Slice 6).

## Amendment (2026-10-11, from device testing)

Device testing found the three next-step choices confusing, especially after a pass: Mark
Reviewed went back to the list, and the only "move on" button (Come Back Later) marked a topic
just aced as *needs revisit*. Young users also benefit from short sessions that save their work.
This amendment supersedes the earlier decisions it names.

| # | Decision | Supersedes |
|---|----------|------------|
| A1 | The results screen has **two** choices on every result: **Mark Reviewed** (status `reviewed`) and **Review Again** (status `in-progress`). Highlighted: Mark Reviewed on a pass (`move-on`), Review Again on a fail (`review-again`); both always enabled. | Decision 3's three choices; ph-2-us-9's three-choice criteria |
| A2 | **Mark Reviewed always returns to the concept list.** The user picks what to tackle next. | — |
| A3 | **Come Back Later is removed**, with its next-topic navigation (`nextTopicId`, `routesForNextTopic`). Nothing sets `needs-revisit` any more; the value stays valid in rules and still displays for existing records. | Decision 2; ph-2-us-10 table row "Come Back Later" |
| A4 | **Reopening a topic whose latest quiz was not passed** (latest score below the 80% pass mark) opens on only the cards missed in that quiz, with "Show all cards". This applies whatever its status, including *reviewed*. A saved pass still resumes first. | Decision 9 (was: *needs revisit* status) |
| A5 | `scoreTest` also counts **`miniQuizPassCount`** and **`miniQuizFailCount`** per topic on Concept Progress (`FieldValue.increment`, same merge, pass = score ≥ `MINI_QUIZ_PASS_THRESHOLD`). Server-only; clients can't write them (existing `hasOnly` rule; new rules test). Records from before this have no counts. | Extends decision 10 |
| A6 | **Concept list row:** keeps the status chip, adds a coral **"Last quiz not passed"** marker when the latest quiz score is below the pass mark, and a line **"Quizzes: {p} passed · {f} not passed · latest {c} of {t}"**. Older records without counts or correct/total fall back to "Latest quiz: {n}%". | ph-2-us-7 row ("Latest quiz: N%") |

Copy (exact): "Mark Reviewed", "Review Again", "Last quiz not passed", "Quizzes: {p} passed · {f}
not passed · latest {c} of {t}" (parts with no data are left out, e.g. "Quizzes: 1 passed ·
latest 9 of 10").

Story updates: ph-2-us-9 (two choices, always to the list), ph-2-us-10 (status table: Come Back
Later removed), ph-2-us-11 (counts), ph-2-us-7 (row marker and quiz line), ph-2-us-4 (A4).
