/**
 * The web build has no home screen widget: the readings the Analytics screen
 * loads stay on the screen.
 */
import type { WorkbenchClient } from '../api/client';
import type { LlmSummary, ToolsUsage } from '../api/types';

export async function pushWidget(
  _client: WorkbenchClient,
  _summary: LlmSummary,
  _tools: ToolsUsage,
): Promise<void> {}
