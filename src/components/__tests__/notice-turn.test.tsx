import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { NoticeTurn } from '../NoticeTurn';

const canRender = typeof (React as { act?: unknown }).act === 'function';

const singleTask = [
  {
    id: '676936',
    name: 'MOBIL-PANEL-YAMA-1.9.27',
    state: 'answered',
    summary: 'built and signed APK',
  },
];

const multiTasks = [
  {
    id: '196b29',
    name: 'OPENCODE-CTX-LIMIT',
    state: 'answered',
  },
  {
    id: '676936',
    name: 'MOBIL-PANEL-YAMA-1.9.27',
    state: 'answered',
    summary: 'built and signed',
  },
  {
    id: '7196c5',
    name: 'TASK-FAIL',
    state: 'failed',
  },
];

(canRender ? describe : describe.skip)('NoticeTurn component', () => {
  it('draws a single task notification as a small centered line', async () => {
    await render(<NoticeTurn tasks={singleTask} lang="en" />);
    expect(screen.getByText('Workbench')).toBeTruthy();
    expect(screen.getByText('#676936 ')).toBeTruthy();
    expect(screen.getByText('MOBIL-PANEL-YAMA-1.9.27')).toBeTruthy();
    expect(screen.getByText('answered')).toBeTruthy();
    // Summary is closed by default
    expect(screen.queryByTestId('notice-summary-676936')).toBeNull();
  });

  it('draws multiple tasks vertically, one line per task', async () => {
    await render(<NoticeTurn tasks={multiTasks} lang="en" />);
    expect(screen.getByText('#196b29 ')).toBeTruthy();
    expect(screen.getByText('OPENCODE-CTX-LIMIT')).toBeTruthy();
    expect(screen.getByText('#676936 ')).toBeTruthy();
    expect(screen.getByText('#7196c5 ')).toBeTruthy();
  });

  it('toggles summary open and closed on tap', async () => {
    await render(<NoticeTurn tasks={singleTask} lang="en" />);
    expect(screen.queryByTestId('notice-summary-676936')).toBeNull();
    await fireEvent.press(screen.getByTestId('notice-task-676936'));
    expect(screen.getByTestId('notice-summary-676936')).toHaveTextContent('built and signed APK');
    await fireEvent.press(screen.getByTestId('notice-task-676936'));
    expect(screen.queryByTestId('notice-summary-676936')).toBeNull();
  });

  it('translates state into Turkish when lang is tr', async () => {
    await render(<NoticeTurn tasks={singleTask} lang="tr" />);
    expect(screen.getByText('cevaplandı')).toBeTruthy();
  });
});
