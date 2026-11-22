# Slice 6 — Save Progress to an Account — Design

> Companion to `docs/build-order.md` (Slice 6). The stories are the detailed spec: ph-9-us-9
> (Google and Apple providers, `deleteAccount`) and ph-9-us-10 (linking prompts, new-phone
> sign-in, Settings, `clearLocalData`), under parent ph-9-us-8. Parents closed: ph-9-us-8, and
> ph-9-us-6 in full (Home's "Save your progress" card is its last card that isn't in a later
> phase). This doc records how they fit together and the decisions drafted on 2026-11-22.
>
> **Status: reviewed 2026-11-22.** Drafted by a scheduled run; the user answered every review
> question the same day. Their answers changed D6–D8 (local data is cleared only when a
> different person signs in), D14 (privacy notice and checkbox), D15 (analytics must tell new
> from returning users), D16 and D17 (iOS ships with this slice). No decision is still open.

## Review (2026-11-22)

All review questions are answered. Providers Google + Apple (D1); switch after a warning (D3);
lose this phone's progress on a switch, no merge (D4); only server data on a new phone (D5);
keep local data on sign-out and clear it when someone else signs in (D6–D8); Home card after the
first graded test or quiz, not shown again once dismissed (D9); no age question, privacy review
confirms (D12); build on dev before the review (D13); a privacy notice in onboarding plus a
checkbox before sign-in (D14); new vs returning users in Analytics, ID reset on delete only, and
the privacy review confirms `setUserId` (D15); no cleanup needed (D16); iOS tested and shipped
with this slice on the existing SlateStack organization Apple Developer account, including a
Slices 1–5 pass on iOS (D17); 5b-2 first.

The only item left outside engineering is the **minors privacy review** (D13), which also
supplies the real privacy policy URL (D14) and checks `setUserId` (D15).

## Goal

A teen who has put real work into the app can **keep it**: one tap on "Save your progress",
Google (or Apple on iOS), and their baseline, study progress, practice tests and test date are
tied to a sign-in instead of only to this install. On a new or reset phone, "I already have an
account" brings it all back. Anyone, linked or not, can delete everything the app holds about
them from Settings. A linked user can sign out and sign back in to find everything as they
left it, and if someone else signs in on that phone, the first person's history is cleared.
The slice ships on **iPhone first** (D17).

**Why now:** every earlier slice built progress that lives under an anonymous uid; a reinstall
or new phone loses it (`prd.md` Section 9, the auth residual risk). "Optional account linking"
is a Must (`prd.md` Section 5), and Apple requires in-app account deletion once accounts exist
(`prd.md` Section 8). `build-order.md` gates Phase 8 (beta) on this slice.

**Device test** (from `build-order.md`, extended). Run on **both** Android (Google) and an iPhone
(Google and Apple), D17:
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
   Sign back in with the **same** account → its progress is back, and so are its local extras
   (flashcard order, last-opened topic, saved unfinished test): nothing was cleared (D6).
7b. Sign out, then sign in with a **different** account → that account's progress shows; the
   first account's local extras are gone from the phone and Firestore's cache was cleared (D6/D7).
8. Settings → "Delete my data" → confirm twice (iPhone + Apple: the Apple sheet asks again for the
   revoke) → app restarts at onboarding. Firestore has no
   `users/{oldUid}` and no subcollections; the Auth user is gone. Repeat as an anonymous user
   (never linked): same result.
9. The welcome step shows "By continuing, you agree to our Privacy Policy." with a working link.
   The save step's Google/Apple buttons stay disabled until the privacy checkbox is ticked; the
   "Privacy Policy" link opens the placeholder page (D14).
10. iPhone: "Continue with Apple" (with "Hide my email" on) → saved; on a second install, "Sign in"
   with Apple → progress appears (D17).
11. Welcome step "Sign in" with a Google account that has never been used → it's linked to this
   fresh install's uid, a short "No saved progress yet — it's now saved with Google" note, and
   onboarding continues (D3).

## Goals, non-goals, anti-goals

- **Goals:** link keeps the uid, so no data moves; recovery on a new phone; deletion for every
  user; sign-out that keeps the user's own conveniences for when they sign back in, and a
  phone that never shows one person's history to the next; prompts only at moments
  of value, never a wall; the least personal data possible (email and auth ID, held by Firebase
  Auth only).
