# Slice 6 — Save Progress to an Account Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A teen can save their progress to Google (or Apple on iPhone) without changing their
uid, get it back on a new phone, sign out and back in, and delete everything. The slice ships on
**iPhone and Android**, starting with the app's first iOS build.

**Architecture:** One new callable, `deleteAccount` (Admin SDK recursive delete of
`users/{uid}` then the Auth user, idempotent). On the app: `AuthProvider` grows an `account`
state, a `switching` status and four actions (`saveProgress`, `switchToExistingAccount`,
`signOut`, `deleteMyData`), so no screen imports the auth SDK. A pure `localData` module decides
which AsyncStorage keys to keep when a uid signs in (`keepOnlyUser`) and wipes everything on
delete (`clearAllLocalData`). A shared `SaveProgressStep` (privacy checkbox, provider buttons,
disclosure line) is used by the baseline-results card, Home's card, the welcome step and
Settings. Analytics events are sent from `AuthProvider` through one small module.

**Tech Stack:** Firebase Cloud Functions v2 + Admin SDK on Node 22 (Jest against the Firestore
and Auth emulators), Expo SDK 57 with config plugins and dev clients (Android built locally, iOS
on EAS Build), `@react-native-firebase/auth` / `firestore` / `analytics` v26,
`@react-native-google-signin/google-signin`, `expo-apple-authentication`, AsyncStorage, Jest.

**Spec:** `docs/superpowers/specs/2026-11-22-slice-6-save-progress-account-design.md` (D1–D20,
reviewed 2026-11-22), and its stories:
`docs/phases/phase-9-first-run-onboarding-and-account-linking/` ph-9-us-8, ph-9-us-9,
ph-9-us-10. **Build after Slice 5b-2** (`2026-11-22-slice-5b2-missed-questions-progress.md`);
Task 0 can start any time.

## Blocked on the user (do not guess)

- **Task 0, steps 1–2:** the App ID, the Sign in with Apple capability and the test iPhone's
  registration are done by the user in the existing SlateStack organization Apple Developer
  account (D-U-N-S in place, owned by the user). Tasks 1–9 don't wait for it; Task 10 (device
  test) does.
- **Privacy review** (outside engineering): supplies the real policy URL and confirms
  `setUserId(uid)`. Until then the link points at a placeholder.
- **Prod:** providers stay disabled in prod until the minors privacy review is done (D13).

## Decisions made while planning (flag to the user at review)

- **Uid matching for `keepOnlyUser`:** a key belongs to uid `u` when one of its `:`-separated
  segments equals `u` (Firebase uids contain no `:`). `dmv-app:device:*` keys are always kept.
  Every existing key builder already puts the uid in its own segment.
- **The pending credential** for "Use that account" is the Google ID token / Apple identity
  token + nonce from the sheet the teen just finished, held in memory by `AuthProvider` for that
  one confirm; if it's stale (`auth/invalid-credential`), the provider sheet is shown again.
- **`switching` view** is the existing splash-style blank screen with "One moment…".
- **Analytics** lives in `src/auth/accountAnalytics.ts` so tests can assert events without
  mocking Firebase directly.

## Global Constraints

- No name, email, photo or provider profile in Firestore, Analytics parameters, logs or UI.
  The Analytics user ID is the Firebase uid.
- Firestore rules and indexes don't change. Client deletes under `users/{uid}` stay denied.
- `deleteAccount` takes no input and only ever deletes `request.auth.uid`. Doc comments follow
  the `cloud-function-documentation` skill.
- Native changes go through `app.config.ts` plugins only (CNG; never hand-edit `android/` or
  `ios/`). Each new native library → rebuild both dev clients.
- Colors, spacing, radius and type only from `src/theme/tokens.ts`; tap targets ≥ 48pt; Google
  and Apple buttons in their official styles.
- Keys: `dmv-app:prompt:baseline-results-dismissed:{uid}`, `dmv-app:home:save-progress-dismissed:{uid}`,
  `dmv-app:device:last-account` (a uid string).
- Analytics events (exact): `save_prompt_shown {moment}`, `save_prompt_dismissed {moment}`
  (`moment`: `baseline_results` | `home` | `settings` | `welcome`), `account_linked {provider}`,
  `account_signed_in {provider, returning_device}`, `account_switched {provider}`,
  `signed_out`, `account_deleted`. User property `account_state`: `anonymous` | `linked`.
