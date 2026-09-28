# Prod Launch Plan

Tracks everything needed to stand up `dmv-app-prod` and point the app at it. Nothing here has
been run against prod yet. Update the **Status** column and the log at the bottom as steps are
done.

Projects (from `.firebaserc`): `dev` → `dmv-app-dev` (also used for staging), `prod` →
`dmv-app-prod`. Every command below names the project explicitly with `--project`. Never rely on
the default, which is dev.

## Order of operations

| # | Step | Status |
|---|------|--------|
| 0 | Prerequisites (billing, auth, bucket) | Not started |
| 1 | Deploy Firestore rules and indexes to prod | Not started |
| 2 | Deploy Cloud Functions to prod | Not started |
| 3 | Copy question content from dev to prod (snapshot export/import) | Not started |
| 4 | Build the app against the prod Firebase config | Not started |
| 5 | Verify end to end on a prod build | Not started |

Rules and functions go first, because the app reads questions only through the Cloud Functions.
Content before that would sit unreachable; functions without content would return empty tests.

## 0. Prerequisites

- [ ] **Blaze (pay-as-you-go) billing on `dmv-app-prod`.** Required for Cloud Functions (2nd gen)
      and for Firestore export/import. Dev already needed this.
- [ ] **Cloud Build and Artifact Registry permissions on prod.** Dev needed a Cloud Build IAM fix
      before functions would deploy (see `docs/history/LOG.md`, 2026-09-25), and prod will
      likely need the same.
- [ ] **Org policy override so the functions can be public on prod.** The slatestack.io org
      blocks granting anything to `allUsers` ("Domain restricted sharing",
      `iam.allowedPolicyMemberDomains`). Callable functions need `allUsers` as Cloud Run
      invoker: the functions check the Firebase login in their own code, because Cloud Run IAM
      can't read Firebase tokens. Without this, every call gets a 403 before reaching our code,
      and the app sees `UNAUTHENTICATED` (hit on dev 2026-09-27). Override the policy for
      `dmv-app-prod` only, not the whole org. Console: project `dmv-app-prod` → IAM & Admin →
      Organization Policies → Domain restricted sharing → Manage policy → Override parent's
      policy → Add rule → Allow all. (If that constraint isn't enforced, check "Allowed policy
      members", `iam.managed.allowedPolicyMembers`.) Needs the Organization Policy Administrator
      role on the org. Do this **before** step 2, so the functions deploy can set the invoker
      itself.
- [ ] **Anonymous Authentication enabled** in the prod console (Authentication → Sign-in method).
      The app signs every user in anonymously on first launch. If this is off, the app can't
      start.
- [ ] **Firestore database created** in prod, and its **location** noted here: `________`.
      The location can't be changed later, and the snapshot bucket must be compatible with it
      (step 3).
- [ ] **Snapshot bucket** created for exports, e.g. `gs://dmv-app-dev-backups`. The bucket must
      be in the same location as the prod Firestore database, or in the multi-region that
      contains it.
- [ ] **Prod project number** noted here: `________` (Project settings → General). Needed to
      grant the prod Firestore service agent read access to the bucket.
- [ ] **Minors privacy review** (prd.md Section 9 action). The app serves 15–16 year olds;
      confirm this is complete before real users reach prod.

## 1. Firestore rules and indexes

```bash
firebase deploy --only firestore --project dmv-app-prod
```

Deploys `firestore.rules` and `firestore.indexes.json` (see `firebase.json`). The rules deny all
client access except the caller's own `users/{uid}` paths, so question content can only be
reached through the Cloud Functions.

- Before deploying, run the rules tests locally with `npm run test:rules`.
- Index builds can take several minutes after deploy. Queries that need an index fail until the
  build finishes. Check the Firestore → Indexes tab.

## 2. Cloud Functions

```bash
firebase deploy --only functions --project dmv-app-prod
```

Deploys the `functions/` codebase. The predeploy step runs `npm --prefix functions run build`.
Functions run in `us-central1`:

| Function | Purpose |
|---|---|
| `assembleTest` | Builds a practice test and shuffles each question's choices |
| `assembleMiniQuiz` | Builds a topic-scoped mini-quiz |
| `getFlashcards` | Returns a topic's cards; rate-limited, and the only path that sends answers |
| `startOrResumeBaseline` | Serves the fixed baseline (`baselineTests/v1`) one section at a time |
| `scoreTest` | Grades tests, mini-quizzes and baseline sections |

- Before deploying, run the functions tests locally with `npm run test:functions`.
- Deploy functions **before** the prod app build is used, so the callables exist when the app
  first calls them.

### After deploying: service account and invoker permissions

The slatestack.io org turns off Google's automatic Editor grant for default service accounts.
So on a fresh project the functions deploy fine but can't read Firestore (`PERMISSION_DENIED`
in the function logs, `INTERNAL` in the app). Both fixes were needed on dev on 2026-09-27.

