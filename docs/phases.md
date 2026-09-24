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
- **Mandatory accounts / signup wall** — MVP auth is anonymous by default with *optional* account
  linking (email + auth ID only; see Phase 9 and `prd.md` Section 7). No forced signup or login
  screen, and no profile/name collection.
- **Post-MVP: richer concept "lesson flow"** (paraphrased explanatory content, AI-generated video),
  planned alongside a subscription. For MVP a concept's lesson is its flashcards.

---

## Phase 0: Project Foundations — Done

> **Goal:** Give every later phase a working app shell, a Firebase backend, and a verifiable user
> identity, so feature work never stalls on plumbing.
> **Supports PRD:** Section 2 goal "no signup friction" (silent anonymous auth); Section 7
> platform/backend/auth decisions. Delivers no user-facing value on its own.

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
  - Update 2026-09-20: mitigated by optional account linking (Phase 9), which keeps the same uid.
    Phase 0 stays as built.
- [x] As a developer, I have basic navigation (tab or stack) between Study, Practice Tests,
  Driving Log, and Progress/Outcome sections, so later phases have a home to land in.

---

## Phase 1: Question Bank & Content Model — Done

> **Goal:** Build the content engine — a question bank that can hold both fact-recall and
> scenario questions, be grown without app releases, and be served to students without letting
> anyone bulk-copy it. Every study and test feature (Phases 2–4) is only as good as this content.
> **Supports PRD:** The core differentiator (Section 1/3: scenario-style questions, not just
> rote recall) — the schema's fact-vs-scenario type flag is what makes it possible. Also protects
> the question bank as an asset ahead of later monetization (Section 6), and supports the legal
> requirement of paraphrased, traceable content (Section 8). Indirectly serves the primary
> success metric (Section 2, pass rate): weak content means no reason to expect passes.

Depends on: Phase 0 (Firebase wiring).

> **Journey changes from 2026-09-20** are reflected in the ph-1 story files: ph-1-us-7 (topic
> mini-quiz assembly), ph-1-us-8 (fixed baseline, same for every user, doubles as the free test),
> ph-1-us-9 (client-readable topic catalog in PDF order), ph-1-us-10 (flashcards with answers,
> unscored), ph-1-us-11 (server-side scoring and saved results), and a widened ph-1-us-3.
> **Terminology:** the learning path's "concept" is a handbook **topic** = `chunkId` (45, PDF
> order). `conceptId` in the data (499) is a finer sub-concept inside a topic.

- [ ] As a developer, I have a Firestore schema for `Question` (text, choices, correct answer,
  topic/category, source reference, and a type flag distinguishing fact-recall vs. scenario
  items), matching `prd.md` Section 7's data entities.
- [ ] As a content author, I can add/update questions in Firestore without an app release, so the
  question bank can grow after launch.
- [ ] As a teen user, once I start a practice test, that test's specific question set is fetched
  via a server-assembled call and cached locally on my device, so I can continue that test
  uninterrupted if I go offline mid-test. Scoped narrowly to the in-progress test's questions
  only — **not** the full question bank — to prevent a client from bulk-extracting question-bank
  content via direct Firestore reads or wholesale local caching. Question delivery to the client
  goes through a callable Cloud Function (server picks/returns a limited set), not a direct
  Firestore query, to close that extraction path at the read layer, not just in the cache.
  General flashcard-mode (Phase 2) offline caching is explicitly out of scope for this phase —
  revisit if/when Phase 2 needs it.
