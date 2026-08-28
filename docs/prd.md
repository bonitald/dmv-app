# Product Requirements Document: CO DMV Practice App

_Last updated: 2026-08-27_

## 1. Overview
- **Problem:** Teens preparing for the Colorado DMV written permit test lack a focused, low-friction way to study and self-test before going to the DMV.
- **Pitch:** A simple flashcard and practice-test app that helps Colorado teens pass their DMV written test on the first try.
- **Target users:** Teens (roughly 15-16) studying for their Colorado learner's permit written exam. Self-serve — no parent/guardian role in the app itself.
- **Value proposition:** Purpose-built, low-cost, mobile-first practice vs. free scattered PDFs/web quizzes or expensive in-person prep — get through multiple realistic practice tests quickly on your phone.

## 2. Goals & Success Metrics
- **MVP goal(s):**
  - Let a teen study via flashcards and take unlimited practice tests for free, with no signup friction.
  - Validate that the app actually helps teens pass the real DMV written test before introducing any paywall.
- **Success metrics (first 1-3 months):**
  - Self-reported real-DMV-test pass rate among app users (primary metric — no target set yet).
  - Revenue is deferred: monetization ($2,000/month target) becomes the goal of a later phase once pass rate is proven, not part of MVP success criteria.

## 3. Scope
### In scope (MVP)
- Flashcard study mode covering CO DMV handbook content.
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

## 4. Users & Roles
| Role | Description | Key needs |
|---|---|---|
| Teen (primary user) | 15-16 yo studying for CO permit test | Quick access to flashcards/tests, low-friction purchase flow, clear scoring/feedback |

## 5. Core Features (MVP)
| Feature | Description | Priority |
|---|---|---|
| Flashcard study mode | Browseable flashcards built from CO handbook content, likely organized by topic | Must |
| Practice test generator | Pulls from a question bank to assemble multiple distinct practice tests, free/unlimited | Must |
| Scoring & review | Show score at end of test, let user review correct/incorrect answers | Must |
| Test date + outcome log | User optionally logs their scheduled real DMV test date; app later prompts them to record pass/fail | Must |
| Pass-rate reporting (internal) | Aggregate self-reported pass/fail results to measure product quality | Must |
| Driving time logger | Start/stop a supervised-driving session with a persistent visible active-session indicator; log each session; view cumulative total | Must |
| Driving log export/print | Generate a printable/exportable summary of logged driving sessions for the in-person driving test | Must |

## 6. Business Requirements
- **Business model:** Free for MVP — no paywall, no purchases. Goal is to validate real-world pass rate first; monetization (pay-per-test / bundle / unlimited pass, target $2,000/month) is planned for a later phase once quality is proven.
- **Timeline / constraints:** No hard deadline. Team size not specified (assumed small/solo).

