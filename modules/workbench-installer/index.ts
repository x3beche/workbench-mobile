/**
 * The app's own small native module (android/): whether Android lets this
 * app install an APK, and a file's SHA-256 computed natively. Absent on the
 * web, on iOS and in Expo Go - then `installer` is null.
 */
import { requireOptionalNativeModule } from 'expo';

export interface WorkbenchInstaller {
  canInstall(): boolean;
  sha256(uri: string): Promise<string>;
}

export const installer = requireOptionalNativeModule<WorkbenchInstaller>('WorkbenchInstaller');
