# Product Requirements Document: CO DMV Practice App

_Last updated: 2026-09-20_

## 1. Overview
- **Problem:** Teens preparing for the Colorado DMV written permit test lack a focused, low-friction way to study and self-test before going to the DMV — and most existing options reduce studying to rote flashcard/quiz recall rather than helping teens actually reason through road situations, which is closer to how CO's real test — and real driving — actually work.
- **Pitch:** A practice app that helps Colorado teens pass their DMV written test on the first try by training situational judgment, not just rote fact recall — scenario-style questions alongside flashcards, not a flashcard app alone.
- **Target users:** Teens (roughly 15-16) studying for their Colorado learner's permit written exam. Self-serve — no parent/guardian role in the app itself.
- **Value proposition:** Purpose-built, low-cost, mobile-first practice vs. free scattered PDFs/web quizzes or expensive in-person prep — practice with the same short scenario-based reasoning the real test leans on, not just isolated fact cards, and get through multiple realistic practice tests quickly on your phone.

## 2. Goals & Success Metrics
- **MVP goal(s):**
  - Let a teen study via flashcards and take unlimited practice tests for free, with no signup friction.
  - Validate that the app actually helps teens pass the real DMV written test before introducing any paywall.
  - Get a first-time teen oriented quickly: a one-time first-run choice between "test what I know" (baseline diagnostic) and "learn first" (concept learning path), then free movement between tests and concepts.
- **Success metrics (first 1-3 months):**
  - Self-reported real-DMV-test pass rate among app users (primary metric — no target set yet).
  - Secondary: per-user score improvement from the one-time baseline diagnostic to later practice tests, as a leading indicator that the app is teaching. The first-run route a teen picks is not a success metric (they can switch freely).
  - Revenue is deferred: monetization ($2,000/month target) becomes the goal of a later phase once pass rate is proven, not part of MVP success criteria.

## 3. Scope
### In scope (MVP)
- Flashcard study mode covering CO DMV handbook content, with missed/weak cards resurfaced more often (simple spaced-repetition-style logic, not a fixed browse order).
- Situational/scenario-style questions ("you're approaching a 4-way stop and another car arrives at the same time — who goes first?") woven into flashcards and practice tests alongside plain fact-recall questions — the core differentiator from generic quiz/flashcard apps, and closer to how CO's actual permit test phrases many items.
- First-run onboarding: a one-time choice between two routes — (1) take a baseline diagnostic first, or (2) start the concept learning path. Also asks for an optional, editable tentative test date, shown as a countdown on the home screen. The choice is not binding: at any time the teen can start a practice test or jump to any concept.
- Baseline diagnostic: a one-time, sectioned test that can be paused between sections, with a "keep going?" check to respect short attention spans. The question bank has 45 handbook topics (a topic is what the learning path calls a "concept"), so covering every topic with one question means about 45 questions; 3 sections of 15, one question per topic, grouped in handbook order. It is the **same fixed set for every user**, so retaking it never reveals more of the question bank. Scored and stored separately from regular practice tests so it serves as a starting point for measuring improvement. Completing it counts as the user's "free test": the app records that the user has used it (`freeTestUsedAt`) for the future subscription, but nothing is gated in the MVP. Results are shown per topic, indicative only: one question per topic supports got it / missed it, and "shaky" appears once mini-quiz scores exist.
- Concept learning path: concepts organized in the order of the handbook PDF. Each concept is the concept's flashcards followed by a short mini-quiz of questions from that concept only. At the end the app recommends moving on or repeating, based on a score threshold (recommendation, not a gate), and the teen picks "Review Again", "Come Back Later, Continue to Next Concept", or "Mark Reviewed". Concepts are "reviewed", not "completed", and can be restarted at any time. Tracked per concept: not started / in progress / reviewed / needs revisit.
- Multiple auto-generated practice tests (question sets), Colorado only, unlimited use — fully free.
- Basic test-taking UI: timed or untimed, score at the end, review missed questions.
- Real-DMV-test outcome tracking: let a user optionally log their scheduled test date and later self-report pass/fail, so pass-rate can be measured.
- Supervised driving time logger: start/stop a session, a persistent always-visible indicator (status-bar/lock-screen style, similar to a nav-app active-trip indicator) while a session is running, each session logged with date/duration, and a way to export/print the cumulative log for the in-person driving test requirement.
- Beta rollout to a community group of testers, specifically to validate that users actually log their real-test pass/fail status in the app.

### Out of scope (later / v2+)
- Monetization: paywall, pay-per-test, bundle packs, unlimited pass, and in-app purchases — deferred until pass-rate quality is proven.
- Additional states beyond Colorado.
- Parent accounts, gifting, or shared/family purchases.
- Social/gamification features (leaderboards, streaks, sharing).
- Push notifications / re-engagement campaigns (though a simple local reminder for the pass/fail follow-up may be needed — see open questions).
- Detailed analytics dashboards beyond basic pass-rate tracking.
- Post-MVP, alongside subscription: richer "lesson flow" per concept (paraphrased explanatory content, AI-generated video). For MVP a concept's "lesson" is just its flashcards.
- Video-based hazard-perception training and tying study content to specific logged driving sessions (e.g. a "tonight's focus" tip pulled from the handbook) — both considered, but deferred: they're aimed at real driving-skill development rather than passing the written test, which is the MVP's scope, and the video approach in particular adds real content-production and technical overhead.