- Copy (exact):
  - Save card: title "Save your progress", body "Changing phones? Save your progress so you can
    pick up where you left off.", "Not now"
  - Checkbox: "I agree to the Privacy Policy" ("Privacy Policy" is the link); disclosure "We keep
    only your sign-in ID and email, to bring your progress back. Nothing else."
  - Linked: "Progress saved to Google" / "Progress saved to Apple"
  - In use: title "This {Google|Apple} account already has saved progress", body "Use that
    account instead? Progress on this phone since you installed won't carry over." (+ " Your
    unfinished test on this phone will be lost too." when one is saved), buttons "Use that
    account", "Cancel"
  - Welcome notice: "By continuing, you agree to our Privacy Policy." ("Privacy Policy" is the
    link)
  - Welcome link: "Already saved your progress? Sign in"; new account note: "No saved progress
    yet — it's now saved with {provider}."
  - Settings: section "YOUR PROGRESS"; "Not saved — your progress lives on this phone only";
    "Saved with Google" / "Saved with Apple"; "Already saved on another phone? Sign in"; "Sign
    out" → "Sign out?" / "You can sign back in any time to get your progress back." / "Cancel",
    "Sign out"; "Delete my data" → "Delete your data?" / "This deletes your progress, tests and
    test date{, and your saved sign-in}." / "Cancel", "Continue" → "This can't be undone" /
    "Everything will be deleted and the app will start fresh." / "Cancel", "Delete"; failure
    "We couldn't finish deleting your data. Try again."; "Privacy Policy" row
  - Offline: "You need a connection for this."
  - Switching: "One moment…"

## Review Focus

1. **Sign out → sign back in with the same account** → local extras still there; **a
   different account** → the first account's keys gone, Firestore cache cleared. (Tasks 3, 4.)
2. **`credential-already-in-use` then Cancel** → nothing changed, still the same anonymous uid,
   nothing cleared. (Task 4.)
3. **`deleteAccount` response lost, retried** → `{ deleted: true }`, no `internal`. (Task 1.)
4. **Apple revoke fails** → `deleteAccount` not called, nothing cleared, retry offered. (Task 8.)
5. **Mid-switch writes** → no screen writes under the old uid after `switching` starts (the
   navigator is unmounted). (Task 4.)

---

### Task 0: iOS bring-up (spec "iOS bring-up"; can run in parallel with Tasks 1–9)

**Files:**
- Create: `eas.json`
- Modify: `app.config.ts` (nothing until Task 5 adds the sign-in plugins), `README.md`
  (iOS build and install section; update "Known gap"), `.gitignore` if EAS adds anything local

- [ ] **Step 1 (user):** In the SlateStack Apple Developer account, create the App ID
  `com.slatestack.dmv` with Sign in with Apple; register the test iPhone.
- [ ] **Step 2 (user, with the builder):** In `dmv-app-dev`, add the iOS app for that bundle ID;
  save `GoogleService-Info.plist` to `firebase-config/dev/` (gitignored).
- [ ] **Step 3:** `npm i -D eas-cli` (or use `npx eas-cli`), `eas login`, `eas build:configure`;
  `eas.json` with a `development` profile (`developmentClient: true`, `distribution: internal`,
  `env.APP_ENV=development`). The gitignored config files must reach the build: use EAS file
  environment variables for the two Firebase config files (document which).
- [ ] **Step 4:** `eas build --profile development --platform ios`; install on the iPhone; run
  Metro and open the app.
- [ ] **Step 5: Smoke pass of Slices 1–5 on the iPhone:** onboarding with a test date; one
  baseline section, force-quit, resume; flashcards for a topic; a mini-quiz; a timed practice
  test with the app backgrounded for a minute, then submit; Progress tab. Write down anything
  broken and fix it before Task 10 (each fix its own commit, `fix(ios): …`).
- [ ] **Step 6:** README iOS steps; commit `build: iOS dev client via EAS Build`.

### Task 1: `deleteAccount` callable (ph-9-us-9)

**Files:**
- Create: `functions/src/deleteAccount.ts`, `functions/src/deleteAccount.test.ts`
- Modify: `functions/src/index.ts`, `functions/README.md`, `package.json` (`test:functions` →
  `firebase emulators:exec --only firestore,auth …`), `firebase.json` (Auth emulator port if not
  set)

**Interfaces:**
- Produces: `export async function deleteAccountForUser(db: Firestore, auth: Auth, uid: string): Promise<{ deleted: true }>`; callable `deleteAccount` (no input) → `{ deleted: true }`.

