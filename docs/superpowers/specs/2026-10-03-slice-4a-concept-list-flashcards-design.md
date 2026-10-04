# Slice 4a — Concept List and Flashcards — Design

> Companion to `docs/build-order.md` (Slice 4a). The stories are the detailed spec:
> ph-2-us-11, ph-2-us-12, ph-2-us-7, ph-2-us-3, ph-2-us-5 (parent ph-2-us-10 holds the status
> transitions table). This doc records how they fit together and the decisions made on
> 2026-10-01 that the stories left open or that change them.

## Goal

A new teen gets from "Learn first", a baseline results topic or a review link into real study:
a concept list in handbook order, then a topic's flip-card flashcards. Opening a topic marks it
"in progress" on the list. Topics with no approved questions show "coming soon". The mini-quiz
is a placeholder until Slice 4b.

**Device test** (from `build-order.md`): "Learn first" or a results topic → concept list →
open a topic → flip through every card (scenario cards badged) → end of deck offers "Start this
concept over" (mini-quiz opens a placeholder) → the topic shows "in progress" on the list →
"coming soon" topics can't be opened.

## Decisions (2026-10-01)

| # | Question | Decision | Changes a story? |
|---|----------|----------|------------------|
| 1 | Flip animation and swipe | React Native's built-in `Animated` (flip) and `PanResponder` (swipe). No Reanimated or Gesture Handler, so **no dev-client rebuild**. | No |
| 2 | What Home's "Continue learning" opens | The last topic whose deck loaded, stored per uid on the device (AsyncStorage, like the onboarding flag). Before any topic is opened, the card stays "Learn concept by concept" and opens the list. Lost on reinstall; it's only a shortcut. | Defines ph-9-us-7's 4a card |
| 3 | Where the viewer lives / Back | A **root stack** route, like Baseline and Review. Back returns to wherever the user came from (list, results, review). Tab bar hidden while studying. | Yes: ph-2-us-7 said "pushes onto the Study stack" |
| 4 | "Take the mini-quiz" in 4a | Live button opening a placeholder screen on the `MiniQuiz` route that Slice 4b fills in. | No |
| 5 | Questions worded around their choices ("Which of the following…") | Shown as-is. During the device test, count how many read badly; if more than a handful, fix in content (rephrase at review) or add a front-text field later. Flashcards never show choices. | Resolves ph-2-us-3's open question for 4a |

Also already settled before this slice: `@react-native-firebase/functions` is installed
(Slice 2); `topics` docs carry `description` and `approvedQuestionCount`; dev rules and
functions were deployed through Slice 3.

## Backend (ph-2-us-11)

**Rules.** New `match /users/{uid}/conceptProgress/{chunkId}` — the first client-writable
collection under a user:

- read: owner only.
- create: owner; keys only `status`, `statusUpdatedAt`; `status` in `in-progress`, `reviewed`,
  `needs-revisit`; `statusUpdatedAt == request.time`.
- update: owner; `diff().affectedKeys()` only `status`, `statusUpdatedAt`; same value checks.
- delete: denied.

**`scoreTest`.** For `mini-quiz` attempts only, inside the existing transaction, merge
`latestMiniQuizScore`, `latestMiniQuizAt`, `latestTestId` into
`users/{uid}/conceptProgress/{assignment.chunkId}` with `{ merge: true }`. `status` is never
written. If the assignment has no `chunkId`, skip the merge (no write to a bad path). Practice
and baseline grading never touch Concept Progress. Documented per the
`cloud-function-documentation` skill; `functions/README.md` and the `firestore.rules` header
updated.

**Deploy.** The new rules and `scoreTest` go to dev after this story is built and before the
device test (confirm with the user at that step).

## Client data (ph-2-us-12, plus topics and flashcards)

Follows the existing split: a pure file that runs under Node Jest, and a Firebase file around it
(as `topicsData.ts` / `useTopics.ts`).

- **`src/study/conceptProgressData.ts`** (pure)
  - `ConceptStatus = 'not-started' | 'in-progress' | 'reviewed' | 'needs-revisit'`.
  - `toProgress(doc | undefined)`: no doc → `not-started`; score without status → `in-progress`.
  - `nextStatus(current, event)` → new status or `null` (no write), per the ph-2-us-10 table.
    Events: `opened`, `review-again`, `come-back-later`, `mark-reviewed`.
- **`src/study/conceptProgress.ts`** (Firebase)
  - Live `onSnapshot` on `users/{uid}/conceptProgress`.
  - `markOpened(uid, chunkId, current)` and `setStatusFromChoice(uid, chunkId, choice)`:
    `setDoc(..., { merge: true })` with `serverTimestamp()`, not awaited (offline cache updates
    the UI at once and syncs later), failures logged, never thrown to the UI.
    `setStatusFromChoice` has no caller until 4b.
