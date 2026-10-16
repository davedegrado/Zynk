import type { ExpoConfig } from 'expo/config';

const SOUND_FILES = ['classic', 'boing', 'laser', 'coin', 'knock', 'chime', 'whoosh', 'thunder', 'bubble'].map(
  (s) => `./assets/sounds/zynk_${s}.wav`,
);

const IS_DEV = process.env.APP_VARIANT === 'development';

// Brand: Speow! Persistent identifiers below (slug, scheme, bundle id/package,
// sound file names) intentionally keep their original `zynk` values — changing
// them would break existing installs, push credentials, store records and links.

const config: ExpoConfig = {
  name: IS_DEV ? 'Speow! (dev)' : 'Speow!',
  slug: 'zynk',
  scheme: 'zynk',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#111111',
  ios: {
    bundleIdentifier: IS_DEV ? 'app.zynk.dev' : 'app.zynk',
    supportsTablet: false,
    infoPlist: {
      NSPhotoLibraryUsageDescription: 'Choose a profile picture for your Speow! profile.',
      NSCameraUsageDescription: 'Take a profile picture for your Speow! profile.',
      ITSAppUsesNonExemptEncryption: false,
    },
    associatedDomains: process.env.ZYNK_LINK_DOMAIN ? [`applinks:${process.env.ZYNK_LINK_DOMAIN}`] : undefined,
  },
  android: {
    package: IS_DEV ? 'app.zynk.dev' : 'app.zynk',
    adaptiveIcon: {
      backgroundColor: '#111111',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    // Push via FCM: download google-services.json from Firebase and point to it here.
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? undefined,
    permissions: ['android.permission.POST_NOTIFICATIONS', 'android.permission.VIBRATE', 'com.android.vending.BILLING'],
    blockedPermissions: ['android.permission.READ_CONTACTS', 'android.permission.RECORD_AUDIO'],
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: './assets/images/favicon.png', output: 'single' },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      { backgroundColor: '#111111', image: './assets/images/splash-icon.png', imageWidth: 160 },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/images/notification-icon.png',
        color: '#D7FF36',
        defaultChannel: 'zynk_classic',
        // Bundled so APNs/Android channels can play them; see docs/ARCHITECTURE.md#sounds
        sounds: SOUND_FILES,
      },
    ],
    'expo-secure-store',
    ['expo-audio', { microphonePermission: false, recordAudioAndroid: false }],
    'expo-web-browser',
    [
      'expo-image-picker',
      {
        photosPermission: 'Choose a profile picture for your Speow! profile.',
        cameraPermission: 'Take a profile picture for your Speow! profile.',
        microphonePermission: false,
      },
    ],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
};

export default config;
