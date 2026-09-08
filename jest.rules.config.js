/** Jest config for firestore-tests/ (rules-unit-testing) only — kept separate from
 * whatever the app itself eventually uses (e.g. jest-expo), which needs different presets. */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/firestore-tests/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/firestore-tests/tsconfig.json' }],
  },
};
