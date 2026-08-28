---
name: mobile-app-scoping
description: >
  Scope a new mobile app idea into a lightweight Product Requirements
  Document. Use this skill whenever asked to "scope a new app idea", "write
  a PRD", "define requirements for the app", "figure out what we're
  building", or at the start of any new mobile app concept before code gets
  written. Interviews the user for business requirements (problem, users,
  value prop, MVP feature set, business model) and infrastructure
  requirements (platform, backend, auth, integrations, data, compliance),
  then produces a standardized-but-light PRD at /docs/prd.md. Optimized for
  moving fast toward an MVP, not for exhaustive enterprise documentation.
---

# Mobile App Scoping Skill

You are helping the user turn a rough mobile app idea into a lightweight,
standardized Product Requirements Document (PRD) that a small team can
build an MVP from. This is a scoping/definition pass, not an implementation
pass — do not write app code as part of this skill.

The output is always a single file: **`/docs/prd.md`**.

Bias toward speed: ask only what's needed to make MVP decisions, prefer
short structured answers over essays, and don't block on questions the user
clearly doesn't have an opinion on yet — capture those as open
questions/assumptions in the doc instead of stalling.

---

## Step 0 — Check for existing scope

1. Check whether `/docs/prd.md` already exists.
   - If it exists, read it fully first. Treat this run as an **update/
     refinement pass**: summarize what's already defined, and only ask
     about sections that are missing, marked TBD, or that the user says
     they want to revisit. Don't re-ask questions already answered in the
     file.
   - If it doesn't exist, this is a **new PRD** — proceed through the full
     interview below.
2. Confirm `/docs` exists as a folder; create it if not (it will be created
   automatically when the file is written, but check for naming collisions
   first — e.g. an existing `docs/PRD.md` with different casing).

---

## Step 1 — Interview: Business Requirements

Gather these in conversation. Ask in a small number of grouped messages
rather than one question at a time — the user should be able to answer
several at once. Use `AskUserQuestion` for genuinely discrete decisions
(platform choice, auth type, business model) where a short option list
helps; use plain conversational questions for open-ended narrative answers
(problem statement, feature descriptions). Don't use `AskUserQuestion` for
things that need a paragraph answer.

Cover:

1. **Problem & vision**
   - What problem does this app solve, and for whom?
   - One-sentence pitch / elevator description.
2. **Target users**
   - Primary user persona(s) — who are they, what's their context of use?
   - Any secondary user types or admin/internal users?
3. **Core value proposition**
   - Why would someone choose this over doing nothing, or over an
     existing alternative?
4. **MVP feature set**
   - What are the 3-7 features that must exist for the MVP to be useful?
     Push back gently if the list is long — ask "what's the smallest
     version of this that's still valuable?"
   - What is explicitly **out of scope** for v1 (nice-to-haves, phase 2)?
5. **Business model / success metrics**
   - Is this monetized (subscription, one-time, ads, free/internal tool)?
     Skip if not applicable.
   - What does success look like in the first 1-3 months (a metric, not
     a vibe) — e.g. activation rate, retention, number of transactions.
6. **Timeline & constraints**
   - Any hard deadline, budget ceiling, or team size that shapes scope?

If the user doesn't know an answer yet, record it as an open question in
the PRD rather than pressing for a guess.

---

## Step 2 — Interview: Infrastructure / Technical Requirements

Cover:

1. **Platform**
   - iOS, Android, or both? Native (Swift/Kotlin) or cross-platform (React
     Native, Flutter, Expo)? If the user has no preference, recommend
     cross-platform for MVP speed unless there's a stated reason
     (heavy platform-specific APIs, existing native codebase) not to.
2. **Backend & data**
   - Does this need a backend/API, or can it be client-only /
     local-storage for MVP?
   - What are the core data entities (rough list, not a full schema)?
   - Any offline-first requirement?
3. **Auth & users**
   - Auth method: email/password, social login, SSO, magic link, none
     (anonymous)?
   - Are there user roles/permissions (e.g. admin vs. regular user)?
4. **Third-party integrations**
   - Payments, push notifications, maps/location, camera/media, analytics,
     crash reporting, other external APIs?
5. **Hosting / backend platform preference**
   - Any existing preference or constraint (Firebase, Supabase, AWS,
     existing company infra)? If none, note that as an open decision
     rather than picking one on the user's behalf.
6. **Non-functional constraints**
   - Expected scale (rough — dozens vs. thousands vs. millions of users)?
   - Any compliance/legal requirements (GDPR, HIPAA, App Store/Play Store
     policy concerns, accessibility requirements)?

Same rule as Step 1: unknowns become open questions, not blockers.

---

## Step 3 — Draft the PRD

Synthesize answers into the standardized template below. Keep every
section tight — bullet points over prose, and omit sub-bullets that have
no real content rather than writing filler. This is a lightweight MVP
scoping doc, not a 20-page spec.

```markdown
# Product Requirements Document: <App Name>

_Last updated: <YYYY-MM-DD>_

## 1. Overview
- **Problem:** <problem statement>
- **Pitch:** <one-liner>
- **Target users:** <primary persona(s), secondary if any>
- **Value proposition:** <why this, why now>

## 2. Goals & Success Metrics
- **MVP goal(s):** <1-3 bullets>
- **Success metrics:** <measurable, time-boxed if possible>

## 3. Scope
### In scope (MVP)
- <feature 1>
- <feature 2>
- ...

### Out of scope (later / v2+)
- <deferred item 1>
- ...

## 4. Users & Roles
| Role | Description | Key needs |
|---|---|---|
| ... | ... | ... |

## 5. Core Features (MVP)
| Feature | Description | Priority |
|---|---|---|
| ... | ... | Must / Should |

## 6. Business Requirements
- **Business model:** <monetization or "internal/free tool">
- **Timeline / constraints:** <deadline, budget, team size if given>

## 7. Technical & Infrastructure Requirements
- **Platform:** <iOS / Android / both, native or cross-platform + why>
- **Backend:** <API needed? Y/N, rough approach>
- **Data entities (high level):** <bullet list, not a schema>
- **Auth:** <method, roles>
- **Integrations:** <payments, push, maps, analytics, etc.>
- **Hosting / infra:** <platform if decided, else "open decision">
- **Offline support:** <Y/N and how much>

## 8. Non-Functional Requirements
- **Scale:** <rough expected usage>
- **Compliance / legal:** <GDPR, HIPAA, store policy, accessibility, or "none identified">

## 9. Risks & Open Questions
- <anything unresolved from the interview>

## 10. Assumptions
- <anything you inferred rather than were told, flagged explicitly>
```

Fill in `<App Name>` and today's date. Where the user gave no answer for a
field, don't delete the row/bullet — write `TBD` and also list it under
Risks & Open Questions so it isn't silently lost.

---

## Step 4 — Confirm and write

1. Show the drafted PRD content to the user for a quick sanity check
   before writing the file — this is fast-moving scoping work, not a
   sign-off gate, so a brief "here's the draft, flag anything off" is
   enough; don't demand formal approval.
2. Write the file to `/docs/prd.md` (create `/docs` if it doesn't exist).
3. Tell the user what was written and list the Open Questions /
   Assumptions sections explicitly, since those are the items most likely
   to need a follow-up decision before or during build.
