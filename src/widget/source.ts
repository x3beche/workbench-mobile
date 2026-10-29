/**
 * Where the home screen widget's numbers come from: the two routes the
 * Analytics screen reads, asked as the account the app was last on - its
 * server and its own session from the secure store, exactly as the app asks
 * them. The last reading is kept on the device, so a widget that opens with no
 * network (or before its first fetch) still shows numbers rather than an empty
 * frame; the reading's own time is kept with it and drawn nowhere else.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { WorkbenchClient } from '../api/client';
import { currentAccountId, loadAccounts } from '../state/accounts';
import { readSession } from '../storage/secrets';
import type { WidgetSnapshot } from './data';
import { snapshotOf } from './data';

const KEY = 'workbench.widget.stats';

export async function readSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const got = JSON.parse(raw) as WidgetSnapshot;
    return got && typeof got.at === 'number' && got.models && got.tools ? got : null;
  } catch {
    return null;
  }
}

export async function saveSnapshot(snap: WidgetSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(snap));
  } catch {
    // No room to keep it: the next update reads the server again.
  }
}

/** This month's models and this week's tools, read as the last account signed in. */
export async function fetchSnapshot(): Promise<WidgetSnapshot | null> {
  const accounts = await loadAccounts();
  if (!accounts.length) return null;
  const id = await currentAccountId();
  const account = accounts.find((a) => a.id === id) ?? accounts[0];
  const session = account.local ? null : await readSession(account.id);
  const client = new WorkbenchClient(account.server, { session });
  const [summary, tools] = await Promise.all([client.llmSummary(14), client.toolsUsage('month')]);
  return snapshotOf(summary, tools);
}
