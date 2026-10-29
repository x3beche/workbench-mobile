/**
 * The words the widget is drawn in: the app's own language (Settings >
 * Language, the phone's when it is Auto), read from the device - the widget
 * task can start in a fresh runtime, before anything of the app has loaded.
 */
import { settingsStrings, type SettingsStrings } from '../lib/settingsStrings';
import * as prefs from '../storage/prefs';
import { setAppLanguage, uiLang, type UiLang } from '../update/strings';

export async function widgetWords(): Promise<{ t: SettingsStrings; lang: UiLang }> {
  const chosen = await prefs.appLang();
  setAppLanguage(chosen === 'auto' ? null : chosen);
  const lang = uiLang('auto');
  return { t: settingsStrings(lang), lang };
}
