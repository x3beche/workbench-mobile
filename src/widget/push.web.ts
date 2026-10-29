/**
 * The web build has no home screen widget: the readings the Analytics screen
 * loads stay on the screen.
 */
import type { LlmSummary, ToolsUsage } from '../api/types';

export async function pushWidget(_summary: LlmSummary, _tools: ToolsUsage): Promise<void> {}