- [ ] **Give the functions' runtime service account Firestore access.** The functions run as the
      default compute service account and only use Firestore, so grant just Cloud Datastore
      User, not Editor. Use the prod project number from step 0:

  ```bash
  gcloud projects add-iam-policy-binding dmv-app-prod --member=serviceAccount:<PROD_PROJECT_NUMBER>-compute@developer.gserviceaccount.com --role=roles/datastore.user
  ```

  Confirm the account the functions actually run as:
  `gcloud run services describe scoretest --region us-central1 --project dmv-app-prod --format="value(spec.template.spec.serviceAccountName)"`.

- [ ] **Check the functions are publicly invokable.** The deploy sets this when the org policy
      override (step 0) is in place. If it didn't, grant it per function (Cloud Run service
      names are lowercase):

  ```bash
  gcloud run services add-iam-policy-binding startorresumebaseline --region=us-central1 --member=allUsers --role=roles/run.invoker --project=dmv-app-prod
  gcloud run services add-iam-policy-binding scoretest --region=us-central1 --member=allUsers --role=roles/run.invoker --project=dmv-app-prod
  gcloud run services add-iam-policy-binding assembletest --region=us-central1 --member=allUsers --role=roles/run.invoker --project=dmv-app-prod
  gcloud run services add-iam-policy-binding assembleminiquiz --region=us-central1 --member=allUsers --role=roles/run.invoker --project=dmv-app-prod
  gcloud run services add-iam-policy-binding getflashcards --region=us-central1 --member=allUsers --role=roles/run.invoker --project=dmv-app-prod
  ```

- [ ] **Smoke-check each function without logging in.** The expected result is HTTP 401 with the
      function's own `"requires a signed-in caller"` message. That means the call reached our
      code, and our login check turned it away. An HTML **403 Forbidden** page means the invoker
      grant is still missing.

  ```bash
  curl -s -X POST -H "Content-Type: application/json" -d '{"data":{}}' https://us-central1-dmv-app-prod.cloudfunctions.net/startOrResumeBaseline
  ```

## 3. Question content: dev → prod snapshot (managed export/import)

We copy with Firestore's managed export and import, not a script. Each export leaves a dated
snapshot in Cloud Storage, which doubles as a backup of exactly what was shipped.

### What to copy

| Collection | Copy? | Why |
|---|---|---|
| `questions` | Yes | The reviewed bank: 1,415 approved as of 2026-09-25 |
| `topics` | Yes | Topic catalog: title, description, order, approved count |
| `baselineTests` | Yes | Fixed baseline definition (`v1`) |
| `ingestionRuns` | Yes | Chunk plan; keeps traceability and lets `qb:publish-topics` run against prod |
| `users` | **Never** | Dev test users' progress, attempts and baseline runs. That's fake student data. |

### Commands

