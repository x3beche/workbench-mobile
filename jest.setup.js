jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));

require('react-native-gesture-handler/jestSetup');
// The UI-thread pieces (worklets, animated styles) run as plain JS in tests.
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

// Picking files and photos, and handing files to other apps: native modules, faked per test.
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn(async () => ({ uri: 'file:///cache/print.pdf' })) }));
// The PCM microphone (live voice to text) is a native module: not there unless a test brings one,
// so the composers record with expo-audio as in Expo Go.
jest.mock('@siteed/audio-studio', () => ({ AudioStudioModule: undefined }));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Directory: jest.fn(), Paths: { cache: 'file:///cache' } }));
// The in-app update's native pieces: the installed version, the content:// address, the installer.
jest.mock('expo-file-system/legacy', () => ({ getContentUriAsync: jest.fn(async (uri) => uri) }));
jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: jest.fn(async () => ({ resultCode: 0 })),
  ActivityAction: {
    MANAGE_UNKNOWN_APP_SOURCES: 'android.settings.MANAGE_UNKNOWN_APP_SOURCES',
    SECURITY_SETTINGS: 'android.settings.SECURITY_SETTINGS',
  },
}));
jest.mock('expo-application', () => ({
  applicationId: 'dev.workbench.mobile',
  nativeApplicationVersion: null,
  nativeBuildVersion: null,
}));

// The row swipe's handlers are worklets on a phone (Metro runs the worklets plugin over the
// library); under Jest's reanimated mock they are plain functions and the library says so.
const quietError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Some of the callbacks in the gesture are worklets')) return;
  quietError(...args);
};
