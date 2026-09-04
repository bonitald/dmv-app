---
name: phase-user-stories
description: >
  Break one phase from docs/phases.md into detailed, numbered user stories, split into
  Backend (Firebase: Firestore schema, security rules, Cloud Functions) and Frontend
  (Expo/React Native app) children that roll up to a parent user-facing story. Use this
  whenever asked to "write user stories for phase X", "break down phase N", "detail the
  stories for [phase name]", "split phase X into backend and frontend stories", or before
  starting implementation work on a phase in docs/phases.md. Produces one file per story
  under docs/phases/phase-<n>-<slug>/, IDs formatted ph-<phase>-us-<number>, plus a phase
  summary rollup file. Not for writing code — planning/documentation only.
---

# Phase User Stories Skill

You are turning one phase's checklist items from `docs/phases.md` (the app-wide phase
tracker) into fully detailed, individually numbered user stories, organized so that every
piece of implementation work — Firebase/backend and Expo/React Native frontend — rolls up
to a single user-facing **parent story**. This mirrors the structure used in the reference
docs at `glimpse-backend/documents/phases-portal/phase-5-video-delivery-and-notification-done/`
and `take-portal/documents/user-stories/`, adapted for a single-repo app where "backend"
means Firebase (Firestore schema/rules, Cloud Functions) rather than a separate service.

Do not write application code as part of this skill — this is a planning/documentation pass.

---

## Numbering scheme

Every story — parent or child — gets an ID of the form:

```
ph-<phase number>-us-<sequential number>
```

- The sequential number is per-phase (resets at each phase) and counts **all** stories in
  that phase in one shared sequence — parents and children interleaved in creation order,
  not two separate counters.
- Before assigning new IDs, scan `docs/phases/phase-<n>-*/` for any existing `ph-<n>-us-*`
  files and continue from the highest number found. Never reuse or renumber an existing ID,
  even if a later story is deleted — gaps are fine.
- A parent story's file names its children; each child's file names its parent (`Parent:`
  field) — the relationship is recorded on both ends so either file is enough to see the
  rollup.

---

## Step 0 — Identify the phase and its parent stories

1. Read `docs/phases.md`. Ask the user which phase number to detail if not already stated.
2. That phase's existing checkbox bullets (`- [ ] As a teen user, I can ...`) are the
   candidate **parent stories** — one parent per bullet. Don't invent new parent-level scope
   beyond what's already in `docs/phases.md`; if the user wants to add a story that isn't
   there yet, add it to `docs/phases.md` first (or note it explicitly as a scope addition)
   rather than silently introducing it only at the detailed level.
3. If `docs/phases.md` doesn't have the phase yet, interview the user briefly for the
   parent-level stories before proceeding — same bar as the bullets already in that file
   (one clear user-facing outcome per story).

---

## Step 1 — Split each parent into Backend / Frontend children

For each parent story, decide how it decomposes:

- **Backend-only**: no user-visible client change, e.g. a Firestore schema addition, a
  security rule, a scheduled Cloud Function with no UI trigger.
- **Frontend-only**: no Firebase/data-layer change, e.g. pure navigation, layout, copy, or
  client-only local-storage logic.
- **Backend + Frontend** (most feature stories): create one child of each layer. The
  Frontend child should explicitly note it's backed by its sibling Backend child (mirroring
  the "Backed by backend Phase X" pattern in `take-portal/documents/frontend-phases.md`) —
  if the backend piece isn't built yet, say so plainly rather than assuming a contract that
  doesn't exist.

Don't force a split that doesn't fit — a trivial parent can stay as a single story with no
children if there's truly nothing to divide (note this explicitly rather than manufacturing
a hollow child for the sake of the pattern).

Confirm the proposed parent/child breakdown with the user before writing files — a short
list of "Parent: ... → Backend: ..., Frontend: ..." is enough, this doesn't need to be a
formal sign-off gate.

---

## Step 2 — Write each story to its own file