```bash
# 1. Export the content collections from dev into a dated folder
gcloud firestore export gs://dmv-app-dev-backups/content-YYYY-MM-DD \
  --collection-ids=questions,topics,baselineTests,ingestionRuns \
  --project=dmv-app-dev

# 2. One-time: let the prod Firestore service agent read the bucket
gsutil iam ch \
  serviceAccount:service-<PROD_PROJECT_NUMBER>@gcp-sa-firestore.iam.gserviceaccount.com:objectViewer \
  gs://dmv-app-dev-backups

# 3. Import into prod (same collection list)
gcloud firestore import gs://dmv-app-dev-backups/content-YYYY-MM-DD \
  --collection-ids=questions,topics,baselineTests,ingestionRuns \
  --project=dmv-app-prod
```

Always pass `--collection-ids` on both the export and the import. Without it, the export includes
`users` too.

### Caveats

- **Billing:** both projects must be on Blaze. Export and import also bill for document reads and
  writes, plus bucket storage.
- **Bucket location:** the bucket must be in the same location as the prod database, or in the
  multi-region that contains it. Otherwise the import fails.
- **Import overwrites, never deletes:** documents with the same ID are replaced. Documents in
  prod that aren't in the snapshot stay. If prod ever holds stale or test questions, delete them
  before importing, or they'll be served alongside the new ones.
- **It's a point-in-time snapshot:** later review edits in dev don't reach prod on their own.
  Take a new dated export and import it again. Keep old snapshot folders as the history of what
  shipped.
- **Question IDs must stay stable:** `baselineTests/v1` and users' test attempts reference
  question IDs. Export/import keeps IDs, but never regenerate them in dev after launch.
- **`topics` counts are copied as they were at export time.** If questions change later, re-run
  the import, or run `qb:publish-topics` against prod deliberately. The `qb:*` scripts refuse
  prod by convention (see the question-bank README), so that needs an explicit decision.
- **Check the baseline after import.** It should report 3 sections of 15, all approved:
  ```bash
  GOOGLE_CLOUD_PROJECT=dmv-app-prod npm run qb:validate-baseline -- v1
  ```
  This is read-only, so it's the one `qb:*` command that's safe to point at prod.

## 4. App pointing at the prod Firebase config

`app.config.ts` chooses the Firebase project at **build time** from `APP_ENV`. It defaults to
`development`, so a local run can never hit prod by accident.

| `APP_ENV` | Config files used |
|---|---|
| unset / `development` | `firebase-config/dev/` |
| `staging` | `firebase-config/dev/` (no separate staging project yet) |
| `production` | `firebase-config/prod/` (`google-services.json`, `GoogleService-Info.plist`) |

- [ ] Confirm `firebase-config/prod/` holds the files downloaded from the **prod** project. The
      `project_id` in `google-services.json` should read `dmv-app-prod`.
- [ ] Build with `APP_ENV=production` set. The native Firebase config is baked in at prebuild, so
      a dev client built against dev stays on dev. Prod needs its own build, e.g.
      `APP_ENV=production npx expo prebuild --clean` followed by the release build (or the
      equivalent EAS profile once `eas.json` exists).
- [ ] Both platforms use the ID `com.slatestack.dmv` for dev and prod. A prod build installed on a
      test device replaces the dev client, and each has its own anonymous user and data.
- [ ] Check `Constants.expoConfig.extra.appEnv` in the prod build shows `production`.

## 5. Verification on a prod build

- [ ] First launch signs in anonymously, and a `users/{uid}` doc appears in **prod** (not dev).
- [ ] Baseline: start → section 1 → check-in → resume → all 3 sections → per-topic results.
- [ ] Answer choices vary in position (not always A).
- [ ] A practice test and a mini-quiz assemble and score.
- [ ] Flashcards load for a topic.
- [ ] Nothing from the prod build shows up in `dmv-app-dev`.

## Log

| Date | What was done | By |
|---|---|---|
| 2026-09-27 | Plan written; nothing run against prod yet | Eldy / Claude |
| 2026-09-27 | Added org policy override (step 0) and post-deploy service account / invoker permissions with a smoke check (step 2), learned from dev | Eldy / Claude |
