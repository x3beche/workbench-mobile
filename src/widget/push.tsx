/**
 * Keeping the home screen widget current while the app is open: the Analytics
 * screen has these two readings anyway, so it hands them to the widget instead of
 * asking the server a second time. Everything else about the refresh - the lock,
 * the throttle, the log, and the drawing - is `refresh.ts`'s, the one door every
 * refresh goes through.
 *
 * Android redraws the widget on its own every thirty minutes afterwards, and
 * `background.ts` asks for one every fifteen; a reading's own time is on the
 * card's head, so a stale one says so.
 */
import type { WorkbenchClient } from '../api/client';
import type { LlmSummary, ToolsUsage } from '../api/types';
import { snapshotOf, type WidgetSnapshot } from './data';
import { refreshWidget } from './refresh';

export async function pushWidget(client: WorkbenchClient, summary: LlmSummary, tools: ToolsUsage): Promise<void> {
  const catalogue = await client.ccTools().then((r) => r.tools).catch(() => null);
  const snap: WidgetSnapshot = snapshotOf(summary, tools, catalogue);
  await refreshWidget('app', { snap });
}
