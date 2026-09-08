const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Required for @react-native-firebase/* (v22+), which resolves via package.json "exports"
// maps — without this, Metro falls back to relative-path resolution and fails on imports
// like `../common/index.js` that only exist through the exports map.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
