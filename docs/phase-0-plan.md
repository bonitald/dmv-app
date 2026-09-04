# Phase 0 Plan: Who Does What, and How

_Companion to `docs/phases/phase-0-project-foundations/`. This doc sequences the 8 stories
into an actual work order and gives step-by-step instructions for the pieces that need you
specifically — mainly Firebase/Google Cloud console work, written assuming it's been a
while since you've been in that console._

## Recommended Flow

```
YOU: Section A (Firebase projects + config files)
        │
        ▼
YOU: hand me the config files + project IDs
        │
        ▼
ME:  ph-0-us-1 (Expo scaffold)  ──┐
                                    ├─▶ ME: ph-0-us-4 (wire Firebase SDK)
ME:  ph-0-us-6 (Firestore rules) ─┘         │
                                              ▼
                                    ME: ph-0-us-7 (anonymous sign-in)
                                              │
                                              ▼
                                    ME: ph-0-us-8 (navigation shell)
        │
        ▼
YOU (only if/when you want to test on a physical iOS device or ship to TestFlight):
Apple Developer account + EAS Build — see Section D, not needed to keep developing
```

| Order | Story | Owner | Depends on |
|---|---|---|---|
| 1 | ph-0-us-3 setup (Firebase projects) | **You** (Section A) | — |
| 2 | ph-0-us-6 setup (enable Anonymous Auth) | **You** (Section B) | Step 1 |
| 3 | ph-0-us-1 (Expo scaffold, Android-runnable) | Me | — (can start in parallel with 1–2) |
| 4 | ph-0-us-4 (wire Firebase SDK) | Me | Steps 1–3, your config files (Section C) |
| 5 | ph-0-us-6 (Firestore rules + emulator tests) | Me | Step 1 |
| 6 | ph-0-us-7 (anonymous sign-in + persistence) | Me | Steps 4–5 |
| 7 | ph-0-us-8 (navigation shell) | Me | Step 3 |
| — | ph-0-us-1 iOS device/TestFlight builds | **You** (Section D) | Only when you're ready to test on a real iPhone or distribute a beta — not required to keep building |

You only need to do Sections A and B to unblock all my work. Section D is optional until
later.

---

## Section A: Create your two Firebase projects - DONE Completed by Eldy

Per `ph-0-us-3`'s acceptance criteria, we need **two** Firebase projects, not one shared
project with prefixed collections:

- `dmv-app-dev` (used for both local dev and staging — the AC only requires prod to be
  isolated, so one non-prod project is enough for now; we can split dev/staging later if it
  ever becomes worth the extra overhead)
- `dmv-app-prod`

A Firebase project **is** a Google Cloud project under the hood — you're not creating
something separate from GCP, Firebase just wraps it with a friendlier console.

### A1. Create the dev project - DONE Completed by Eldy

1. Go to **console.firebase.google.com** and sign in with the Google account you want to
   own this app's infra.
2. Click **Add project** (or **Create a project**).
3. Project name: `dmv-app-dev`. Firebase will generate a project ID like
   `dmv-app-dev-xxxxx` — that's fine, you don't need a custom ID.
4. When asked about **Google Analytics**: enable it and either pick an existing Analytics
   account or let it create one — this is what backs Firebase Analytics, which `prd.md`
   Section 7 already calls for.
5. Click **Create project** and wait for it to finish provisioning.

### A2. Create the prod project - DONE Completed by Eldy

Repeat A1 with project name `dmv-app-prod`. Keep it a fully separate project — don't reuse
the dev project's Analytics account is fine either way, but the project itself must be new.

### A3. Register the app's Android and iOS identifiers in each project - DONE Completed by Eldy

Before doing this, pick a package/bundle identifier for the app — this has to match exactly
between Firebase and the app config, and it's annoying to change after you've published to
a store. Suggested default, reverse-DNS style: **`com.slatestack.codmv`**. Tell me if you'd
rather use something else before we lock it in — it's cheap to change now, not later.

For **each** of the two projects (dev, prod):

1. From the project's console home, click the **gear icon → Project settings**.
2. Under "Your apps," click **Add app** and choose the **Android** icon.
   - Android package name: `com.slatestack.dmv` (dev and prod can share the same
     package name across projects — the project itself is what separates the environments,
     not the package name).
   - Nickname: `dmv-app-dev (Android)` or `dmv-app-prod (Android)` so they're easy to tell
     apart later.
   - You can skip the SHA-1 field for now (only needed later for Google Sign-In, which
     we're not using — see `docs/prd.md` Section 7, we're using Anonymous Auth).
   - Click **Register app**, then **Download `google-services.json`**. Save it somewhere
     you'll remember (e.g. a `firebase-config/` folder outside version control) — don't
     commit it anywhere yet.
   - Click through "Add Firebase SDK" — you can skip/ignore those code snippets, I'll wire
     the SDK in as part of `ph-0-us-4`.
