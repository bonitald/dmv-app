import type { ExpoConfig } from 'expo/config';

// Selects which Firebase project the app builds against. Defaults to dev so a
// developer running the app locally can never accidentally point at prod (ph-0-us-4 AC).
// Override with `APP_ENV=production` (or `staging`, once that project exists) for other
// build profiles, e.g. via an EAS Build profile's env vars.
type AppEnv = 'development' | 'staging' | 'production';

const APP_ENV = (process.env.APP_ENV as AppEnv) || 'development';

const FIREBASE_CONFIG_DIR: Record<AppEnv, string> = {
  development: './firebase-config/dev',
  // No separate staging Firebase project yet (see docs/phase-0-plan.md) — staging builds
  // use the dev project's config until one is provisioned.
  staging: './firebase-config/dev',
  production: './firebase-config/prod',
};

const configDir = FIREBASE_CONFIG_DIR[APP_ENV];

const config: ExpoConfig = {
  name: 'DMV Prep',
  slug: 'dmv-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  extra: {
    appEnv: APP_ENV,
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.slatestack.dmv',
    googleServicesFile: `${configDir}/GoogleService-Info.plist`,
  },
  android: {
    package: 'com.slatestack.dmv',
    googleServicesFile: `${configDir}/google-services.json`,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: ['@react-native-firebase/app', '@react-native-firebase/analytics'],
};

export default config;