- [ ] As a product owner, the initial question bank is paraphrased/generated from the CO DMV
  handbook, not copied verbatim, per the legal note in `prd.md` Section 8. Content authoring
  itself is outside this phase's engineering scope but the schema must support a `source
  reference` field to trace each question back to its handbook section.

> Exact question bank size / number of distinct practice tests is not yet defined (`prd.md`
> Section 9) — this phase builds the schema and pipeline, not a fixed content count.

---

## Phase 2: Flashcard Study Mode & Concept Learning Path — Not Started

> **Goal:** Let a teen learn the material efficiently, spending time on what they keep missing
> and practicing situational judgment alongside facts.
> **Supports PRD:** MVP goal "study via flashcards" (Section 2); Section 5 features "Flashcard
> study mode" and "Scenario/situational question set" — the primary place the differentiator
> reaches the user.

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
- [ ] As a teen user, I see all concepts in the order of the handbook PDF, each showing a status
  (not started / in progress / reviewed / needs revisit), and I can jump into any concept at any
  time — no forced order.
- [ ] As a teen user, each concept is its flashcards followed by a short mini-quiz of questions
  from that concept only (the concept's "lesson" for MVP is its flashcards; richer lessons are
  post-MVP).
- [ ] As a teen user, after a concept's mini-quiz the app recommends moving on or repeating,
  based on a score threshold (a recommendation, not a gate; threshold TBD, see `prd.md`
  Section 9), and I can choose "Review Again", "Come Back Later, Continue to Next Concept", or
  "Mark Reviewed". A note tells me I can restart any concept later.
- [ ] As a teen user, my per-concept status and latest mini-quiz score are saved to my account
  server-side (a Concept Progress record), so they survive a phone change once I've linked an
  account (Phase 9).

---

## Phase 3: Practice Test Generator & Test-Taking UI — Not Started

> **Goal:** Let a teen rehearse the real written test as often as they like, for free, and
> record every attempt.
> **Supports PRD:** MVP goal "unlimited practice tests, free" (Section 2); Section 5 "Practice
> test generator". The saved Test Attempt data also links study effort to later pass/fail
> outcomes (Phase 5).

Depends on: Phase 1 (question bank).

- [ ] As a teen user, I can start a practice test assembled from the question bank, mixing
  fact-recall and scenario items.
- [ ] As a teen user, a test I've started keeps working offline and survives the app being
  closed — carried over from Phase 1 as ph-3-us-1 (wires `src/study/testCache.ts` into the
  test-taking screen).
- [ ] As a teen user, I can generate and take multiple distinct practice tests, unlimited and
  free, without hitting any paywall or usage cap (MVP has no monetization — see Out of Scope).
- [ ] As a teen user, I can choose (or the app defaults to) a timed or untimed test mode.
- [ ] As a teen user, each `Test Attempt` (answers, score, timestamp) is recorded per `prd.md`
  Section 7's data model, so later phases (scoring/review, pass-rate reporting) have data to use.
- [ ] As a teen user, I only ever see Colorado-specific content — no state selector, since
  `prd.md` explicitly scopes this to Colorado only for MVP.
- [ ] As a teen user, I can take a one-time baseline diagnostic: 3 sections of 15 questions, one
  per handbook topic, in handbook order, and after each section I can pause or confirm I want to
  continue. A paused baseline can be resumed later (server-side state, so it also works on
  another device). The baseline is the same set for every user.
- [ ] As a product owner, the baseline is recorded as its own Test Attempt type, scored
  separately from practice tests, so later scores can be compared to it. Completing it also
  records that the user has used their free test (`freeTestUsedAt`), for the future subscription;
  nothing is gated in MVP.

---

## Phase 4: Scoring & Review — Not Started

> **Goal:** Turn a test attempt into learning — the teen sees how they did and understands why
> each miss was wrong, so the next attempt is better.
> **Supports PRD:** Section 3 "score at the end, review missed questions"; Section 5 "Scoring &
> review". This is the feedback loop that plausibly moves the pass rate (Section 2).

Depends on: Phase 3 (test attempts exist to score/review).

- [ ] As a teen user, I see my score immediately at the end of a practice test.
- [ ] As a teen user, I can review each question from a completed test, seeing my answer vs. the
  correct one and (where available) a short explanation.
- [ ] As a teen user, missed questions from past tests are visible somewhere I can revisit them
  (feeds back into Phase 2's weak-card logic where the same content overlaps).
- [ ] As a teen user, after the baseline (and after later tests) I see results per concept as
  strong / shaky / likely gap — indicative only, since the baseline has just 1-2 questions per
  concept — with a way to jump into the concepts that need work.
- [ ] As a teen user, I can see how my latest score compares to my baseline.

---

## Phase 5: Test Date & Outcome Log — Not Started

> **Goal:** Measure whether the app actually helps teens pass the real DMV test.
> **Supports PRD:** The primary success metric (Section 2: self-reported real-test pass rate)
> and the second MVP goal, "validate the app helps teens pass before any paywall". Without this
> phase the app can't prove itself, and monetization (Section 6) stays blocked.

Depends on: Phase 0 (device identity), Phase 3 (test attempts, for correlating study activity
with outcome).

- [ ] As a teen user, I can optionally log (and later edit) the date of my scheduled real DMV
  written test. First capture happens during onboarding (Phase 9); this phase owns the data and
  the edit flow.
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

> **Goal:** Give teens a reliable, trustworthy record of supervised driving hours, with an
> always-visible timer while driving.
> **Supports PRD:** Section 3/5 "Supervised driving time logger". Beyond passing the written
> test, this is a second reason to keep the app installed — it covers the in-person driving-test
> requirement — and its data must never be lost.

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

> **Goal:** Let a teen turn their logged hours into a document they can print or send, so the
> log is usable at the actual driving test.
> **Supports PRD:** Section 3/5 "Driving log export/print" — the payoff for Phase 6.

Depends on: Phase 6 (driving sessions must exist to export).

- [ ] As a teen user, I can generate a printable/exportable summary of my cumulative logged
  driving sessions.
- [ ] As a teen user, I can hand off the exported log via the OS share sheet (e.g. as a PDF or
  CSV) so I can print it or send it to a parent/supervisor ahead of my in-person driving test.
- [ ] As a teen user, the export includes whatever fields Colorado's driving-test requirement
  actually mandates — pending the open question resolved in Phase 6.

---

## Phase 8: Beta Rollout — Not Started

> **Goal:** Put the finished MVP in real teens' hands and learn whether they report real-test
> outcomes, i.e. whether the pass-rate metric is measurable at all.
> **Supports PRD:** Section 3 beta rollout; feeds the go/no-go decision on monetization
> (Sections 2 and 6). Note Section 9: no pass-rate target or minimum sample size is defined yet.

Depends on: Phase 4, 5, 6, 7, 9 (a usable end-to-end app to put in front of testers).

- [ ] As a product owner, I can distribute the app to a community group of beta testers (TestFlight
  / Play Internal Testing — exact mechanism not yet decided, per `prd.md` Section 9).
- [ ] As a product owner, I can see whether beta testers are actually logging real-test pass/fail
  status, since validating that behavior is the specific goal of the beta per `prd.md` Section 3.
- [ ] As a product owner, I have a defined (even if rough) beta group size and time window before
  deciding whether pass-rate results are meaningful — currently undefined, needs a decision before
  this phase starts in earnest.
- [ ] As a product owner, a privacy review for minor users is done before any beta tester installs
  the app: current Colorado and federal rules for 15-16 year olds, now that optional account
  linking (Phase 9, ph-9-us-8) can hold an email address. Covers what's collected (anonymous
  uid by default; email + auth ID only if linked), in-app data deletion (ph-9-us-9), and any
  consent or privacy-policy wording needed for the store listings. Not an engineering task, but a
  **gate for this phase** (`prd.md` Sections 8 and 9). Noted 2026-09-23.

---

## Phase 9: First-Run Onboarding & Account Linking — Not Started

> **Goal:** Get a first-time teen into the right starting point in under a minute, keep the
> countdown to their test front and center, and let them keep their progress when they change
> phones.
> **Supports PRD:** Section 2 goal of a quick first-time experience and the secondary baseline
> metric; Section 7 auth (anonymous + optional linking); it is also the future anchor for
> purchase entitlements once monetization is added.

Depends on: Phase 2 (learning path), Phase 3 (baseline), Phase 4 (concept report), Phase 5 (test
date data). Numbered last but the onboarding *screen* is what a user sees first — build it once
those phases exist, before Phase 8.

- [ ] As a teen user opening the app for the first time, I choose between "test what I know"
  (starts the baseline) and "learn first" (starts the concept learning path). The choice is
  one-time and not binding: I can start a test or jump to any concept at any time afterward.
- [ ] As a teen user, during onboarding I can optionally enter a tentative test date (skippable,
  editable later) and see a countdown to it on the home screen.
- [ ] As a teen user, I'm offered "save your progress" at high-value moments (after baseline
  results, before driving-log export) to link my anonymous user to a real sign-in, so I keep my
  data on a new phone. It is never a wall, and I can sign in on a new device to recover data.
  - Firebase account linking keeps the same uid, so nothing already saved is migrated.
  - Only email and auth ID are collected — no name or profile data. Provider set is an open
    question (`prd.md` Section 9; recommendation: Apple + Google, email link optional).
  - Requires in-app account deletion (App Store rule) once accounts exist.
- [ ] As a product owner, the first-run choice is stored, and the home screen offers both "start a
  test" and the concept list from then on, without re-showing onboarding.

---

**Where things stand overall**: Phase 0 (project foundations) is done — the Expo project is
scaffolded, Firebase is wired in, anonymous auth is implemented, and basic navigation exists.
Phases 1–9 have not started (Phase 9, first-run onboarding and account linking, was added
2026-09-20; Phases 2–5 were expanded then to cover the concept learning path, baseline
diagnostic, and per-concept gap report). Firebase is the chosen backend (no separate backend build-out
phases needed — see the note at the top of this doc). Several phases carry open questions
inherited from `prd.md` Section 9 (auth persistence, notification mechanism, driving-log field
requirements, beta distribution mechanism) that should be resolved before or during that phase
rather than deferred indefinitely.
