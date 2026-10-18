/**
 * The app on this phone: the version and versionCode Android installed
 * (expo-application reads the package's own), or, in a browser and in
 * Expo Go, the ones app.json gives this build.
 */
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

import type { Installed } from './release';

export function installedApp(): Installed {
  const config = Constants.expoConfig;
  const own = Platform.OS === 'android' && Application.applicationId === 'dev.workbench.mobile';
  const version = (own && Application.nativeApplicationVersion) || config?.version || '0.0.0';
  const build = own ? Application.nativeBuildVersion : null;
  const code = build && /^\d+$/.test(build) ? Number(build) : (config?.android?.versionCode ?? null);
  return { version, code };
}
