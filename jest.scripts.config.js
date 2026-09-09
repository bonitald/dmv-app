const path = require('path');

/** Jest config for scripts/question-bank/ — separate from jest.rules.config.js and whatever
 * the app itself eventually uses (e.g. jest-expo), which need different presets.
 *
 * Uses `roots` and native `path.join` instead of the `<rootDir>` token in `testMatch`/
 * `transform`: if this repo is ever checked out under a path with a dot-prefixed segment
 * (e.g. a worktree under `.claude/worktrees/<name>`), Jest's `<rootDir>` token substitution
 * corrupts the resulting string on Windows — it treats the backslash before the dot as a
 * glob escape and skips converting it, silently merging two path segments into one and
 * matching zero test files. Computing paths natively here avoids that bug entirely
 * (confirmed by hitting exactly this failure while setting up this plan's own worktree). */
module.exports = {
  testEnvironment: 'node',
  rootDir: __dirname,
  roots: [path.join(__dirname, 'scripts', 'question-bank')],
  testMatch: ['**/*.test.ts'],
  globalSetup: path.join(__dirname, 'scripts', 'question-bank', 'jest.globalSetup.js'),
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: path.join(__dirname, 'scripts', 'question-bank', 'tsconfig.json') }],
  },
};
