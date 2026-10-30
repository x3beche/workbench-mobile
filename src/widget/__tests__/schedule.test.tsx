/**
 * When the widget refreshes by itself, and who asks: Android's own task
 * (`background.ts`), the app coming back to the foreground (`presence.ts`), and
 * the widget's ↻ reaching Android's task handler (`task.tsx`).
 *
 * The refreshes themselves are faked here - `refresh.ts` has its own tests - so
 * what is held is the wiring: which trigger is passed, how often the task is
 * asked to run, and that a tap on the card is not a refresh.
 */
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { AppState, Platform } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

const mockRefresh = jest.fn(async () => ({ outcome: 'ok', snap: null, at: Date.now() }));
jest.mock('../refresh', () => ({
  refreshWidget: (...a: unknown[]) => mockRefresh(...(a as [])),
  loadForTask: jest.fn(async () => null),
  draw: jest.fn(async () => true),
}));

jest.mock('expo-task-manager', () => {
  const defined = new Map<string, (...a: unknown[]) => unknown>();
  return {
    __defined: defined,
    isTaskDefined: (name: string) => defined.has(name),
    defineTask: (name: string, fn: (...a: unknown[]) => unknown) => defined.set(name, fn),
    unregisterTaskAsync: jest.fn(async () => undefined),
  };
});

jest.mock('expo-background-task', () => ({
  BackgroundTaskStatus: { Restricted: 1, Available: 2 },
  BackgroundTaskResult: { Success: 1, Failed: 2 },
  getStatusAsync: jest.fn(async () => 2),
  registerTaskAsync: jest.fn(async () => undefined),
  unregisterTaskAsync: jest.fn(async () => undefined),
}));

jest.mock('react-native-android-widget', () => ({
  requestWidgetUpdate: jest.fn(async () => undefined),
  registerWidgetTaskHandler: jest.fn(),
  FlexWidget: 'FlexWidget',
  TextWidget: 'TextWidget',
  SvgWidget: 'SvgWidget',
}));

jest.mock('../words', () => ({
  widgetWords: async () => ({ t: require('../../lib/settingsStrings').settingsStrings('en'), lang: 'en' }),
}));

jest.mock('../log', () => ({
  writeRefreshLog: jest.fn(async () => undefined),
  settleRefreshLog: jest.fn(async () => undefined),
  readRefreshLog: jest.fn(async () => []),
}));

const defined = (TaskManager as unknown as { __defined: Map<string, () => Promise<unknown>> }).__defined;

// The widget's task is Android's: on the test's own platform (iOS) it defines nothing.
beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
});
afterEach(() => {
  jest.restoreAllMocks();
});

// Imported once the mocks above are in place: jest hoists them over these imports.
import {
  WIDGET_TASK,
  WIDGET_TASK_MINUTES,
  defineWidgetBackgroundTask,
  registerWidgetBackground,
} from '../background';
import { useWidgetOnForeground } from '../presence';
import { widgetTaskHandler } from '../task';

describe('the background task', () => {
  it('is defined once, and its work is a refresh', async () => {
    defineWidgetBackgroundTask();
    defineWidgetBackgroundTask();
    expect(defined.size).toBe(1);
    const run = defined.get(WIDGET_TASK)!;
    const got = await run();
    expect(mockRefresh).toHaveBeenCalledWith('background');
    expect(got).toBe(BackgroundTask.BackgroundTaskResult.Success);
  });

  it('is asked to run every fifteen minutes, Android\'s least', async () => {
    await registerWidgetBackground();
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(WIDGET_TASK, { minimumInterval: WIDGET_TASK_MINUTES });
    expect(WIDGET_TASK_MINUTES).toBe(15);
  });

  it('is not registered where Android holds background work back', async () => {
    (BackgroundTask.getStatusAsync as jest.Mock).mockResolvedValueOnce(BackgroundTask.BackgroundTaskStatus.Restricted);
    (BackgroundTask.registerTaskAsync as jest.Mock).mockClear();
    expect(await registerWidgetBackground()).toBe(false);
    expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
  });

  it('says a failed refresh failed', async () => {
    mockRefresh.mockResolvedValueOnce({ outcome: 'error', snap: null, at: 1 } as never);
    defineWidgetBackgroundTask();
    const got = await defined.get(WIDGET_TASK)!();
    expect(got).toBe(BackgroundTask.BackgroundTaskResult.Failed);
  });
});

describe('the app in the foreground', () => {
  it('refreshes on start and on every return to the app, and only then', async () => {
    const listeners: ((s: string) => void)[] = [];
    const remove = jest.fn();
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((event: string, fn: (s: string) => void) => {
      listeners.push(fn);
      return { remove } as never;
    }) as never);
    const App = () => {
      useWidgetOnForeground();
      return null;
    };
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<App />);
    });
    expect(mockRefresh).toHaveBeenCalledWith('app');
    mockRefresh.mockClear();
    await act(async () => listeners.forEach((fn) => fn('active')));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    mockRefresh.mockClear();
    await act(async () => listeners.forEach((fn) => fn('background')));
    expect(mockRefresh).not.toHaveBeenCalled();
    await act(async () => tree!.unmount());
    expect(remove).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('a tap on the widget', () => {
  it('refreshes only when it is the ↻, and leaves the card\'s own tap alone', async () => {
    const renderWidget = jest.fn();
    mockRefresh.mockClear();
    await widgetTaskHandler({
      widgetAction: 'WIDGET_CLICK',
      widgetInfo: { width: 362, height: 184 } as never,
      renderWidget,
      clickAction: 'REFRESH',
    } as never);
    expect(mockRefresh).toHaveBeenCalledWith('click', { showProgress: true });
    mockRefresh.mockClear();
    await widgetTaskHandler({
      widgetAction: 'WIDGET_CLICK',
      widgetInfo: { width: 362, height: 184 } as never,
      renderWidget,
      clickAction: 'OPEN_APP',
    } as never);
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(renderWidget).not.toHaveBeenCalled();
  });
});
