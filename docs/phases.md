# Phases and User Stories — CO DMV Practice App

> Companion to `prd.md`. Tracks build phases for the app end-to-end. Unlike a split
> frontend/backend project, this app has no dedicated backend team/API layer — Firebase is used
> directly as a BaaS (Firestore/Hosting/Analytics), so each phase below covers client + its
> Firebase data/config together rather than being split into separate docs. Phase numbers are
> roughly build order, not strict dependencies, except where a phase explicitly says it depends on
> an earlier one.

## Out of Scope (matches `prd.md` Section 3 — do not build ahead of scope)

- **Monetization** — paywall, pay-per-test, bundle packs, unlimited pass, IAP. Deferred until
  pass-rate is validated (see `prd.md` Section 6).
- **Additional states beyond Colorado.**
- **Parent accounts, gifting, or shared/family purchases.**
- **Social/gamification** — leaderboards, streaks, sharing of results.
- **Push notifications / re-engagement campaigns** — a local reminder tied to the self-reported
  test date is the one exception under consideration (see Phase 6), not a general notification
  system.
- **Detailed analytics dashboards** beyond basic pass-rate tracking.
- **Video-based hazard-perception training** and **tying study content to logged driving
  sessions** (e.g. a "tonight's focus" tip) — both deferred per `prd.md` Section 3.
- **Accounts / email-social login** — MVP auth approach is anonymous/device-based (open question
  in `prd.md` Section 9); don't build a signup/login screen ahead of that decision being made.

---

## Phase 0: Project Foundations — Done

No content dependency; this is the scaffold everything else builds on.

- [x] As a developer, I have an Expo-managed React Native project scaffolded (via `expo prebuild`
  + custom dev client, not Expo Go — required later for the driving-timer native modules per
  `phase-0-findings.md`), so subsequent phases have somewhere to build.
- [x] As a developer, I have a Firebase project provisioned (Firestore, Hosting, Analytics) and
  wired into the app via environment config, so later phases can read/write real data.
- [x] As a teen user, the app assigns me a persistent anonymous device identifier on first launch
  (no signup/login screen), so my practice history, driving log, and pass/fail report can be
  linked together across sessions on this device.
  - Decided: implemented via Firebase Anonymous Authentication (`signInAnonymously()`), not a
    raw client-generated device ID — gives a real `request.auth.uid` that Firestore security
    rules can enforce, with no added sign-in friction (see `prd.md` Section 7).
  - Known limitation carried from `prd.md` Section 9: this identity does not survive a reinstall
    or device switch. Flag this limitation in-app if/when it becomes user-visible (e.g. before
    driving-log export) rather than silently losing data.
- [x] As a developer, I have basic navigation (tab or stack) between Study, Practice Tests,
  Driving Log, and Progress/Outcome sections, so later phases have a home to land in.

---

## Phase 1: Question Bank & Content Model — Not Started

Depends on: Phase 0 (Firebase wiring).

- [ ] As a developer, I have a Firestore schema for `Question` (text, choices, correct answer,
  topic/category, source reference, and a type flag distinguishing fact-recall vs. scenario
  items), matching `prd.md` Section 7's data entities.
- [ ] As a content author, I can add/update questions in Firestore without an app release, so the
  question bank can grow after launch.
- [ ] As a teen user, question and flashcard content is cached locally on device after first
  download, so I can study offline once content has been fetched once (per `prd.md`'s offline
  assumption, Section 7/10 — confirm this is still wanted before building the caching layer).
