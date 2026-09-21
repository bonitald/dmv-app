const path = require('path');

module.exports = {
  testEnvironment: 'node',
  rootDir: __dirname,
  roots: [path.join(__dirname, 'src')],
  testMatch: ['**/*.test.ts'],
  globalSetup: path.join(__dirname, 'jest.globalSetup.js'),
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: path.join(__dirname, 'tsconfig.json') }],
  },
};
