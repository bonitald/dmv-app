# Phase 3: Practice Test Generator & Test-Taking UI — Summary

## Status: Not Started

Depends on Phase 1 (question bank), which is complete. Most of this phase's stories haven't been
broken out yet — run the `phase-user-stories` skill for Phase 3 to write them. New IDs continue
from ph-3-us-2.

## Stories

| ID | Title | Layer | Parent | Status |
|----|-------|-------|--------|--------|
| ph-3-us-1 | Use the on-device test cache in the test-taking flow | Frontend | — | Not Started |

## Carried over from Phase 1

- **ph-3-us-1** holds the unfinished acceptance criteria of ph-1-us-3 (scoped offline caching)
  and ph-1-us-5 (on-device cache), moved here on 2026-09-23 so Phase 1 could close. Phase 1
  built the backend and `src/study/testCache.ts`; this story wires them into the test-taking
  screen. When breaking out the rest of Phase 3, make the test-taking screen story a dependency
  of ph-3-us-1 (or fold ph-3-us-1 in as its child).
