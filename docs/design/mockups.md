# MVP Mockups & Style Guide (v1)

**Canvas:** https://claude.ai/code/artifact/c8c39aca-826b-4d94-89ec-01ff24c99c35

Working name used in the mockups: **GreenLight** — placeholder, not decided.

## Locked so far

**Color — Option B, "Teal & Coral."** Cool teal-blue primary + warm coral secondary accent. Full token values (oklch) are on the canvas's Style Guide page, "Color Tokens" artboard.

**Typography — Option 2, "Outfit + Plus Jakarta Sans."** Outfit for headings/numbers, Plus Jakarta Sans for body — rounder and friendlier than the original Space Grotesk/Sora pairing. Full type scale is on the "Typography" artboard.

All screen mockups and style-guide reference sheets (Color Tokens, Typography, Spacing & Radius, Components A/B) use both locked choices consistently. Unchosen alternatives (color options A/C/D/E; type options 4 and 6) are kept on the canvas for the record, marked as not selected.

## Style guide status: color, type, spacing & components all done and locked

## Screens covered (the 4 "differentiator" screens, per PRD MVP scope)
- **Home** — flashcard/practice-test entry points, "weak spots" (spaced-repetition surfacing, deliberately not gamified — no streaks/leaderboards per PRD scope), driving-log summary, test-date prompt.
- **Scenario question card** — the core differentiator vs. plain flashcard apps: SCENARIO badge, intersection diagram, 4-way-stop right-of-way example, answer feedback states, explanation panel. Same shell is meant to be reused inside both flashcards and practice tests, alongside plain fact-recall cards.
- **Driving-time logger** — active-session state with elapsed timer, cumulative day/night hours toward the supervised-driving requirement, recent sessions, export. Paired with a second artboard mocking the persistent lock-screen/notification indicator (Android foreground service is the reliable baseline; iOS Live Activity is best-effort per phase-0 findings).
- **Test date + pass/fail log** — one artboard with a "stage" tweak toggling Before-test (set date, reminder) / After-test (pass/fail prompt) states.

## Known placeholders / to confirm before build
- App name ("GreenLight") is a working placeholder.
- The "50 hrs" supervised-driving figure shown is sample data — confirm Colorado's exact required hours (and any day/night split) against the DMV before using it as real copy.
- All practice-test scores, session history, and dates in the mockups are illustrative sample data.