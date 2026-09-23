const path = require('path');

/** Jest config for app logic under src/ that doesn't render React Native UI. Runs in plain
 * Node via ts-jest, with native modules swapped for their official Jest mocks. Component tests
 * will need a jest-expo preset instead; add that config when the first screen test lands.
 *
 * Uses `roots` and native `path.join` rather than `<rootDir>` for the same Windows
 * dot-directory reason documented in jest.rules.config.js. */
module.exports = {
  testEnvironment: 'node',
  rootDir: __dirname,
  roots: [path.join(__dirname, 'src')],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$': path.join(
      __dirname,
      'node_modules',
      '@react-native-async-storage',
      'async-storage',
      'jest',
      'async-storage-mock.js'
    ),
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: path.join(__dirname, 'tsconfig.jest.json') }],
  },
};