## 4. Users & Roles
| Role | Description | Key needs |
|---|---|---|
| Teen (primary user) | 15-16 yo studying for CO permit test | Quick access to flashcards/tests, low-friction purchase flow, clear scoring/feedback |

## 5. Core Features (MVP)
| Feature | Description | Priority |
|---|---|---|
| Flashcard study mode | Browseable flashcards built from CO handbook content, organized by topic; missed cards resurface more often (lightweight spaced repetition) | Must |
| Scenario/situational question set | Short "what do you do here" style items (right-of-way, signage-in-context, following distance, etc.) mixed into flashcards and tests, distinct from plain fact-recall cards | Must |
| Practice test generator | Pulls from a question bank (fact-recall + scenario items) to assemble multiple distinct practice tests, free/unlimited | Must |
| Scoring & review | Show score at end of test, let user review correct/incorrect answers | Must |
| Test date + outcome log | User optionally logs their scheduled real DMV test date; app later prompts them to record pass/fail | Must |
| Pass-rate reporting (internal) | Aggregate self-reported pass/fail results to measure product quality | Must |
| Driving time logger | Start/stop a supervised-driving session with a persistent visible active-session indicator; log each session; view cumulative total | Must |
| Driving log export/print | Generate a printable/exportable summary of logged driving sessions for the in-person driving test | Must |
| First-run onboarding + test-date countdown | One-time route choice (baseline first vs. learn first), optional tentative test date, countdown on the home screen | Must |
| Baseline diagnostic | One-time sectioned test, pausable/resumable, scored separately, per-concept strong/shaky/likely-gap report | Must |
| Concept learning path | Handbook-ordered concepts, each = flashcards + mini-quiz + recommendation; per-concept reviewed status, free navigation | Must |
| Optional account linking | Upgrade the anonymous user to a real sign-in (email + auth ID only) to keep data across phones | Must |

## 6. Business Requirements
- **Business model:** Free for MVP — no paywall, no purchases. Goal is to validate real-world pass rate first; monetization (pay-per-test / bundle / unlimited pass, target $2,000/month) is planned for a later phase once quality is proven.
- **Timeline / constraints:** No hard deadline. Team size not specified (assumed small/solo).

