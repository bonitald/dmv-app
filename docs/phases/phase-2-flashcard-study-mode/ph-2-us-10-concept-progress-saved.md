# Concept progress saved to my account

**ID:** ph-2-us-10
**Layer:** Parent
**Children:** ph-2-us-11 (Backend), ph-2-us-12 (Frontend)
**Status:** Not Started

## Story
As a teen user,
I want each concept's status and my latest quiz score saved to my account on the server,
So that my progress isn't lost if I switch phones, once I've linked an account (Phase 9).

## Context
- **Product area**: Phase 2 (`docs/phases.md`, eighth bullet); `prd.md` Section 7 data model:
  "Concept Progress (per user per concept: status not started / in progress / reviewed / needs
  revisit, latest mini-quiz score, timestamp)".
- **Layer**: cross-cutting — a Firestore record plus rules and a `scoreTest` change (Backend), and
  a client module that reads it and writes status (Frontend).
- Unlike per-card performance (ph-2-us-6, local-only), this is server-side on purpose, so it
  survives a reinstall once the anonymous uid is linked to a real sign-in (Phase 9, account
  linking keeps the same uid). Before linking, a reinstall still loses it — the known Phase 0
  limitation.
- **Resolves a Phase 1 open item** (`phase-1-summary.md`): "Whether Concept Progress status is
  updated by `scoreTest` or stays a client action." Decision: **split by field**.
  - `scoreTest` writes the **score** fields, so a score can't be forged by the client.
  - The client writes only **status**, restricted by rules to the four allowed values. Status is
    the user's own choice (ph-2-us-9), so trusting the client for it is fine.

### Status transitions (the one place these are defined)
| Event | New status |
|---|---|
| No record yet | not started (implied — no doc is written) |
| User opens a topic's flashcards or quiz while it's not started | in progress |
| Opening a topic that's reviewed or needs revisit | unchanged (opening never downgrades) |
| "Start this concept over" at end of deck (ph-2-us-3) | unchanged |
| "Review Again" (ph-2-us-9) | in progress |
| "Come Back Later, Continue to Next Concept" | needs revisit |
| "Mark Reviewed" | reviewed |
| Mini-quiz graded by `scoreTest` | status unchanged; score fields updated |

## Acceptance Criteria
- [ ] Given a user finishes a topic's mini-quiz, when `scoreTest` grades it, then that topic's
  Concept Progress record holds the latest score and when it was taken.
- [ ] Given a user picks a next-step choice or opens a new topic, when the status changes per
  the table above, then it's saved to their Concept Progress record.
- [ ] Given a user reopens the app, when the concept list loads, then every status and latest
  score is still there.
- [ ] Given a user tries to set their own quiz score or another user's progress from the client,
  when the write reaches Firestore, then it's denied.

## Dependencies
- **Children**: ph-2-us-11 (record, rules, `scoreTest` write), ph-2-us-12 (client module).
- **Consumed by**: ph-2-us-7 (list shows status), ph-2-us-9 (choices set status), Phase 4
  (concept report) and Phase 9 (account linking keeps it).
