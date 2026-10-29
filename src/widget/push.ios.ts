/**
 * iOS has no home screen widget here (a WidgetKit one is a separate target):
 * the readings the Analytics screen loads stay on the screen.
 */
import type { LlmSummary, ToolsUsage } from '../api/types';

export async function pushWidget(_summary: LlmSummary, _tools: ToolsUsage): Promise<void> {}