## 7. Technical & Infrastructure Requirements
- **Platform:** iOS + Android, cross-platform (recommend React Native/Expo for MVP speed). The driving-time logger's persistent visible indicator (a Live Activity/Dynamic Island on iOS, a foreground-service notification on Android) is achievable via Expo prebuild + config plugins + a custom dev client on both platforms — no bare React Native eject required. See spike findings: [`phase-0-findings.md`](./phase-0-findings.md).
- **Backend:** Firebase (chosen). Likely used for: hosting the question bank content, storing driving-session and test-outcome logs, and basic analytics (Firebase Analytics) for practice-test usage and pass-rate/driving-log adoption.
- **Data entities (high level):**
  - Question (text, choices, correct answer, topic/category, source reference)
  - Flashcard (may map 1:1 to questions or be a separate simpler content type)
  - Practice Test (a generated set of questions)
  - Test Attempt (user's answers, score, timestamp, and a type: baseline / practice / mini-quiz — baseline is scored separately and taken once per user)
  - Concept Progress (per user per concept: status not started / in progress / reviewed / needs revisit, latest mini-quiz score, timestamp)
  - Profile settings (tentative test date, first-run choice made)
  - Test Outcome (self-reported scheduled test date and pass/fail result, linked to a user/device)
  - Driving Session (start time, end time, duration, date, linked to a user/device)
- **Auth:** Decided — Firebase Anonymous Authentication (`signInAnonymously()`) on first launch, plus **optional account linking** later. Not a raw client-generated device ID: an unauthenticated client-generated ID can't be verified by Firestore security rules, so any device could read/write another device's data by guessing/spoofing its ID. Anonymous auth gives a real `request.auth.uid` that rules can check, with silent, no-UI sign-in, keeping first use frictionless. Because teens often change phones (possibly mid test-cycle), the app also offers to link the anonymous user to a real sign-in — Firebase account linking keeps the same uid, so existing data carries over — prompted at a moment of value (e.g. after baseline results or before driving-log export), never as a wall. Linked identity collects **email and auth ID only** — no name or profile data. All progress lives server-side (Firestore) under the uid, not only on the device. The linked account is also the future anchor for purchase entitlements once monetization is added. Sign-in providers are an open question (Section 9).
- **Integrations:** None required for MVP (no payment processor needed). Firebase Analytics for tracking practice-test usage and pass-rate outcomes. A PDF/print or share-sheet export tool for the driving log (e.g. generate a simple PDF/CSV and hand off to the OS share sheet — standard, low-risk addition). IAP (Apple/Google) deferred to the monetization phase.
- **Hosting / infra:** Firebase.
- **Offline support:** Not specified — reasonable MVP default is to bundle/cache question content locally so flashcards and tests work offline once downloaded; flagged as assumption below.

## 8. Non-Functional Requirements
- **Scale:** Not specified — assume small (hundreds to low thousands of users) for MVP given the single-state, single-team scope.
- **Compliance / legal:** Primary users are minors (~15-16). By default no PII is collected (anonymous auth); only if a teen opts into account linking do we hold an email address and auth ID (nothing else). That is still personal data about a minor, so review current Colorado and federal privacy rules for minors before launch, and note Apple requires in-app account deletion once accounts exist and Sign in with Apple if other social logins are offered. Question content is sourced from the Colorado DMV handbook (a public government publication); content should be paraphrased/generated rather than reproduced verbatim to stay clearly on the safe side of any reuse concerns. Apple/Google App Store review guidelines apply to the IAP paywall design (must be able to restore purchases, clear pricing disclosure).

## 9. Risks & Open Questions
- Auth approach decided (anonymous auth + optional account linking — see Section 7). Residual risk: a teen who never links loses their data on reinstall or device switch — this matters given driving-log data is meant to be relied on for the real test. Mitigated by prompting to link at high-value moments, especially before driving-log export.
- Which sign-in providers to offer for linking (recommendation: Apple + Google, since teens typically have one and Apple requires Sign in with Apple if Google is offered; email link as an option). Not yet decided.
- Mini-quiz recommendation threshold not yet defined (e.g. a proposed default of 80% correct = "recommend moving on").
- Baseline diagnostic: progress is stored server-side so a paused baseline resumes on another device. Because anonymous auth issues a new uid on reinstall, a user could retake the baseline (the "free test") by reinstalling; tying the free-test flag to a linked account closes this when gating is added post-MVP.
- Question pool depth per concept: mini-quizzes and "Review Again" need enough questions per concept that repeats are not just memorization.
- How/when to prompt for the pass/fail follow-up: local notification tied to the user-entered test date? In-app prompt on next open? No mechanism yet defined.
- No target set for pass rate or minimum sample size needed before considering the MVP "proven" and greenlighting monetization.
- Persistent driving-timer indicator: spike complete, see [`phase-0-findings.md`](./phase-0-findings.md). Both platforms are buildable via Expo prebuild + config plugins (no bare RN eject needed). Remaining risk is narrower than originally scoped: iOS Live Activities have a known OS-level timer-freeze bug on some iOS 18 builds, so the recommendation is to build Android's foreground-service version as the reliable baseline and treat iOS Live Activity as best-effort, with an in-app-only timer as an acceptable fallback rather than a blocker.
- Does Colorado's official supervised-driving-hour requirement mandate specific fields beyond total duration (e.g. day vs. night hours, supervisor name/signature, odometer)? Unconfirmed — affects what the exportable log needs to capture to actually be useful at the DMV.
- Beta rollout mechanism not yet defined: TestFlight/Play Internal Testing vs. another distribution method, size of the beta group, and how long the beta period runs before deciding pass-rate results are meaningful.
- Exact question bank size/number of distinct practice tests not yet defined.
- Pricing and bundle/unlimited structure for the later monetization phase not yet defined (deferred).
- Team size/roles not specified.
- Whether/how much CO's actual written permit test uses scenario-style items (vs. pure fact recall) is assumed, not confirmed — worth checking against official sample questions or the handbook's practice-test section so the scenario/fact-recall mix in the question bank actually mirrors the real test.

### Spike: driving-timer persistent indicator — COMPLETE
Findings and recommendations: [`phase-0-findings.md`](./phase-0-findings.md).
Summary: build Android's foreground-service + chronometer-notification
version as the robust baseline; build iOS Live Activity via Expo prebuild +
config plugin but treat it as best-effort given a known OS timer-freeze bug,
with an in-app-only timer as an acceptable fallback. Persist session
start/stop timestamps immediately on both platforms so logged duration
survives an app kill.

## 10. Assumptions
- For MVP a concept's learning content is its flashcards only; richer lesson content (paraphrased explanations, AI video) is post-MVP, paired with a subscription.
- Offline support (cached content) is assumed desirable for a study app but not explicitly requested — confirm before building.
- Small initial user scale assumed based on single-state, self-serve, no-marketing-mentioned scope.
- Questions will be authored/paraphrased from the CO handbook rather than copied verbatim, to stay safe legally even though the source is a public document.
- Firebase Analytics assumed sufficient for the free→paid conversion funnel tracking mentioned as the key success metric.
- Scenario-style questions take meaningfully more authoring effort per item than plain fact-recall flashcards (each needs a short setup plus a defensible "correct" answer) — factor this into question-bank size/timeline planning rather than assuming a flashcard-style authoring pace throughout.
