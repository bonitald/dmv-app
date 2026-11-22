# Slice 6 — Save Progress to an Account — Design

> Companion to `docs/build-order.md` (Slice 6). The stories are the detailed spec: ph-9-us-9
> (Google and Apple providers, `deleteAccount`) and ph-9-us-10 (linking prompts, new-phone
> sign-in, Settings, `clearLocalData`), under parent ph-9-us-8. Parents closed: ph-9-us-8, and
> ph-9-us-6 in full (Home's "Save your progress" card is its last card that isn't in a later
> phase). This doc records how they fit together and the decisions drafted on 2026-11-22.
>
> **Status: draft, not reviewed.** It was written by a scheduled run with no one available to
> answer questions, so every decision Claude made on its own is marked **Open? = Yes** and
> listed below. Nothing here is settled until the user reviews it.

## Questions for review

Decisions in the table below that need a yes/no before building (numbers match the table):

1. **Providers** (D1): Google on both platforms, Apple on iOS only, email link deferred. The
   PRD recommends this but still lists it as undecided (`prd.md` Section 9).
2. **"Link first, then sign in"** (D3): every sign-in button tries to link the current
   anonymous user first and only switches accounts if that Google/Apple account is already in
   use. The welcome step's "Sign in" therefore never leaves an empty anonymous user behind.
3. **No merging** (D4): when switching to an existing account, this phone's progress since
   install is dropped (with a warning), not merged.
4. **What carries to a new phone** (D5): only server data (profile, baseline, attempts, Concept
   Progress). Local study history (card performance, saved deck passes, last-opened topic,
   unfinished tests) stays on the old phone and is lost on switch, by design.
5. **Clear local data by prefix** (D6): sign-out, switch and delete remove every AsyncStorage
   key starting with `dmv-app:`, instead of a list of known keys. Also clears the flashcard
   memory cache, Firestore's offline cache and the Analytics instance ID.
6. **Firestore offline cache cleared** (D7) on sign-out, switch and delete, with the app tree
   unmounted first. Falls back to "best effort" if the SDK refuses.
7. **When Home shows the save card** (D9): only for anonymous users who have at least one graded
   attempt (baseline, practice test or mini-quiz). Dismissed once, it doesn't come back; Settings
   always has the option.
8. **No age gate, no parental consent** (D12): the audience is 15–16; the app adds no age
   question or parent flow. The privacy review must confirm this.
9. **Building before the privacy review** (D13): Slice 6 can be built and device-tested on dev
   before the minors privacy review, but nothing ships to a beta tester until it's done.
10. **Disclosure line and privacy policy link** (D14) on the save prompt and in Settings, with
    a placeholder link until the review produces a policy.
11. **Analytics** (D15): new events with no personal data, no `setUserId`, and
    `resetAnalyticsData()` on sign-out, switch and delete.
12. **Orphaned anonymous users** (D16) are left in place (as on reinstall); cleanup stays a
    Phase 8 item.
13. **iOS / Apple testing** (D17): the repo has no iOS build yet (only `android/`), so Apple
    sign-in and the Apple token revoke are built but device-tested only when an iOS build and
    an Apple Developer account exist. The slice is "done" on Android + Google.
14. **Order against 5b-2** (see "Relationship to Slice 5b"): Slice 6 doesn't depend on 5b-2;
    recommend finishing 5b-2 first as `build-order.md` implies, but either order works.

## Goal

A teen who has put real work into the app can **keep it**: one tap on "Save your progress",
Google (or Apple on iOS), and their baseline, study progress, practice tests and test date are
tied to a sign-in instead of only to this install. On a new or reset phone, "I already have an
account" brings it all back. Anyone, linked or not, can delete everything the app holds about
them from Settings, and a linked user can sign out without leaving their history on a shared
phone.

**Why now:** every earlier slice built progress that lives under an anonymous uid; a reinstall
or new phone loses it (`prd.md` Section 9, the auth residual risk). "Optional account linking"
is a Must (`prd.md` Section 5), and Apple requires in-app account deletion once accounts exist
(`prd.md` Section 8). `build-order.md` gates Phase 8 (beta) on this slice.

