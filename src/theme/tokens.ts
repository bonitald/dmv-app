import type { TextStyle } from 'react-native';

// Locked design tokens — mirrors the "Teal & Coral" palette + Outfit/Plus Jakarta Sans
// typography on the design canvas (docs/design/mockups.md, canvas Style Guide page).
// oklch() source values converted to hex since React Native's StyleSheet doesn't support
// oklch(). Do not hand-pick new colors/sizes here — extend the canvas first, then mirror it.

export const colors = {
  primary: '#0095a5',
  primarySoft: '#d9f0f3',
  secondary: '#ff7643',
  secondarySoft: '#ffe7dd',
  darkSurface: '#021c22',
  ink: '#052127',
  inkSoft: '#4c5b60',
  inkFaint: '#778286',
  line: '#d9dfe2',
  background: '#f3fafa',
  surface: '#ffffff',
  success: '#32b36e',
  successSoft: '#d8f8e2',
  alert: '#da2848',
} as const;

// 4px scale — space-1..space-7, per the canvas's Spacing & Radius artboard.
export const spacing = {
  space1: 4,
  space2: 8,
  space3: 12,
  space4: 16, // card padding
  space5: 20, // screen margin
  space6: 24,
  space7: 32,
} as const;

export const radius = {
  chip: 10,
  button: 12,
  row: 14,
  card: 16,
  hero: 20,
  pill: 999,
} as const;

const displayFont = 'Outfit_700Bold';
const displayFontSemibold = 'Outfit_600SemiBold';
const bodyFont = 'PlusJakartaSans_400Regular';
const bodyFontSemibold = 'PlusJakartaSans_600SemiBold';
const bodyFontBold = 'PlusJakartaSans_700Bold';

export const typography: Record<string, TextStyle> = {
  display: { fontFamily: displayFont, fontSize: 44, color: colors.ink },
  stat: { fontFamily: displayFont, fontSize: 27, color: colors.ink },
  h1: { fontFamily: displayFont, fontSize: 20, color: colors.ink },
  h2: { fontFamily: displayFontSemibold, fontSize: 16, color: colors.ink },
  bodySemibold: { fontFamily: bodyFontSemibold, fontSize: 14, color: colors.ink },
  body: { fontFamily: bodyFont, fontSize: 14, color: colors.ink, lineHeight: 14 * 1.4 },
  small: { fontFamily: bodyFont, fontSize: 12, color: colors.inkSoft },
  caption: {
    fontFamily: bodyFontBold,
    fontSize: 11,
    color: colors.secondary,
    letterSpacing: 0.06 * 11,
  },
};

// Font files to load via useFonts() before rendering anything that uses `typography`.
export const fontsToLoad = {
  Outfit_600SemiBold: require('@expo-google-fonts/outfit/600SemiBold/Outfit_600SemiBold.ttf'),
  Outfit_700Bold: require('@expo-google-fonts/outfit/700Bold/Outfit_700Bold.ttf'),
  PlusJakartaSans_400Regular: require('@expo-google-fonts/plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf'),
  PlusJakartaSans_600SemiBold: require('@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf'),
  PlusJakartaSans_700Bold: require('@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf'),
};
