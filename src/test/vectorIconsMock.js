// Component-test stub for @expo/vector-icons: renders nothing visible, but keeps each icon
// component and its `glyphMap` so code that looks names up still works. The real package pulls
// in expo-font/expo-asset, which don't load under Jest.
const { createElement } = require('react');
const { View } = require('react-native');

function makeIconSet() {
  const Icon = (props) => createElement(View, { testID: props.testID });
  Icon.glyphMap = new Proxy({}, { get: () => 0 });
  return Icon;
}

module.exports = new Proxy({}, { get: (_, name) => (name === '__esModule' ? true : makeIconSet()) });
