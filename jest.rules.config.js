const path = require('path');

/** Jest config for firestore-tests/ (rules-unit-testing) only — kept separate from
 * whatever the app itself eventually uses (e.g. jest-expo), which needs different presets.
 *
 * Uses `roots` and native `path.join` instead of the `<rootDir>` token in `testMatch`/
 * `transform`: when this repo is checked out under a path with a dot-prefixed segment
 * (e.g. a worktree under `.claude/worktrees/<name>`), Jest's `<rootDir>` token substitution
 * corrupts the resulting string on Windows — it treats the backslash before the dot as a
 * glob escape and skips converting it, silently merging two path segments into one and
 * matching zero files. Computing paths natively here avoids that bug entirely. */
module.exports = {
  testEnvironment: 'node',
  rootDir: __dirname,
  roots: [path.join(__dirname, 'firestore-tests')],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: path.join(__dirname, 'firestore-tests', 'tsconfig.json') }],
  },
};
