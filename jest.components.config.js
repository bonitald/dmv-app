const path = require('path');

/** Jest config for React Native component tests (`*.test.tsx` under src/), using the jest-expo
 * preset. Kept separate from jest.app.config.js, which runs plain-Node logic tests via ts-jest.
 * Native Firebase modules have no Jest mocks of their own, so each test mocks the app modules
 * that wrap them (e.g. AuthProvider, profile) rather than Firebase itself.
 *
 * Uses `roots` and native `path.join` rather than `<rootDir>` for the same Windows
 * dot-directory reason documented in jest.rules.config.js. */
module.exports = {
  preset: 'jest-expo',
  rootDir: __dirname,
  roots: [path.join(__dirname, 'src')],
  testMatch: ['**/*.test.tsx'],
  moduleNameMapper: {
    '^@expo/vector-icons$': path.join(__dirname, 'src', 'test', 'vectorIconsMock.js'),
    '^@react-native-async-storage/async-storage$': path.join(
      __dirname,
      'node_modules',
      '@react-native-async-storage',
      'async-storage',
      'jest',
      'async-storage-mock.js'
    ),
    '^@react-native-community/netinfo$': path.join(
      __dirname,
      'node_modules',
      '@react-native-community',
      'netinfo',
      'jest',
      'netinfo-mock.js'
    ),
  },
};