**Device test** (from `build-order.md`, extended; Android + Google, D17):
1. Fresh install → onboarding → baseline → results → "Save your progress" card under the
   results → "Not now" → the card goes; reopening the results doesn't show it again → Home shows
   its own save card.
2. Home save card → "Continue with Google" → pick an account → "Progress saved to Google". The
   uid is unchanged (Firebase console), Home's save card is gone, Settings shows "Saved with
   Google".
3. Cancel the Google sheet halfway → nothing changes, no error.
4. Airplane mode → try to save, sign in or delete → "You need a connection for this".
5. Uninstall → reinstall → welcome step "Already saved your progress? Sign in" → Google → lands
   on Home (no onboarding) → baseline results, concept list statuses, Recent tests and test date
   are all there. Card-performance-driven order and last-opened topic are not (D5).
6. On a second device (or after clearing app data) with its own fresh progress: Settings →
   "Save your progress" → same Google account → "This Google account already has saved
   progress" → warning that this phone's progress won't carry over → "Use that account" →
   the old account's data appears; this phone's local data is gone.
7. Settings → "Sign out" → confirm → back at onboarding as a new anonymous user; nothing from the
   previous user shows anywhere (Home, Study, Practice, Progress, a saved unfinished test).
8. Settings → "Delete my data" → confirm twice → app restarts at onboarding. Firestore has no
   `users/{oldUid}` and no subcollections; the Auth user is gone. Repeat as an anonymous user
   (never linked): same result.
9. Welcome step "Sign in" with a Google account that has never been used → it's linked to this
   fresh install's uid, a short "No saved progress yet — it's now saved with Google" note, and
   onboarding continues (D3).

## Goals, non-goals, anti-goals

- **Goals:** link keeps the uid, so no data moves; recovery on a new phone; deletion for every
  user; sign-out that leaves nothing of the previous user on the phone; prompts only at moments
  of value, never a wall; the least personal data possible (email and auth ID, held by Firebase
  Auth only).
- **Non-goals:** email-link sign-in (D1); merging two users' progress (D4); syncing local study
  history (card performance, deck passes) to the server (D5); the Phase 7 "before export" prompt
  (added when Phase 7's stories exist); tying the free-test flag to the linked account (post-MVP,
  `prd.md` Section 9); cleaning up orphaned anonymous users (Phase 8, D16); purchase entitlements
  (monetization is deferred); account management beyond sign-out and delete (no "change provider",
  no "link a second provider").
- **Anti-goals:** a sign-in wall or nag (a prompt that returns after "Not now"); any name, email,
  photo or provider profile copied into Firestore, Analytics or logs; showing the user's email in
  the UI; one user's local history visible to the next user on the same phone; "Deleted" shown
  before the server finished; an account switch that silently drops progress without a warning;
  account or profile language in the copy ("create an account", "your profile").

## Decisions (drafted 2026-11-22)