- **`src/study/useConceptProgress.ts`**: `chunkId → progress` map; signed out → empty map, no
  writes.
- **Topics** (`src/topics/`): `Topic` gains `description` and `approvedQuestionCount`;
  `useTopics` gains `retry()`. Existing consumers (results, review) are unaffected.
- **Flashcards**
  - `getFlashcards({ chunkId })` wrapper in `src/api/callables.ts`; `Flashcard` type in
    `src/api/types.ts`.
  - `src/study/flashcardCache.ts`: in-memory `Map<chunkId, Flashcard[]>` for the app session.
  - A pure `shuffle` for "Start this concept over" (ph-2-us-4 replaces ordering in 4b).
- **Last opened**: `getLastOpenedTopic(uid)` / `setLastOpenedTopic(uid, chunkId)` in
  `src/profile/localFlags.ts`, same `dmv-app:` per-uid key scheme but storing a string (the
  existing flags are booleans). A storage failure reads as "none", which only costs the Home
  shortcut.

**When "opened" counts**: `markOpened` and the last-opened key are written only after a deck
loads with cards. A topic that errors or is empty never becomes "in progress".

## Screens and navigation

**Routes** (root stack, `src/navigation/types.ts`):

- `Flashcards: { chunkId: string }`
- `MiniQuiz: { chunkId: string }` — placeholder screen in 4a.

`openConcept(navigation, chunkId)` becomes `navigate('Flashcards', { chunkId })`. Onboarding's
"Learn first" still lands on the Study tab, which is now the list.

**Concept list** (ph-2-us-7) replaces the `StudyHome` placeholder.

- Intro line: start any concept, in any order, and restart one any time.
- One row per topic in `order`: title, description, status chip (tokens: `primarySoft` in
  progress, `successSoft` reviewed, `secondarySoft` needs revisit, neutral not started), latest
  quiz score if present.
- `approvedQuestionCount == 0`: greyed, "Coming soon", not pressable.
- Topics read fails → `NoConnection` with retry. Progress read fails → all "not started",
  logged.

**Flashcard viewer** (ph-2-us-3, ph-2-us-5)

- Load: session cache first; `getFlashcards` only on a miss. `not-found` → "Nothing here yet";
  `resource-exhausted` → "Take a short break and try again in a few minutes"; offline → no
  connection with retry; anything else → error with retry. Offline mid-topic keeps working
  (cards are in memory).
- Header progress "4 of 23". Previous / Next buttons always present. `PanResponder` swipe
  claims the gesture only for a clearly horizontal drag, so long cards still scroll vertically.
  Swiping back from the first card does nothing.
- End of deck is the screen's final state: "Take the mini-quiz" (→ `MiniQuiz` placeholder) and
  "Start this concept over" (reshuffle from cache, back to card 1, no call, status unchanged).
- **`FlipCard`** (`src/study/FlipCard.tsx`): `Animated` `rotateY` with hidden back faces; taps
  ignored while turning; front = question text only, back = correct answer labelled "Answer";
  screen readers hear which side is showing; long text scrolls inside the card. Moving to
  another card always shows its front.
- **`ScenarioBadge`** (`src/components/ScenarioBadge.tsx`): extracted from `QuizCard`, used by
  both cards. Missing or unknown `type` → plain fact styling.

**Home card** (ph-9-us-7): if a last-opened topic is stored and exists in `topics`, "Continue
learning · {title}" opens its flashcards; otherwise "Learn concept by concept" opens the list.

## Testing

| Suite | Covers |
|-------|--------|
| `npm run test:rules` | every `conceptProgress` allow/deny case in ph-2-us-11 |
| `npm run test:functions` | mini-quiz merge; existing status untouched; doc created without status; practice/baseline don't touch it; retake overwrites |
| `npm run test:app` | `toProgress`, `nextStatus`, topic mapping, shuffle, flashcard cache |
| `npm run test:components` | `FlipCard`; viewer load/error states and end of deck; list rows, chips, "coming soon"; Home card variants; `QuizCard` still badges scenarios |

Then: deploy rules and functions to dev, and run the device test above on the Android emulator
with a fresh anonymous user (plus one that took the baseline, for the results → flashcards
link). Note the count of cards that read badly without choices.

## Out of scope for 4a

Mini-quiz, recommendation and next-step choices, per-card performance and weak-card ordering,
Progress-tab concept report (all Slice 4b). Offline copy of the bank (never: extraction
prevention, ph-1-us-10).
