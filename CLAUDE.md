# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

This repo currently contains **no application code** — only planning documents. There is no
`package.json`, no source tree, and no build/lint/test tooling yet. Do not assume a framework
scaffold exists; check before running any build/dev/test commands, since none are currently
defined.

## What this project is

A Colorado DMV written-permit-test practice app for teens (~15-16), combining flashcards with
situational/scenario-style questions (not just rote fact recall), practice tests, a supervised
driving-time logger with a persistent visible indicator, and self-reported pass/fail outcome
tracking. Free for MVP — no paywall; monetization is explicitly deferred until pass-rate is
validated.

The full product scope lives in `docs/prd.md` — read it before proposing features or scope
changes. Key decisions already locked in there:
- **Platform:** iOS + Android via React Native/Expo (not native, not bare RN — see below).
- **Backend:** Firebase (hosting question content, driving-session/test-outcome logs, Firebase
  Analytics).
- **Auth:** Undecided — leaning anonymous/device-based identifier rather than accounts, to
  minimize PII/COPPA exposure for minor users. Treat as an open question, not a settled choice.
- **Content:** DMV handbook questions must be paraphrased/generated, not reproduced verbatim
  (legal/reuse concern flagged in the PRD).

`docs/phase-0-findings.md` documents a completed spike on the driving-timer persistent indicator
(iOS Live Activity vs. Android foreground service). Key takeaways to respect in any related
implementation:
- Build via **Expo prebuild + config plugins + a custom dev client** — neither platform requires
  ejecting to bare React Native, but both lose Expo Go.
- **Android foreground-service + chronometer notification** is the low-risk, policy-compliant
  baseline — build this first/regardless.
- **iOS Live Activity** is higher-effort and has a known iOS 18 timer-freeze bug; treat it as
  best-effort, with an in-app-only timer as an acceptable fallback rather than a shipping blocker.
- On both platforms, **persist session start/stop timestamps immediately** on start/stop (not
  just an in-memory JS timer), so a killed app process doesn't lose driving-log data — this data
  is relied on for the real in-person driving test.

## Working in this repo right now

- Treat `docs/prd.md` as the source of truth for scope; it has explicit "Risks & Open Questions"
  and "Assumptions" sections — check those before making a scope decision on the user's behalf.
- The `mobile-app-scoping` skill (`.claude/skills/mobile-app-scoping/`) is what generated
  `docs/prd.md` and is designed to run again as an update/refinement pass if the user wants to
  revise scope — it reads the existing PRD first rather than re-asking answered questions.
- Once actual app code is scaffolded (e.g. via `npx create-expo-app`), this file should be
  updated with real build/lint/test commands and the resulting architecture.