| # | Question | Decision | Open? |
|---|----------|----------|-------|
| 1 | Sign-in providers | **Google** (Android and iOS) and **Apple** (iOS only; Apple requires it if Google is offered on iOS). Email link deferred. Anonymous stays enabled. Matches ph-9-us-8/9/10's assumption and the `prd.md` recommendation, which still lists it as undecided. | Yes |
| 2 | How linking keeps data | `linkWithCredential` on the anonymous user: **same uid, no data migration**, nothing about the account written to Firestore. From ph-9-us-8. | No |
| 3 | Link vs sign in | **One flow everywhere: try `linkWithCredential` first; on `auth/credential-already-in-use`, offer to switch** with `signInWithCredential`. On the welcome step (nothing to lose yet) the switch happens without a warning; everywhere else the warning from ph-9-us-10 is shown first. A never-used Google/Apple account on the welcome step is simply linked to the fresh uid, so no empty anonymous users or empty duplicate accounts are created. Replaces ph-9-us-10's "path 3 leaves the anonymous user behind". | Yes |
| 4 | Progress on this phone when switching | **Dropped, not merged.** The warning says so ("Progress on this phone since you installed won't carry over"). Merging server-owned attempts, baseline and Concept Progress across uids would need a new privileged function and conflict rules; not worth it for MVP. | Yes |
| 5 | What a new phone gets back | **Server data only:** profile (`onboarding`, `testDate`), `baseline`, `testAttempts` (so Recent tests and the concept report), `conceptProgress`. **Not:** card performance, saved deck passes, last-opened topic, unfinished baseline/practice sessions, mode preference, dismissed cards. They are device conveniences (ph-9-us-10: "local data belongs to the device"). A paused baseline still resumes, because its progress is server-side (`baseline/progress`). | Yes |
| 6 | `clearLocalData()` scope | Removes **every AsyncStorage key that starts with `dmv-app:`** (`getAllKeys` → filter → `multiRemove`), so keys added later (5b-2's "already recorded" set, Phase 6) are covered without a list to keep in sync. Plus `clearDeckCache()` and the steps in D7 and D15. Today that sweep covers: `onboarding-done`, `home:add-date-dismissed`, `study:last-opened`, `study:deck-position`, `card-perf`, `active-test` (per kind and the legacy key), `practice-mode`. Runs on sign-out, account switch and delete. A failed remove is logged, not shown: the keys are uid-scoped, so the next user can't read them anyway. | Yes |
| 7 | Firestore's offline cache | **Cleared** on sign-out, switch and delete (`terminate` + `clearPersistence` in `@react-native-firebase/firestore`; check the v26 API), so the previous user's documents don't stay on a shared phone. It needs no active listeners, so AuthProvider first enters a `switching` state that unmounts the navigator (D8). If clearing fails, log it and continue: rules and uid-keyed paths still stop the new user reading it. | Yes |
| 8 | Order of a sign-out / switch / delete | AuthProvider gets a **`switching` status** (a full-screen "One moment…" view, navigator unmounted, so no screen writes to the old uid mid-way). Sign-out: switching → `clearLocalData` → `signOut` → existing anonymous sign-in → onboarding. Switch: switching → `signInWithCredential` → on success `clearLocalData` (old data) → Home or onboarding by the profile; on failure, back to the old user with nothing cleared. Delete: see Backend/Frontend below. | Yes |
| 9 | Prompt moments and dismissal | Two moments in this slice: **baseline results** (a card below the results, ph-4-us-6) and **Home** (ph-9-us-7, last in the card order). Each has its own per-uid "dismissed" flag; "Not now" hides that moment for good. **Home's card shows only for anonymous users with at least one graded attempt** (baseline, practice or mini-quiz), so a brand-new user isn't asked to save nothing. Settings always offers it. No re-prompting. | Yes |
| 10 | Account state in the UI | `AuthProvider` exposes `account: { kind: 'anonymous' } \| { kind: 'linked'; provider: 'google' \| 'apple' }`, derived from `user.providerData`, refreshed after a link (`onUserChanged`, since `onAuthStateChanged` doesn't fire when the uid stays the same). Screens read it, never re-derive it (ph-0-us-7). The UI shows **the provider, never the email** ("Saved with Google"). | No (ph-9-us-10) |
| 11 | Who can sign out / delete | Sign-out: **linked users only** (an anonymous sign-out would just lose everything). "Delete my data": **everyone**, anonymous included (ph-9-us-9: a privacy right for minors). Delete confirms twice with "can't be undone" wording. | No (ph-9-us-9/10) |
| 12 | Minors: age gate and consent | **No age question, no parent flow.** The audience is 15–16 (permit age in Colorado), above COPPA's under-13 threshold, and the PRD has no parent role. Linking is opt-in and holds only email + auth ID in Firebase Auth. The privacy review (D13) must confirm this is enough under federal rules and Colorado's (including any minors' amendments to the Colorado Privacy Act and whether the app meets its thresholds); this doc makes no legal claim. Store age ratings and listing wording are part of that review. | Yes |
| 13 | Building before the privacy review | **Build and device-test on `dmv-app-dev` now; ship to no beta tester until the review is done** (the `build-order.md` gate, `docs/phases.md` Phase 8, `Prod-Launch-Plan.md`). The review may change copy (D14) but is unlikely to change the architecture, since the design already minimizes data. Prod providers stay disabled until then. | Yes |
| 14 | Disclosure on the prompt | One line under the provider buttons: "We keep only your sign-in ID and email, to bring your progress back. Nothing else." plus a "Privacy" link. **Until a privacy policy exists, the link is a placeholder** (dev builds only) and adding the real URL is a launch task in `Prod-Launch-Plan.md`. Same line in Settings. | Yes |
| 15 | Analytics | New events, **no personal data in any parameter and no `setUserId`**: `save_prompt_shown` / `save_prompt_dismissed` (`{ moment: 'baseline_results' \| 'home' \| 'settings' }`), `account_linked` (`{ provider }`), `account_switched` (`{ provider }`), `signed_out`, `account_deleted`. On sign-out, switch and delete, **`resetAnalyticsData()`** so the next user on the phone gets a new instance ID. Deleting an account doesn't delete past Analytics events (they're keyed to the app instance, not the uid); the privacy policy should say so. | Yes |
| 16 | Orphaned anonymous users | **Left in place**, as after any reinstall. With D3 the welcome step no longer creates them; only an account switch from a phone with progress does, and the user was warned. Deleting it before switching would risk losing everything if the sign-in then fails. Cleanup policy stays a Phase 8 item (ph-9-us-9 Questions). | Yes |
| 17 | Platforms for this slice | **Android + Google is the done bar.** The repo has no iOS build (`android/` only) and no Apple Developer setup is recorded, so Apple sign-in, the Apple button and the token revoke are built behind `Platform.OS === 'ios'` with unit/component tests, and device-tested when iOS builds start (before Phase 8 if iOS ships in the beta). Recorded as an open item in `build-order.md`. | Yes |
| 18 | Apple token revoke on delete | As ph-9-us-9/10: the client gets a fresh Apple authorization code and calls `revokeToken` **before** `deleteAccount`; if the revoke fails, nothing is deleted and the user is told to try again. | No |
| 19 | `deleteAccount` retry after a lost response | **`auth/user-not-found` from `deleteUser` counts as success**, and the recursive delete of an empty path is a no-op, so a retry after a dropped response returns `{ deleted: true }` instead of `internal`. The caller's ID token stays valid for a short while after the Auth user is gone, so the retry still authenticates. Extends ph-9-us-9's idempotency criterion. | Yes |
| 20 | Rules and data model | **No rule or index changes.** Nothing about the account is stored in Firestore; client deletes under `users/{uid}` stay denied; `deleteAccount` uses the Admin SDK. | No (ph-9-us-9) |

## Backend (ph-9-us-9)

**Auth configuration** (dev now, prod at launch, D13):
- Enable the **Google** provider in `dmv-app-dev`. Add the debug keystore's SHA-1 and SHA-256 to
  the Android app (and later the release/Play signing keys for prod), then re-download
  `google-services.json` into `firebase-config/dev/` so it carries the OAuth client. Record the
  web client ID the Google library needs (it's not a secret, but keep it per environment, e.g.
  in `app.config.ts` `extra`).
- Enable **Apple** when iOS work starts (D17): Services ID, key, team ID in the Firebase console;
  "Sign in with Apple" capability on the iOS bundle `com.slatestack.dmv`.
- Steps go in the README and, for prod, in `Prod-Launch-Plan.md` section 0 next to "Anonymous
  Authentication enabled".

**`deleteAccount`** (new `functions/src/deleteAccount.ts`, exported from `index.ts`):
- Callable, **no input**; rejects unauthenticated callers with `unauthenticated` and deletes
  nothing. Only ever acts on `request.auth.uid`.
- `db.recursiveDelete(db.collection('users').doc(uid))` (covers `testAssignments`,
  `testAttempts`, `baseline`, `conceptProgress`, `rateLimits`, and future per-user
  subcollections such as Phase 6 driving sessions), then `admin.auth().deleteUser(uid)`.
  `user-not-found` is treated as already deleted (D19). Any other Auth failure → `internal`, and
  a second call finishes the job.
- Never touches `questions`, `topics`, `baselineTests`.
- Returns `{ deleted: true }`. Logs the uid and outcome only.
- Follows the `cloud-function-documentation` skill (summary comment with Reads/Writes, inline
  comments on the ordering and idempotency); `functions/README.md` gets a `deleteAccount` section.
- Tests: `test:functions` currently starts only the Firestore emulator; it needs `--only
  firestore,auth` for the Auth-user assertions. Seed a user with every subcollection plus shared
  docs, call, check nothing is left under `users/{uid}`, the Auth user is gone and shared docs are
  untouched; user with no profile doc; second call after a simulated Auth failure; second call
  after full success (D19); unauthenticated.
- Deploy to `dmv-app-dev` with the existing smoke check (unauthenticated call → 401).

## Frontend (ph-9-us-10)

**Native libraries** (dev-client rebuild; config plugins, no eject — `phase-0-findings.md`):
`@react-native-google-signin/google-signin` and `expo-apple-authentication` (iOS only). Check both
against Expo SDK 57 / RN 0.86 and RNFirebase v26 before adding, including which Google sign-in
API the free version of the library uses on Android. Add their plugins to `app.config.ts`. The
Android emulator must be a Google Play image for device testing.

**`AuthProvider`** (`src/auth/AuthProvider.tsx`):
- Adds `account` (D10) and a `switching` status (D8) to `AuthState`.
- Adds actions: `saveProgress(provider)` (link-first flow, D3; returns `linked`, `cancelled`,
  `in-use` with the pending credential, or an error), `switchToExistingAccount(pending)`,
  `signOut()`, `deleteMyData()`. Screens call these; no screen imports the auth SDK.
- A cancelled provider sheet returns `cancelled` and shows nothing. Offline (checked up front
  with `useIsOnline`, and `auth/network-request-failed` / functions `unavailable` after) →
  "You need a connection for this".
- `ensureUserDocument` already handles a signed-in user whose doc exists (switch, new phone).

**`clearLocalData()`** (new, e.g. `src/storage/clearLocalData.ts`, D6/D7/D15): prefix sweep of
AsyncStorage, `clearDeckCache()`, Firestore cache clear, `resetAnalyticsData()`. Each step is
independent and logged on failure, so one failing step doesn't skip the rest. In-memory hooks
(Concept Progress, profile, practice attempts) already reset on uid change; the `switching`
unmount makes sure of it.

**Save-progress card** (new shared component, e.g. `src/account/SaveProgressCard.tsx`):
copy from ph-9-us-10 ("Changing phones? Save your progress so you can pick up where you left
off."), the official Google button (and Apple on iOS), "Not now", the disclosure line (D14).
Used on baseline results (below the results, never above the score) and Home (D9). New per-uid
flags in `src/profile/localFlags.ts`: `prompt:baseline-results-dismissed`,
`home:save-progress-dismissed`. Hidden for linked users. After a link: an inline "Progress saved
to Google" confirmation, then the card is gone.

**"Already in use" sheet** (D3/D4): "This Google account already has saved progress. Use that
account instead? Progress on this phone since you installed won't carry over." → "Use that
account" / "Cancel". If an unfinished test is saved on this phone, the warning says so too.
Skipped on the welcome step.

**Welcome step** (`src/onboarding/WelcomeScreen.tsx`, ph-9-us-3): a text link under "Get
started": "Already saved your progress? Sign in" → provider choice → link-first flow. Existing
account → switch (no warning) → the onboarding gate sends a user whose profile has `onboarding`
to Home. New account → linked to this uid, note from device test step 9, onboarding continues.

**Settings** (`src/settings/SettingsScreen.tsx`): sections "YOUR PROGRESS" and "YOUR TEST".
- Account state: "Not saved — your progress lives on this phone only" with the provider buttons
  and "Already saved on another phone? Sign in" (same flow), or "Saved with Google/Apple".
- Test date (unchanged).
- "Sign out" (linked only): confirm with "You can sign back in any time to get your progress
  back." → D8 sequence → onboarding.
- "Delete my data" (everyone): first confirm explains what goes (progress, tests, test date, and
  the sign-in if linked); second confirm "This can't be undone" → (Apple: revoke, D18) →
  `deleteAccount` → on success, local `signOut()` → `clearLocalData()` → anonymous sign-in →
  onboarding. On failure: "We couldn't finish deleting your data. Try again." with retry; nothing
  claims success early and local data is kept until the server confirms.
- Privacy link (D14).

**Callable wrapper:** `deleteAccount` in `src/api/callables.ts` with its types in
`src/api/types.ts`, using the existing error mapping in `src/api/callableErrors.ts`.

## Relationship to Slice 5b

- **5b-1 is complete** (2026-11-22). Its carry-forward (`dmv-app:practice-mode:{uid}`) is covered
  by D6's prefix sweep.
- **5b-2 is not built; its draft spec is
  `2026-11-22-slice-5b2-missed-questions-progress-design.md`** (ph-4-us-5 missed questions and
  card-performance recording, ph-4-us-7 latest score vs baseline, Home test card). Slice 6
  doesn't depend on it, and 5b-2 doesn't depend on Slice 6. How the overlaps are handled there:
  - Its recorded set of test IDs is `dmv-app:card-perf-recorded:{uid}`, so D6 clears it.
  - Its missed-questions list is built from `testAttempts`, so it comes back on a new phone; the
    weighted flashcard order (local card performance) doesn't (D5).
  - It proposes adding Home's weak-spots card (its D13). Without it, ph-9-us-6 can't close "in
    full" in this slice as `build-order.md` says.
  - Both slices add to Home; ph-9-us-7's order puts "Save your progress" last.
- Recommendation: build 5b-2 first, as `build-order.md` implies, so Slice 6 protects the full
  set of progress and its device test covers it. Either order works.

## Carry-forwards closed by this slice

| Carry-forward | From | Covered by |
|---------------|------|------------|
| `clearDeckCache()` on sign-out | Slice 4a, ph-2-us-12, `flashcardCache.ts` | `clearLocalData()` |
| Reset last-opened topic and Concept Progress on sign-out | Slice 4a, ph-2-us-12, ph-9-us-7 | Prefix sweep; uid-change reset + `switching` unmount |
| Clear `card-perf` keys and the saved deck pass | Slice 4b, ph-2-us-6 | Prefix sweep |
| Clear the saved practice session | Slice 5a | Prefix sweep (`active-test:*`, including the legacy key) |
| Clear `dmv-app:practice-mode:{uid}` | Slice 5b-1, ph-3-us-9 decision 8 | Prefix sweep |
| Welcome step "Sign in" link | ph-9-us-3, `WelcomeScreen.tsx` | Welcome step above |
| Settings account state, sign-out, "Delete my data" | ph-9-us-7, `SettingsScreen.tsx` | Settings above |

Stale comments to update when built: `flashcardCache.ts` ("for sign-out once Slice 6 adds it"),
`WelcomeScreen.tsx`, `SettingsScreen.tsx`.

## Story and doc updates

When device-tested: ph-9-us-9 and ph-9-us-10 Complete (with Apple parts noted as untested on
device, D17); parents ph-9-us-8 and ph-9-us-6 Complete; ph-9-us-7 Complete apart from cards owned
by later phases. Record D3, D5, D9, D16 in ph-9-us-10 and D19 in ph-9-us-9; update the Phase 9
summary's open items (providers confirmed or not). Update `build-order.md` with status and the
Apple device-test open item; `Prod-Launch-Plan.md` with prod provider setup, release SHA
fingerprints and the privacy policy URL; `prd.md` Section 9 once providers are confirmed.
`CLAUDE.md` if `test:functions` gains the Auth emulator.

## Left to the builder

- Exact copy and layout within the patterns above (plain, encouraging, no account language).
- The Firestore cache-clear API details on RNFirebase v26 (D7), and how the pending credential
  is held between "in use" and "Use that account" (re-requesting the provider sheet is
  acceptable if the credential can't be reused).
- Whether the "switching" view is a spinner or a short message.
- Tests: `deleteAccount` cases above in `npm run test:functions`; `clearLocalData` (only
  `dmv-app:` keys removed, one failing step doesn't stop the others) and account-state derivation
  in `npm run test:app`; save card visibility and dismissal per moment, the in-use sheet, cancel
  with no error, offline message, Settings for anonymous vs linked, delete success/failure/retry
  and the two confirms in `npm run test:components` (auth and Google sign-in mocked). Sign-in
  flows themselves are covered by the manual device test above.