Location: `docs/phases/phase-<n>-<phase-slug>/ph-<n>-us-<k>-<story-slug>.md`

(`<phase-slug>` matches the phase's title in `docs/phases.md`, kebab-cased — e.g. Phase 6
"Driving Time Logger" → `phase-6-driving-time-logger`.)

Use this template for every story, parent or child — omit sections that are genuinely N/A
for that story's layer rather than leaving them as empty scaffolding:

```markdown
# <Story title>

**ID:** ph-<n>-us-<k>
**Layer:** Parent | Backend | Frontend
**Parent:** ph-<n>-us-<parent-k>          <!-- omit for parent stories -->
**Children:** ph-<n>-us-<x> (Backend), ph-<n>-us-<y> (Frontend)   <!-- parent stories only -->
**Status:** Not Started

## Story
As a <role>,
I want <capability>,
So that <benefit>.

## Context
- **Product area**: <maps to a docs/phases.md phase>
- **Layer**: Backend (Firebase) / Frontend (Expo/React Native) / cross-cutting
- Any decisions/constraints inherited from `docs/prd.md` or `docs/phase-0-findings.md` that
  bound this story — cite the section.

## Acceptance Criteria
- [ ] Given <state>, when <action>, then <outcome>.
- ...

## Data and API                      <!-- Backend / Parent stories -->
- **Firestore schema changes**: collections/fields touched or added.
- **Security rules**: who can read/write what.
- **Cloud Functions**: any triggers, scheduled jobs, or callable functions.

## UI/UX Notes                       <!-- Frontend / Parent stories -->
- **Screens/flows**: where this lives in the app's navigation.
- **Empty/error/offline states**: what the user sees when data isn't there yet.

## Dependencies
- **Blocked by**: other story IDs or external decisions this needs first.
- **Parent** (children only): ph-<n>-us-<parent-k> — one line on how this child fulfills
  part of the parent's user-facing outcome.
- **Backed by** (frontend children only): ph-<n>-us-<backend sibling id>, and whether that
  sibling is built yet.

## Test Notes
- **Happy path**:
- **Edge cases**:
- **Failure modes**:

## Tasks
- [ ] <implementation checklist item>

## Questions
- <anything unresolved — or "None outstanding">
```

Notes on filling it in:
- Pull constraints straight from `docs/prd.md` / `docs/phase-0-findings.md` where relevant
  (e.g. any driving-timer story should cite the spike's persist-timestamps-immediately
  finding) rather than re-deriving them from scratch.
- Keep Acceptance Criteria in Given/When/Then form, one concrete scenario per bullet — match
  the specificity level of the `pus-25-send-video-ready-email.md` reference, not vague
  restatements of the story.
- A parent story's own file can be lighter — Story, Context, Acceptance Criteria (the
  user-facing ones), Children, and Dependencies are enough; it doesn't need Tasks or Test
  Notes since those live on its children.

---

## Step 3 — Write the phase summary rollup

Location: `docs/phases/phase-<n>-<phase-slug>/phase-<n>-summary.md`

Create it on first use for a phase; update it (don't overwrite unrelated prior content) on
later runs that add more stories to the same phase.

```markdown
# Phase <n>: <Phase title> — Summary

## Status: Not Started

## Stories

| ID | Title | Layer | Parent | Status |
|----|-------|-------|--------|--------|
| ph-<n>-us-1 | ... | Parent | — | Not Started |
| ph-<n>-us-2 | ... | Backend | ph-<n>-us-1 | Not Started |
| ph-<n>-us-3 | ... | Frontend | ph-<n>-us-1 | Not Started |
```

Roll the phase's own `## Status` line up from its children only when the user says stories
have shipped — this skill drafts stories, it doesn't mark them done.

---

## Step 4 — Confirm and report

Tell the user: which phase was detailed, how many parent stories and how many total
stories (including children) were created, the assigned ID range, and the file paths
written. Flag any parent story that didn't get a Backend/Frontend split and why.