## 7. Technical & Infrastructure Requirements
- **Platform:** iOS + Android, cross-platform (recommend React Native/Expo for MVP speed). Note: the driving-time logger's persistent visible indicator (a Live Activity/Dynamic Island on iOS, an ongoing/foreground-service notification on Android) is the one feature that may not fit cleanly in Expo's managed workflow — likely needs a native module or an Expo "dev client"/prebuild setup. Flagged as a technical risk below.
- **Backend:** Firebase (chosen). Likely used for: hosting the question bank content, storing driving-session and test-outcome logs, and basic analytics (Firebase Analytics) for practice-test usage and pass-rate/driving-log adoption.
- **Data entities (high level):**
  - Question (text, choices, correct answer, topic/category, source reference)
  - Flashcard (may map 1:1 to questions or be a separate simpler content type)
  - Practice Test (a generated set of questions)
  - Test Attempt (user's answers, score, timestamp)
  - Test Outcome (self-reported scheduled test date and pass/fail result, linked to a user/device)
  - Driving Session (start time, end time, duration, date, linked to a user/device)
- **Auth:** Not yet decided. No purchases in MVP, so there's less pressure for an account — but some persistent identifier (even anonymous device ID) is needed to link a user's practice history, driving log, and later self-reported pass/fail together. Anonymous/device-based tracking is the likely fastest option; flagged as open question below.
- **Integrations:** None required for MVP (no payment processor needed). Firebase Analytics for tracking practice-test usage and pass-rate outcomes. A PDF/print or share-sheet export tool for the driving log (e.g. generate a simple PDF/CSV and hand off to the OS share sheet — standard, low-risk addition). IAP (Apple/Google) deferred to the monetization phase.
- **Hosting / infra:** Firebase.
- **Offline support:** Not specified — reasonable MVP default is to bundle/cache question content locally so flashcards and tests work offline once downloaded; flagged as assumption below.

## 8. Non-Functional Requirements
- **Scale:** Not specified — assume small (hundreds to low thousands of users) for MVP given the single-state, single-team scope.
- **Compliance / legal:** Primary users are minors (~15-16). No account/PII collection is currently planned (device-based entitlements), which minimizes COPPA/privacy exposure — revisit if email/social login is added later. Question content is sourced from the Colorado DMV handbook (a public government publication); content should be paraphrased/generated rather than reproduced verbatim to stay clearly on the safe side of any reuse concerns. Apple/Google App Store review guidelines apply to the IAP paywall design (must be able to restore purchases, clear pricing disclosure).

## 9. Risks & Open Questions
- Auth approach undecided — anonymous/device-based vs. email/social login (affects whether pass/fail follow-up and driving log survive a reinstall or device switch — this matters more now given driving-log data is meant to be relied on for the real test).
- How/when to prompt for the pass/fail follow-up: local notification tied to the user-entered test date? In-app prompt on next open? No mechanism yet defined.
- No target set for pass rate or minimum sample size needed before considering the MVP "proven" and greenlighting monetization.
- Persistent driving-timer indicator is a real technical risk: iOS Live Activities and Android foreground-service notifications are platform-specific, likely require native code beyond a plain Expo managed app, and have their own store-review/background-permission considerations. **A spike is planned before committing to the implementation approach** — see below.
- Does Colorado's official supervised-driving-hour requirement mandate specific fields beyond total duration (e.g. day vs. night hours, supervisor name/signature, odometer)? Unconfirmed — affects what the exportable log needs to capture to actually be useful at the DMV.
- Beta rollout mechanism not yet defined: TestFlight/Play Internal Testing vs. another distribution method, size of the beta group, and how long the beta period runs before deciding pass-rate results are meaningful.
- Exact question bank size/number of distinct practice tests not yet defined.
- Pricing and bundle/unlimited structure for the later monetization phase not yet defined (deferred).
- Team size/roles not specified.

### Planned spike: driving-timer persistent indicator
Before building the driving-time logger, research and answer:
- **iOS:** Can this be done with a Live Activity / Dynamic Island (ActivityKit)? What's required beyond Expo managed workflow (dev client, prebuild, native module)? Any background-time-tracking limits (e.g. does the timer keep accurate elapsed time if the app is backgrounded/killed, or only foreground-safe)?
- **Android:** Foreground service + persistent notification approach — permissions required (e.g. `FOREGROUND_SERVICE` type), battery-optimization/Doze impact on accuracy, and Play Store policy constraints on foreground services.
- **Expo feasibility:** Can this ship inside Expo (via config plugins / dev client) or does it force ejecting to bare React Native? What's the effort delta either way?
- **Accuracy/reliability:** How to guarantee the logged duration is correct if the OS kills the app mid-session, the phone locks, or the user force-quits — needed since this data may be relied on for the actual driving test.
- **Fallback option:** If a true persistent indicator proves too costly for MVP, is a simpler always-a-notification-while-open (no lock-screen live view) an acceptable interim approach?

## 10. Assumptions
- Offline support (cached content) is assumed desirable for a study app but not explicitly requested — confirm before building.
- Small initial user scale assumed based on single-state, self-serve, no-marketing-mentioned scope.
- Questions will be authored/paraphrased from the CO handbook rather than copied verbatim, to stay safe legally even though the source is a public document.
- Firebase Analytics assumed sufficient for the free→paid conversion funnel tracking mentioned as the key success metric.