- **Non-goals:** email-link sign-in (D1); merging two users' progress (D4); syncing local study
  history (card performance, deck passes) to the server (D5); the Phase 7 "before export" prompt
  (added when Phase 7's stories exist); tying the free-test flag to the linked account (post-MVP,
  `prd.md` Section 9); cleaning up orphaned anonymous users (Phase 8, D16); purchase entitlements
  (monetization is deferred); account management beyond sign-out and delete (no "change provider",
  no "link a second provider").
- **Anti-goals:** a sign-in wall or nag (a prompt that returns after "Not now"); any name, email,
  photo or provider profile copied into Firestore, Analytics or logs (the Analytics user ID is
  the pseudonymous uid, never the email); showing the user's email in
  the UI; one user's local history visible to the next user on the same phone; "Deleted" shown
  before the server finished; an account switch that silently drops progress without a warning;
  account or profile language in the copy ("create an account", "your profile").

## Decisions (drafted and reviewed 2026-11-22)

| # | Question | Decision | Open? |
|---|----------|----------|-------|
| 1 | Sign-in providers | **Google** (Android and iOS) and **Apple** (iOS only; Apple requires it if Google is offered on iOS). Email link deferred. Anonymous stays enabled. Confirmed 2026-11-22. | No |
| 2 | How linking keeps data | `linkWithCredential` on the anonymous user: **same uid, no data migration**, nothing about the account written to Firestore. From ph-9-us-8. | No |
| 3 | Link vs sign in | **One flow everywhere: try `linkWithCredential` first; on `auth/credential-already-in-use`, switch with `signInWithCredential` after a warning.** On the welcome step (nothing to lose yet) there's no warning. A never-used Google/Apple account on the welcome step is simply linked to the fresh uid, so no empty anonymous users or empty duplicate accounts are created. Replaces ph-9-us-10's "path 3 leaves the anonymous user behind". Confirmed 2026-11-22. | No |
| 4 | Progress on this phone when switching | **Dropped, not merged.** The warning says so ("Progress on this phone since you installed won't carry over"). Confirmed 2026-11-22. | No |
| 5 | What a new phone gets back | **Server data only:** profile (`onboarding`, `testDate`), `baseline`, `testAttempts` (so Recent tests, the concept report and 5b-2's missed list), `conceptProgress`. **Not:** card performance, saved deck passes, last-opened topic, unfinished baseline/practice sessions, mode preference, dismissed cards. A paused baseline still resumes, because its progress is server-side (`baseline/progress`). Confirmed 2026-11-22. | No |
| 6 | When local data is cleared | **Not on sign-out** (decided 2026-11-22: people rarely switch phones, and a teen who signs out and back in should find their flashcard order, last-opened topic and unfinished test still there). **When a different person signs in**: on any sign-in or switch that lands on a uid, every AsyncStorage key under `dmv-app:` that doesn't belong to that uid is removed (keys are uid-scoped today, e.g. `card-perf:{uid}:{chunkId}`; matched on the `:{uid}` segment, so later keys such as 5b-2's `card-perf-recorded:{uid}` are covered as long as they include the uid). The same person signing back in keeps their keys; the throwaway anonymous user's keys from in between are removed. **On delete**: every `dmv-app:` key goes. A device-level `dmv-app:device:last-account` holds the last linked uid for D7 and D15 (removed on delete). Failures are logged, not shown. Until someone else signs in, a signed-out user's local extras stay on the phone; the app only reads the current uid's keys, so the next anonymous user never sees them. | No |
| 7 | Firestore's offline cache | **Cleared when a different linked account signs in than the one in `dmv-app:device:last-account`, and on delete** (`terminate` + `clearPersistence` in `@react-native-firebase/firestore`; check the v26 API). Not on sign-out, and not when the same account signs back in. Needs no active listeners, so it runs inside D8's `switching` state. If clearing fails, log it and continue: rules and uid-keyed paths still stop the new user reading it. | No |
| 8 | Order of a sign-out / switch / delete | AuthProvider gets a **`switching` status** (a full-screen "One moment…" view, navigator unmounted, so no screen writes to the old uid mid-way). Sign-out: switching → `signOut` → existing anonymous sign-in → onboarding (nothing cleared). Switch / sign-in: switching → `signInWithCredential` → on success the D6 sweep and, for a different person, the D7 cache clear → Home or onboarding by the profile; on failure, back to the old user with nothing cleared. Delete: see Backend/Frontend below. | No |
| 9 | Prompt moments and dismissal | Two moments in this slice: **baseline results** (a card below the results, ph-4-us-6) and **Home** (ph-9-us-7, last in the card order). Each has its own per-uid "dismissed" flag; "Not now" hides that moment for good. **Home's card shows only for anonymous users with at least one graded attempt** (baseline, practice or mini-quiz). Settings always offers it. Confirmed 2026-11-22. | No |
| 10 | Account state in the UI | `AuthProvider` exposes `account: { kind: 'anonymous' } \| { kind: 'linked'; provider: 'google' \| 'apple' }`, derived from `user.providerData`, refreshed after a link (`onUserChanged`, since `onAuthStateChanged` doesn't fire when the uid stays the same). Screens read it, never re-derive it (ph-0-us-7). The UI shows **the provider, never the email** ("Saved with Google"). | No (ph-9-us-10) |
| 11 | Who can sign out / delete | Sign-out: **linked users only** (an anonymous sign-out would just lose everything). "Delete my data": **everyone**, anonymous included (ph-9-us-9: a privacy right for minors). Delete confirms twice with "can't be undone" wording. | No (ph-9-us-9/10) |
| 12 | Minors: age gate and consent | **No age question, no parent flow** (confirmed 2026-11-22). The audience is 15–16, linking is opt-in and holds only email + auth ID in Firebase Auth. The privacy review (D13) confirms this under federal and Colorado rules; this doc makes no legal claim. A privacy checkbox is added instead (D14). | No |
| 13 | Building before the privacy review | **Build and device-test on `dmv-app-dev` now; ship to no beta tester until the review is done** (the `build-order.md` gate). Prod providers stay disabled until then. Confirmed 2026-11-22. | No |
| 14 | Privacy notice and checkbox | Decided 2026-11-22 (the user asked for onboarding or right before sign-in; Claude recommended both, as two layers). **Onboarding:** on the welcome step, under "Get started", the line "By continuing, you agree to our Privacy Policy." with the link. No checkbox there: onboarding stays three taps, and the notice covers what every user shares from first launch (an anonymous ID, progress, Analytics). **Before sign-in:** on the save / sign-in step (baseline results, Home, Settings and the welcome step's "Sign in"), an unticked **"I agree to the Privacy Policy" checkbox**; the Google and Apple buttons stay disabled until it's ticked, because that's the moment an email is first held (a just-in-time consent). Under it: "We keep only your sign-in ID and email, to bring your progress back. Nothing else." The checkbox isn't stored on the server; it's asked each time someone saves or signs in. Settings also links to the policy (Apple requires the policy to be reachable in the app as well as in App Store Connect). The link is a **placeholder page until the privacy review produces the real policy**; adding the URL in the app and App Store Connect is a launch task. | No |
| 15 | Analytics | Decided 2026-11-22: Analytics must **tell a new sign-in from a returning user**. Events (no email, name or provider profile in any parameter): `account_linked` (`{ provider }`: an anonymous user's progress saved to a new sign-in, a **new** account); `account_signed_in` (`{ provider, returning_device }`: an **existing** account signed in, `returning_device` true when it matches `dmv-app:device:last-account`, false on a new phone); `account_switched` (`{ provider }`: in-use account taken over from a phone with progress); `signed_out`; `account_deleted`; `save_prompt_shown` / `save_prompt_dismissed` (`{ moment }`). After a link or sign-in, **`setUserId(uid)`** (the pseudonymous Firebase uid) and user property `account_state = 'linked'`, so the same person is recognized across phones and visits; on sign-out `setUserId(null)` and `account_state = 'anonymous'`. The instance ID is **not** reset on sign-out (so a repeat user on the same phone isn't counted as new); it's reset with `resetAnalyticsData()` **only on delete**. The privacy review confirms `setUserId`. | No (the privacy review still confirms `setUserId`) |
| 16 | Orphaned anonymous users | **No cleanup now** (confirmed 2026-11-22): dev holds only the developer's own test users, and there's no prod use yet. Every install does sign in anonymously (`AuthProvider`), so prod will create anonymous users; with D3 only an account switch from a phone with progress leaves one behind. A policy for those stays a Phase 8 item. | No |
| 17 | Platforms for this slice | **iOS is tested and shipped with this slice** (decided 2026-11-22: most teens use iPhones, and the App Store is the publishing priority). The repo has never built for iOS (`ios/` isn't generated; development is on Windows with no Mac), so the slice starts with an **iOS bring-up** (below): the SlateStack Apple Developer account, EAS Build for a dev client on a physical iPhone, the Firebase iOS app, and Sign in with Apple. Done means the device test passes on both an iPhone and Android. | No |
| 18 | Apple token revoke on delete | As ph-9-us-9/10: the client gets a fresh Apple authorization code and calls `revokeToken` **before** `deleteAccount`; if the revoke fails, nothing is deleted and the user is told to try again. | No |
| 19 | `deleteAccount` retry after a lost response | **`auth/user-not-found` from `deleteUser` counts as success**, and the recursive delete of an empty path is a no-op, so a retry after a dropped response returns `{ deleted: true }` instead of `internal`. The caller's ID token stays valid for a short while after the Auth user is gone, so the retry still authenticates. Extends ph-9-us-9's idempotency criterion. | No (technical; not a product choice) |
| 20 | Rules and data model | **No rule or index changes.** Nothing about the account is stored in Firestore; client deletes under `users/{uid}` stay denied; `deleteAccount` uses the Admin SDK. | No (ph-9-us-9) |

## iOS bring-up (first, D17)

The app has only ever run on Android. Before ph-9-us-9/us-10 can be device-tested on an iPhone:
1. **Apple Developer Program:** the existing **SlateStack organization account** (D-U-N-S in
   place, owned by the user). In it: the App ID `com.slatestack.dmv` with the **Sign in with
   Apple** capability, and the test iPhone registered for development builds.
2. **Firebase iOS app** in `dmv-app-dev` for that bundle ID; `GoogleService-Info.plist` into
   `firebase-config/dev/` (gitignored, like the Android file; `app.config.ts` already points at
   it).
3. **EAS Build** (`docs/phase-0-plan.md` Section D; no Mac needed): an `eas.json` `development`
   profile with `expo-dev-client`, building the iOS dev client in the cloud and installing it
   on the iPhone through internal distribution. `ios/` stays ungenerated in the repo (CNG; README
   "Known gap"), unless a Mac becomes available.
4. **Smoke pass of Slices 1–5 on the iPhone** (confirmed 2026-11-22): onboarding, a baseline
   section with force-quit and resume, flashcards, a mini-quiz, a timed practice test with the
   app backgrounded. Anything that breaks is fixed in this slice before the sign-in work, since
   it would otherwise block the Slice 6 device test.
5. README: the iOS build and install steps.

This is the biggest risk in the slice (account approval time, first iOS run), so it starts first
and can run in parallel with the `deleteAccount` backend work.

## Backend (ph-9-us-9)

**Auth configuration** (dev now, prod at launch, D13):
- Enable the **Google** provider in `dmv-app-dev`. Add the debug keystore's SHA-1 and SHA-256 to
  the Android app (and later the release/Play signing keys for prod), then re-download
  `google-services.json` into `firebase-config/dev/` so it carries the OAuth client. Record the
  web client ID the Google library needs (it's not a secret, but keep it per environment, e.g.
  in `app.config.ts` `extra`).
- Enable **Apple** in `dmv-app-dev` (D17): Services ID, key and team ID in the Firebase console,
  with the capability from the iOS bring-up. Google on iOS also needs the plist's reversed client
  ID as a URL scheme (the Google library's config plugin).
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
API the free version of the library uses on Android. Add their plugins to `app.config.ts` and
rebuild both dev clients (Android locally, iOS on EAS). The Android emulator must be a Google
Play image. Apple's button uses `expo-apple-authentication`'s native button (Apple's design rules).

**`AuthProvider`** (`src/auth/AuthProvider.tsx`):
- Adds `account` (D10) and a `switching` status (D8) to `AuthState`.
- Adds actions: `saveProgress(provider)` (link-first flow, D3; returns `linked`, `cancelled`,
  `in-use` with the pending credential, or an error), `switchToExistingAccount(pending)`,
  `signOut()`, `deleteMyData()`. Screens call these; no screen imports the auth SDK.
- A cancelled provider sheet returns `cancelled` and shows nothing. Offline (checked up front
  with `useIsOnline`, and `auth/network-request-failed` / functions `unavailable` after) →
  "You need a connection for this".
- `ensureUserDocument` already handles a signed-in user whose doc exists (switch, new phone).

**Local data** (new, e.g. `src/storage/clearLocalData.ts`, D6/D7/D15), two functions:
- `keepOnlyUser(uid)`: after a sign-in or switch, removes `dmv-app:` keys that don't carry
  `:{uid}` (device-level `dmv-app:device:*` keys are kept); `clearDeckCache()`; if `uid` differs
  from `dmv-app:device:last-account`, clears Firestore's cache; then stores `uid` as the last
  account.
- `clearAllLocalData()`: on delete, every `dmv-app:` key, `clearDeckCache()`, Firestore's cache,
  `resetAnalyticsData()`.
Each step is independent and logged on failure, so one failing step doesn't skip the rest.
Sign-out calls neither. In-memory hooks (Concept Progress, profile, practice attempts) already
reset on uid change; the `switching` unmount makes sure of it.

**Save-progress card** (new shared component, e.g. `src/account/SaveProgressCard.tsx`):
copy from ph-9-us-10 ("Changing phones? Save your progress so you can pick up where you left
off."), the official Google button (and Apple on iOS), "Not now", the disclosure line (D14).
Used on baseline results (below the results, never above the score) and Home (D9). The same
provider step (checkbox, buttons, disclosure) is reused on the welcome step and in Settings. New per-uid
flags in `src/profile/localFlags.ts`: `prompt:baseline-results-dismissed`,
`home:save-progress-dismissed`. Hidden for linked users. After a link: an inline "Progress saved
to Google" confirmation, then the card is gone.

**"Already in use" sheet** (D3/D4): "This Google account already has saved progress. Use that
account instead? Progress on this phone since you installed won't carry over." → "Use that
account" / "Cancel". If an unfinished test is saved on this phone, the warning says so too.
Skipped on the welcome step.

**Welcome step** (`src/onboarding/WelcomeScreen.tsx`, ph-9-us-3): under "Get started", the
privacy notice "By continuing, you agree to our Privacy Policy." (D14), then a text link
"Already saved your progress? Sign in" → provider choice → link-first flow. Existing
account → switch (no warning) → the onboarding gate sends a user whose profile has `onboarding`
to Home. New account → linked to this uid, note from device test step 9, onboarding continues.

**Settings** (`src/settings/SettingsScreen.tsx`): sections "YOUR PROGRESS" and "YOUR TEST".
- Account state: "Not saved — your progress lives on this phone only" with the provider buttons
  and "Already saved on another phone? Sign in" (same flow), or "Saved with Google/Apple".
- Test date (unchanged).
- "Sign out" (linked only): confirm with "You can sign back in any time to get your progress
  back." → D8 sequence → onboarding. Nothing on the phone is cleared (D6).
- "Delete my data" (everyone): first confirm explains what goes (progress, tests, test date, and
  the sign-in if linked); second confirm "This can't be undone" → (Apple: revoke, D18) →
  `deleteAccount` → on success, local `signOut()` → `clearAllLocalData()` → anonymous sign-in →
  onboarding. On failure: "We couldn't finish deleting your data. Try again." with retry; nothing
  claims success early and local data is kept until the server confirms.
- Privacy link (D14).

**Callable wrapper:** `deleteAccount` in `src/api/callables.ts` with its types in
`src/api/types.ts`, using the existing error mapping in `src/api/callableErrors.ts`.

## Relationship to Slice 5b

- **5b-1 is complete** (2026-11-22). Its carry-forward (`dmv-app:practice-mode:{uid}`) is covered
  by D6 (removed when someone else signs in, and on delete).
- **5b-2 is not built; its spec (reviewed 2026-11-22) is
  `2026-11-22-slice-5b2-missed-questions-progress-design.md`** (ph-4-us-5 missed questions and
  card-performance recording, ph-4-us-7 latest score vs baseline, Home test card). Slice 6
  doesn't depend on it, and 5b-2 doesn't depend on Slice 6. How the overlaps are handled there:
  - Its recorded set of test IDs is `dmv-app:card-perf-recorded:{uid}`, so D6 clears it.
  - Its missed-questions list is built from `testAttempts`, so it comes back on a new phone; the
    weighted flashcard order (local card performance) doesn't (D5).
  - It adds Home's weak-spots card (its D13), so ph-9-us-6 can close in full here.
  - Both slices add to Home; ph-9-us-7's order puts "Save your progress" last.
- **5b-2 is built first** (confirmed 2026-11-22). The iOS bring-up can start while 5b-2 is being
  built, since it touches no app code.

## Carry-forwards closed by this slice

The carry-forwards all said "on sign-out". With D6 they apply **when a different person signs
in, and on delete**, not on sign-out itself.

| Carry-forward | From | Covered by |
|---------------|------|------------|
| `clearDeckCache()` | Slice 4a, ph-2-us-12, `flashcardCache.ts` | `keepOnlyUser`, `clearAllLocalData` |
| Reset last-opened topic and Concept Progress | Slice 4a, ph-2-us-12, ph-9-us-7 | Key sweep; uid-change reset + `switching` unmount |
| Clear `card-perf` keys and the saved deck pass | Slice 4b, ph-2-us-6 | Key sweep |
| Clear the saved practice session | Slice 5a | Key sweep (`active-test:*`, including the legacy key) |
| Clear `dmv-app:practice-mode:{uid}` | Slice 5b-1, ph-3-us-9 decision 8 | Key sweep |
| Welcome step "Sign in" link | ph-9-us-3, `WelcomeScreen.tsx` | Welcome step above |
| Settings account state, sign-out, "Delete my data" | ph-9-us-7, `SettingsScreen.tsx` | Settings above |

Stale comments to update when built: `flashcardCache.ts` ("for sign-out once Slice 6 adds it"),
`WelcomeScreen.tsx`, `SettingsScreen.tsx`.

## Story and doc updates

When device-tested on an iPhone and Android: ph-9-us-9 and ph-9-us-10 Complete; parents ph-9-us-8 and ph-9-us-6 Complete; ph-9-us-7 Complete apart from cards owned
by later phases. Record D3, D5, D6 (changes ph-9-us-10's "clear local data on sign-out" criterion),
D9, D14 and D15 in ph-9-us-10, and D19 in ph-9-us-9; update the Phase 9 summary's open items
(providers confirmed). Update `build-order.md` with status and the iOS bring-up; `Prod-Launch-Plan.md` with prod provider setup, release SHA
fingerprints, the Firebase iOS app for prod and the privacy policy URL; `prd.md` Section 9
(providers decided: Google + Apple).
`CLAUDE.md` if `test:functions` gains the Auth emulator.

## Left to the builder

- Exact copy and layout within the patterns above (plain, encouraging, no account language).
- The Firestore cache-clear API details on RNFirebase v26 (D7), and how the pending credential
  is held between "in use" and "Use that account" (re-requesting the provider sheet is
  acceptable if the credential can't be reused).
- Whether the "switching" view is a spinner or a short message.
- Tests: `deleteAccount` cases above in `npm run test:functions`; `keepOnlyUser` (other
  uids' keys removed, the same uid's and device keys kept, cache cleared only for a different
  account) and `clearAllLocalData` (one failing step doesn't stop the others) and account-state derivation
  in `npm run test:app`; save card visibility and dismissal per moment, the in-use sheet, cancel
  with no error, offline message, Settings for anonymous vs linked, delete success/failure/retry
  and the two confirms, the checkbox gating the buttons, and the analytics events (new vs
returning) in `npm run test:components` (auth, Google and Apple sign-in mocked). Sign-in
  flows themselves are covered by the manual device test above.