- [ ] **Step 1: Write the failing tests:** seed `users/u1` with a doc in each of
  `testAssignments`, `testAttempts`, `baseline`, `conceptProgress`, `rateLimits`, plus
  `questions/q1`, `topics/t1`, `baselineTests/v1`, and an Auth user `u1`; call →
  nothing under `users/u1`, Auth user gone, shared docs present. No profile doc → Auth user still
  deleted. Second call after success → `{ deleted: true }`. `deleteUser` throwing a non
  not-found error → `HttpsError('internal')`, Firestore already empty; next call succeeds.
  Callable without auth → `unauthenticated`, nothing deleted.
- [ ] **Step 2:** `npm run test:functions -- deleteAccount` → fails.
- [ ] **Step 3: Implement** with `db.recursiveDelete(db.collection('users').doc(uid))` then
  `auth.deleteUser(uid)`, treating `auth/user-not-found` as done; log uid and outcome only.
  Doc comment per the skill (Reads, Writes, why the order, why it's idempotent).
- [ ] **Step 4:** run → passes; whole `test:functions` green; `npm --prefix functions run build`.
- [ ] **Step 5: Deploy** `firebase deploy --only functions:deleteAccount` to `dmv-app-dev`; smoke
  check (unauthenticated call → 401).
- [ ] **Step 6: Commit** `feat(ph-9-us-9): deleteAccount callable`.

### Task 2: Google and Apple providers in dev (ph-9-us-9)

**Files:** `README.md` (provider setup), `docs/Prod-Launch-Plan.md` (section 0: Google + Apple
providers, release SHA fingerprints, prod iOS app, privacy policy URL)

- [ ] **Step 1 (user, guided):** Enable Google in `dmv-app-dev`; add the debug keystore SHA-1
  and SHA-256 (`cd android && ./gradlew signingReport`) to the Android app; re-download
  `google-services.json` and the iOS plist into `firebase-config/dev/`. Note the web client ID.
- [ ] **Step 2 (user, guided; needs Task 0 step 1):** Enable Apple: Services ID, key, team ID.
- [ ] **Step 3:** Document both, commit `docs(ph-9-us-9): sign-in provider setup`.

### Task 3: Local data module

**Files:**
- Create: `src/storage/localData.ts`, `src/storage/localData.test.ts`
- Modify: `src/profile/localFlags.ts` (export `DEVICE_LAST_ACCOUNT = 'dmv-app:device:last-account'`
  and getters/setters)

**Interfaces:**
- Produces:
  ```ts
  export function keysToRemoveFor(allKeys: string[], uid: string): string[] // pure
  export async function keepOnlyUser(uid: string, opts: { clearFirestoreCache: () => Promise<void> }): Promise<{ differentAccount: boolean }>
  export async function clearAllLocalData(opts: { clearFirestoreCache: () => Promise<void>; resetAnalytics: () => Promise<void> }): Promise<void>
  ```
  (Firestore and Analytics are injected so the module runs under `test:app`.)

- [ ] **Step 1: Write the failing tests:** `keysToRemoveFor` keeps `dmv-app:card-perf:u1:row`,
  `dmv-app:active-test:u1:practice`, `dmv-app:active-test:u1` (legacy), `dmv-app:device:last-account`,
  non-`dmv-app:` keys; removes the same keys for `u2`; a uid that's a substring of another
  (`u1` vs `u10`) isn't confused. `keepOnlyUser`: removes others' keys, calls `clearDeckCache`,
  calls `clearFirestoreCache` only when the last account differs (and when none is stored and
  other users' keys existed), stores the uid, returns `differentAccount`; one step throwing
  doesn't skip the rest. `clearAllLocalData`: every `dmv-app:` key gone, both callbacks called.
- [ ] **Step 2:** `npm run test:app -- localData` → fails.
- [ ] **Step 3: Implement** (`getAllKeys`, `multiRemove`, each step in its own try/catch,
  logged).
- [ ] **Step 4:** run → passes.
- [ ] **Step 5: Commit** `feat(ph-9-us-10): keep only the signed-in user's local data`.

### Task 4: `AuthProvider` account state and actions

**Files:**
- Create: `src/auth/providers.ts` (Google / Apple credential helpers), `src/auth/accountAnalytics.ts`,
  `src/auth/AuthProvider.test.tsx`
- Modify: `src/auth/AuthProvider.tsx`, `App.tsx` (render "One moment…" while `switching`),
  `src/api/callables.ts` + `src/api/types.ts` (`deleteAccount`)

**Interfaces:**
- Produces on `useAuth()`:
  ```ts
  status: 'loading' | 'ready' | 'offline' | 'error' | 'switching'
  account: { kind: 'anonymous' } | { kind: 'linked'; provider: 'google' | 'apple' } | null
  saveProgress(provider, opts?: { fromWelcome?: boolean }): Promise<
    | { result: 'linked' } | { result: 'cancelled' } | { result: 'offline' }
    | { result: 'in-use'; provider } | { result: 'signed-in' } | { result: 'error' }>
  switchToExistingAccount(): Promise<'switched' | 'cancelled' | 'offline' | 'error'>
  signOut(): Promise<void>
  deleteMyData(): Promise<'deleted' | 'offline' | 'revoke-failed' | 'error'>
  ```
  `providers.ts`: `getGoogleCredential()`, `getAppleCredential()` (each returns a credential or
  `'cancelled'`), `revokeAppleToken()`.

- [ ] **Step 1: Write the failing tests** (mock `@react-native-firebase/auth`, `./providers`,
  `./accountAnalytics`, `../storage/localData`, `../api/callables`):
  - `account` is `anonymous` for an anonymous user and `linked/google` after a link
    (`onUserChanged` fires with Google in `providerData`).
  - link success → `account_linked`, `setUserId(uid)`, `account_state=linked`, uid unchanged,
    `keepOnlyUser` not needed (same uid) but `device:last-account` stored.
  - `credential-already-in-use` → `in-use`; `switchToExistingAccount()` → `switching` →
    `signInWithCredential` → `keepOnlyUser(newUid)` → `account_switched` (or
    `account_signed_in` with `returning_device` when `fromWelcome`) → `ready`.
  - `fromWelcome` + in use → switches straight away, no `in-use` result.
  - cancelled sheet → `cancelled`, no state change, no event.
  - offline (`auth/network-request-failed`) → `offline`.
  - `signOut` → `switching` → `signOut` → anonymous sign-in → `signed_out`, `setUserId(null)`,
    `account_state=anonymous`; `keepOnlyUser` and `clearAllLocalData` **not** called.
  - `deleteMyData`: Apple-linked → `revokeAppleToken` first, failure → `revoke-failed` and no
    callable; success path → `deleteAccount` → local `signOut` → `clearAllLocalData` →
    `account_deleted` → anonymous sign-in; callable error → `error`, nothing cleared.
- [ ] **Step 2:** `npm run test:components -- AuthProvider` → fails.
- [ ] **Step 3: Implement.** Firestore cache clear: `terminate(getFirestore())` then
  `clearPersistence` (check the RNFirebase v26 modular API names); it runs while `switching`
  (navigator unmounted). Keep `ensureUserDocument` as is.
- [ ] **Step 4:** run → passes; `npx tsc --noEmit`.
- [ ] **Step 5: Commit** `feat(ph-9-us-10): AuthProvider account state and sign-in actions`.

### Task 5: Native sign-in libraries

**Files:** `package.json`, `app.config.ts`, `src/auth/providers.ts`

- [ ] **Step 1:** Check `@react-native-google-signin/google-signin` and
  `expo-apple-authentication` against Expo SDK 57 / RN 0.86 (`npx expo install`), and which
  Google API the free library uses on Android. Record the versions in the commit message.
- [ ] **Step 2:** Add both plugins to `app.config.ts` (Google: iOS URL scheme from the plist's
  `REVERSED_CLIENT_ID`; Apple: `ios.usesAppleSignIn: true`); put the web client ID in `extra`.
- [ ] **Step 3:** Fill in `providers.ts` for real (Apple only when `Platform.OS === 'ios'`).
- [ ] **Step 4:** Rebuild: `npx expo prebuild --platform android --clean` + `npm run android`;
  `eas build --profile development --platform ios`. Both open the app.
- [ ] **Step 5: Commit** `build(ph-9-us-10): Google and Apple sign-in libraries`.

### Task 6: `SaveProgressStep` and the two prompt cards

**Files:**
- Create: `src/account/SaveProgressStep.tsx`, `src/account/SaveProgressCard.tsx`,
  `src/account/InUseSheet.tsx`, `src/account/privacy.ts` (`PRIVACY_POLICY_URL` placeholder)
- Modify: `src/profile/localFlags.ts` (two dismissed flags), `src/results/BaselineResults.tsx`,
  `src/home/HomeScreen.tsx`
- Test: `src/account/SaveProgressStep.test.tsx`, `src/account/SaveProgressCard.test.tsx`

- [ ] **Step 1: Write the failing tests:** buttons disabled until the checkbox is ticked;
  Apple button only on iOS (`Platform.OS` mocked); "Privacy Policy" opens the URL; Google →
  `saveProgress('google')`; `linked` → "Progress saved to Google" then the card hides;
  `cancelled` → nothing shown; `offline` → "You need a connection for this."; `in-use` →
  `InUseSheet`, "Use that account" → `switchToExistingAccount`, "Cancel" → nothing. Card:
  hidden for linked users; Home card hidden with no graded attempt (`useRecentAttempts` from
  5b-2 empty); "Not now" sets the flag and fires `save_prompt_dismissed`; shown once →
  `save_prompt_shown`.
- [ ] **Step 2:** run → fails.
- [ ] **Step 3: Implement**; on baseline results the card sits below the results and buttons;
  on Home it's the last card.
- [ ] **Step 4:** run → passes.
- [ ] **Step 5: Commit** `feat(ph-9-us-10): save-progress prompts on baseline results and Home`.

### Task 7: Welcome step "Sign in"

**Files:** `src/onboarding/WelcomeScreen.tsx` (+ test)

- [ ] **Step 1: Write the failing tests:** the privacy notice "By continuing, you agree to our
  Privacy Policy." shows under "Get started" and its link opens `PRIVACY_POLICY_URL` (D14); the
  sign-in link shows under it; it opens
  `SaveProgressStep` with `fromWelcome`; `signed-in` with a profile that has `onboarding` →
  lands on Main (the onboarding gate handles it); `linked` (new account) → the note, then the
  Choice step.
- [ ] **Step 2:** run → fails. **Step 3:** implement (a bottom sheet or a pushed screen,
  builder's call). **Step 4:** run → passes; update the file comment.
- [ ] **Step 5: Commit** `feat(ph-9-us-10): sign in from the welcome step`.

### Task 8: Settings

**Files:** `src/settings/SettingsScreen.tsx` (+ `SettingsScreen.test.tsx`)

- [ ] **Step 1: Write the failing tests:** anonymous → "Not saved…" with `SaveProgressStep` and
  the "Already saved on another phone? Sign in" link, no Sign out; linked → "Saved with Google",
  Sign out shown; Sign out confirm → `signOut()`; Delete → two confirms → `deleteMyData()`;
  `error` → failure line with Try again; `revoke-failed` → same line; `offline` → offline line;
  the success path shows nothing (the app restarts at onboarding); test date row unchanged;
  Privacy Policy row.
- [ ] **Step 2:** run → fails. **Step 3:** implement (Alert for the confirms, as elsewhere).
  **Step 4:** run → passes; update the file comment.
- [ ] **Step 5: Commit** `feat(ph-9-us-10): Settings account, sign-out and delete`.

### Task 9: Stale comments and full checks

- [ ] **Step 1:** Update the "Slice 6" comments in `src/study/flashcardCache.ts`,
  `WelcomeScreen.tsx`, `SettingsScreen.tsx`.
- [ ] **Step 2:** `npx tsc --noEmit`, `npm run test:app`, `npm run test:components`,
  `npm run test:functions`, `npm run test:rules` all green (record counts).
- [ ] **Step 3: Commit** `chore(ph-9-us-10): tidy Slice 6 comments`.

### Task 10: Device test on iPhone and Android

- [ ] **Step 1:** Spec "Device test" steps 1–11 on the Android emulator (Google Play image,
  Google sign-in).
- [ ] **Step 2:** The same on the iPhone with Google, and steps 2, 5, 8 and 10 with Apple
  ("Hide my email" on). Check the Firebase console: uid unchanged after a link; nothing under
  `users/{uid}` and no Auth user after delete.
- [ ] **Step 3:** Analytics DebugView: the events and `account_state` arrive with no email.
- [ ] Fix anything found (each its own commit), re-run the affected steps.

### Task 11: Docs

- [ ] ph-9-us-9, ph-9-us-10, ph-9-us-8 Complete; ph-9-us-6 Complete; ph-9-us-7 Complete apart
  from Phase 6's card. Record D3, D5, D6 (replaces "clear local data on sign-out"), D9, D14, D15
  in ph-9-us-10 and D19 in ph-9-us-9; Phase 9 summary (providers confirmed); `build-order.md`
  Slice 6 status; `prd.md` Section 9 (providers decided); `CLAUDE.md` (`test:functions` uses the
  Auth emulator; iOS build steps); `docs/history/LOG.md`.
- [ ] Commit `docs: Slice 6 complete`.