3. Back in "Your apps," click **Add app** again, choose the **iOS/Apple** icon.
   - iOS bundle ID: same value, `com.slatestack.dmv`.
   - Nickname: `dmv-app-dev (iOS)` / `dmv-app-prod (iOS)`.
   - App Store ID: leave blank for now.
   - Click **Register app**, then **Download `GoogleService-Info.plist`**. Save it next to
     the Android file from the same project.
   - Skip the remaining SDK setup steps here too.

When you're done you should have **4 files total**: an Android + iOS config file from the
dev project, and an Android + iOS config file from the prod project.

### A4. Enable Firestore in each project (locked, not test mode) - DONE Completed by Eldy

For **each** project:

1. In the left sidebar, click **Build → Firestore Database**.
2. Click **Create database**.
3. **Important**: choose **Start in production mode** (not "test mode" — test mode leaves
   the database wide open to any read/write, which fails `ph-0-us-3`'s "starts in a locked
   (deny-all) mode" requirement).
4. Pick a location (`us-west3` — closest to your expected users;
   Colorado-only for MVP, so any US region is fine, doesn't need to be fully precise).
5. Click **Create**. You'll see a rules editor with production-mode's default deny-all
   rules already in place — leave it as-is, I'll replace it with the real rules in
   `ph-0-us-6`.

### A5. Enable Hosting in each project (provisioned only, no deploy needed yet) - DONE Completed by Eldy

1. Left sidebar → **Build → Hosting**.
2. Click **Get started** and click through the setup screens — you can ignore/skip the
   CLI install and deploy steps it walks you through; we just need Hosting turned on for the
   project per `ph-0-us-3`, not actually deployed to yet.

---

## Section B: Enable Anonymous Authentication - DONE Completed by Eldy

Per `ph-0-us-6`'s setup task, done in **each** of the two projects:

1. Left sidebar → **Build → Authentication**.
2. Click **Get started** if you haven't opened Authentication in this project before.
3. Go to the **Sign-in method** tab.
4. Find **Anonymous** in the provider list, click it, toggle **Enable**, click **Save**.

That's it — no other providers need to be enabled. Confirm you did this for **both**
projects (dev and prod).

---

## Section C: Hand the config back to me

Once Sections A and B are done, give me:

1. The 4 config files (`google-services.json` × 2, `GoogleService-Info.plist` × 2) — paste
   their contents or tell me the file paths if they're already somewhere in/near the repo.
   Path to DEV config files: 
   - "C:\Users\eldyd\OneDrive\Documents\SlateStack\firebase-config\dev-dmv\google-services.json"
   - "C:\Users\eldyd\OneDrive\Documents\SlateStack\firebase-config\dev-dmv\GoogleService-Info.plist"
   Path to PROD config files: 
   - "C:\Users\eldyd\OneDrive\Documents\SlateStack\firebase-config\prd-dmv\google-services.json"
   - "C:\Users\eldyd\OneDrive\Documents\SlateStack\firebase-config\prd-dmv\GoogleService-Info.plist"
2. Confirmation of the package/bundle ID used: `com.slatestack.dmv`.
3. The two Firebase project IDs (visible in each project's **Project settings** page, right
   under the project name). 
   DEV Project Id: dmv-app-dev
   PROD Project Id: dmv-app-prod

With that I can do `ph-0-us-1`, `ph-0-us-4`, `ph-0-us-6`, `ph-0-us-7`, and `ph-0-us-8`
back-to-back.

---

## Section D: Apple Developer account (only when you're ready for a real iOS build)

This is **not** required to keep developing — I can scaffold and you can run everything on
Android locally, and I can build against the JS/TS layer without a physical iOS device.
You only need this section when you want to:
- Test on a real iPhone (not just iterate on Android), or
- Distribute a TestFlight beta (relevant later, around Phase 8's beta rollout).

Since this repo is on Windows, there's no local Xcode — an iOS build has to go through
**EAS Build** (Expo's cloud build service), which needs your own Apple Developer account
behind it.

1. Go to **developer.apple.com/account**, sign in with (or create) an Apple ID.
2. Enroll in the **Apple Developer Program** — this costs **$99/year** and can take up to
   24–48 hours for Apple to approve, so it's worth starting early if you know you'll want
   iOS testing/distribution soon.
3. Once enrolled, we'll connect it to EAS Build (`eas login`, then `eas build --platform ios`
   walks through linking your Apple account) — I'll guide you through that step when we get
   here; no need to pre-configure anything else on the Apple side right now.

---

## Verification checklist (maps back to `ph-0-us-3` / `ph-0-us-6` acceptance criteria)

- [x] Two separate Firebase projects exist (`dmv-app-dev`, `dmv-app-prod`) — not one project
  with environment-prefixed collections.
- [x] Each project has an Android app and an iOS app registered under the same
  package/bundle ID.
- [x] Each project's Firestore was created in **production mode** (locked, not test mode).
- [x] Each project has Hosting enabled (no deploy needed).
- [x] Each project has **Anonymous** enabled under Authentication → Sign-in method.
- [x] You have all 4 config files saved somewhere, not yet committed to the repo.