- [ ] As a product owner, the initial question bank is paraphrased/generated from the CO DMV
  handbook, not copied verbatim, per the legal note in `prd.md` Section 8. Content authoring
  itself is outside this phase's engineering scope but the schema must support a `source
  reference` field to trace each question back to its handbook section.

> Exact question bank size / number of distinct practice tests is not yet defined (`prd.md`
> Section 9) — this phase builds the schema and pipeline, not a fixed content count.

---

## Phase 2: Flashcard Study Mode — Not Started

Depends on: Phase 1 (question bank).

- [ ] As a teen user, I can browse flashcards organized by topic, built from the question bank.
- [ ] As a teen user, cards I've missed or marked as weak resurface more often than cards I know
  well — a lightweight spaced-repetition-style ordering, not a fixed browse order or a full SRS
  algorithm (per `prd.md` Section 5).
- [ ] As a teen user, scenario/situational cards ("you're approaching a 4-way stop...") are woven
  into the regular flashcard flow, visually distinguishable from plain fact-recall cards but not
  siloed into a separate mode — this is the app's core differentiator per `prd.md` Section 1.
- [ ] As a teen user, my per-card performance (seen/missed) is tracked locally so the
  weak-card-resurfacing logic has something to work from.

---

## Phase 3: Practice Test Generator & Test-Taking UI — Not Started

Depends on: Phase 1 (question bank).

- [ ] As a teen user, I can start a practice test assembled from the question bank, mixing
  fact-recall and scenario items.
- [ ] As a teen user, I can generate and take multiple distinct practice tests, unlimited and
  free, without hitting any paywall or usage cap (MVP has no monetization — see Out of Scope).
- [ ] As a teen user, I can choose (or the app defaults to) a timed or untimed test mode.
- [ ] As a teen user, each `Test Attempt` (answers, score, timestamp) is recorded per `prd.md`
  Section 7's data model, so later phases (scoring/review, pass-rate reporting) have data to use.
- [ ] As a teen user, I only ever see Colorado-specific content — no state selector, since
  `prd.md` explicitly scopes this to Colorado only for MVP.

---

## Phase 4: Scoring & Review — Not Started

Depends on: Phase 3 (test attempts exist to score/review).

- [ ] As a teen user, I see my score immediately at the end of a practice test.
- [ ] As a teen user, I can review each question from a completed test, seeing my answer vs. the
  correct one and (where available) a short explanation.
- [ ] As a teen user, missed questions from past tests are visible somewhere I can revisit them
  (feeds back into Phase 2's weak-card logic where the same content overlaps).

---

## Phase 5: Test Date & Outcome Log — Not Started

Depends on: Phase 0 (device identity), Phase 3 (test attempts, for correlating study activity
with outcome).

- [ ] As a teen user, I can optionally log the date of my scheduled real DMV written test.
- [ ] As a teen user, after my logged test date has passed, the app prompts me (in-app, next
  open — no push notification system per Out of Scope) to self-report pass/fail.
  - Open question from `prd.md` Section 9: whether a local notification tied to the test date is
    needed in addition to the in-app prompt. Not building a local-notification version until this
    is decided; in-app-prompt-on-next-open is the MVP default.
- [ ] As a product owner, self-reported pass/fail results are written to a `Test Outcome` record
  (scheduled date + result, linked to the device identifier) so they can be aggregated for the
  primary success metric in `prd.md` Section 2.
- [ ] As a product owner, I have a way to view aggregate pass-rate numbers across beta users (this
  can be a simple Firebase console query/export for MVP — not a dashboard; see Out of Scope).

---

## Phase 6: Driving Time Logger — Not Started

Depends on: Phase 0 (device identity, project scaffold with custom dev client already required).
Design informed by the completed spike in `phase-0-findings.md` — read it before implementing.

- [ ] As a teen user, I can start and stop a supervised-driving session with one tap.
- [ ] As a teen user, while a session is running, I see a persistent visible indicator outside the
  app itself — a foreground-service notification with a live chronometer on Android, built first
  as the robust baseline per the spike's recommendation.
- [ ] As a teen user on iOS, I see a Live Activity/Dynamic Island indicator while a session is
  running, built via Expo prebuild + a config plugin — treated as best-effort per the spike's
  known iOS 18 timer-freeze risk, not a blocker for shipping.
- [ ] As a teen user, if the iOS Live Activity isn't available or reliable on my device, I still
  get an accurate in-app-only timer as a fallback — session logging must not depend on the native
  indicator working.
- [ ] As a teen user, each session's start/stop timestamps are persisted to local storage the
  instant I tap start/stop (not just held in a JS timer), so a killed app process doesn't corrupt
  or lose my logged duration — this is safety-critical since the log is relied on for the actual
  driving test (per the spike's reliability findings).
- [ ] As a teen user, if I reopen the app and find a session still marked "running" (e.g. after a
  crash), I'm prompted to confirm or adjust the end time rather than the app silently guessing.
- [ ] As a teen user, I can see my cumulative logged driving time at a glance.

> Open question from `prd.md` Section 9, not yet resolved: whether Colorado's supervised-driving
> requirement needs fields beyond total duration (day vs. night hours, supervisor name/signature,
> odometer). Confirm before finalizing the `Driving Session` schema in this phase — it directly
> affects Phase 7's export format.

---

## Phase 7: Driving Log Export/Print — Not Started

Depends on: Phase 6 (driving sessions must exist to export).

- [ ] As a teen user, I can generate a printable/exportable summary of my cumulative logged
  driving sessions.
- [ ] As a teen user, I can hand off the exported log via the OS share sheet (e.g. as a PDF or
  CSV) so I can print it or send it to a parent/supervisor ahead of my in-person driving test.
- [ ] As a teen user, the export includes whatever fields Colorado's driving-test requirement
  actually mandates — pending the open question resolved in Phase 6.

---

## Phase 8: Beta Rollout — Not Started

Depends on: Phase 4, 5, 6, 7 (a usable end-to-end app to put in front of testers).

- [ ] As a product owner, I can distribute the app to a community group of beta testers (TestFlight
  / Play Internal Testing — exact mechanism not yet decided, per `prd.md` Section 9).
- [ ] As a product owner, I can see whether beta testers are actually logging real-test pass/fail
  status, since validating that behavior is the specific goal of the beta per `prd.md` Section 3.
- [ ] As a product owner, I have a defined (even if rough) beta group size and time window before
  deciding whether pass-rate results are meaningful — currently undefined, needs a decision before
  this phase starts in earnest.

---

**Where things stand overall**: Phase 0 (project foundations) is done — the Expo project is
scaffolded, Firebase is wired in, anonymous auth is implemented, and basic navigation exists.
Phases 1–8 have not started. Firebase is the chosen backend (no separate backend build-out
phases needed — see the note at the top of this doc). Several phases carry open questions
inherited from `prd.md` Section 9 (auth persistence, notification mechanism, driving-log field
requirements, beta distribution mechanism) that should be resolved before or during that phase
rather than deferred indefinitely.
