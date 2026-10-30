/**
 * The app's second small native module (android/): whether Android lets this
 * app's background work run freely - the power switch a Samsung buries under
 * Settings > Apps > Workbench > Battery. Read-only: nothing here asks for a
 * permission or changes a setting; the Settings > Home screen widget page only
 * says where the switch is and opens the page (expo-intent-launcher).
 *
 * Absent on the web, on iOS and in Expo Go - and in a jest run, where `expo` has
 * no native modules at all - then `power` is null and the page says the switch
 * cannot be read.
 */
import * as Expo from 'expo';

export interface WorkbenchPower {
  /** `PowerManager.isIgnoringBatteryOptimizations`: true when Android will not hold this app's work back. */
  isIgnoringBatteryOptimizations(): boolean;
}

const ask = (Expo as unknown as { requireOptionalNativeModule?: (name: string) => unknown })
  .requireOptionalNativeModule;

export const power = typeof ask === 'function' ? (ask('WorkbenchPower') as WorkbenchPower | null) : null;
