import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { noticeTone, stateLabel, type NoticeTask } from '../lib/notice';
import { colors, fonts } from '../theme/tokens';

export function NoticeTurn({
  tasks,
  lang = 'en',
  onOpenTask,
  testID = 'wbc-turn-notice',
}: {
  tasks: NoticeTask[];
  lang?: 'en' | 'tr';
  /** A task's number was tapped: its own row in the Team sheet (the web's openTask). */
  onOpenTask?: (id: string) => void;
  testID?: string;
}) {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set());

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const dotColor = (state: string) => {
    const tone = noticeTone(state);
    if (tone === 'danger') return colors.danger;
    if (tone === 'warn') return colors.warn;
    return colors.ok;
  };

  return (
    <View style={s.wrap} testID={testID}>
      {tasks.map((task) => {
        const isOpen = openIds.has(task.id);
        const hasSummary = !!task.summary;
        return (
          <View key={task.id} style={s.taskBlock}>
            <View style={s.lineBtn} testID={`notice-task-${task.id}`}>
              <View style={[s.dot, { backgroundColor: dotColor(task.state) }]} />
              <Text style={s.ink} numberOfLines={1}>
                <Text style={s.brand}>Workbench</Text>
                <Text style={s.dim}> · </Text>
              </Text>
              {/* The number is the way to the task itself: its row in the Team sheet opens on it. */}
              {onOpenTask ? (
                <Pressable
                  onPress={() => onOpenTask(task.id)}
                  accessibilityRole="button"
                  accessibilityHint={task.name}
                  // The number is 10.5 pt of mono: 15 pt of slop above and below make it a 44 pt target.
                  hitSlop={{ top: 15, bottom: 15 }}
                  testID={`notice-task-open-${task.id}`}
                >
                  <Text style={s.mono}>#{task.id} </Text>
                </Pressable>
              ) : (
                <Text style={s.mono}>#{task.id} </Text>
              )}
              <Pressable
                onPress={() => hasSummary && toggle(task.id)}
                disabled={!hasSummary}
                accessibilityRole={hasSummary ? 'button' : undefined}
                accessibilityState={hasSummary ? { expanded: isOpen } : undefined}
                accessibilityLabel={`${task.name} · ${stateLabel(task.state, lang)}`}
                hitSlop={{ top: 15, bottom: 15 }}
                style={s.rest}
                testID={`notice-task-toggle-${task.id}`}
              >
                <Text style={s.lineText} numberOfLines={1} ellipsizeMode="tail">
                  <Text>{task.name}</Text>
                  <Text style={s.dim}> · </Text>
                  <Text>{stateLabel(task.state, lang)}</Text>
                </Text>
              </Pressable>
            </View>
            {isOpen && task.summary ? (
              <Text style={s.summary} selectable testID={`notice-summary-${task.id}`}>
                {task.summary}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    alignItems: 'flex-start',
    marginVertical: 4,
    paddingHorizontal: 8,
    maxWidth: '92%',
  },
  taskBlock: {
    marginVertical: 2,
    alignSelf: 'flex-start',
  },
  lineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    flexShrink: 0,
  },
  ink: {
    flexShrink: 0,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    color: colors.inkDim,
  },
  rest: { flexShrink: 1 },
  lineText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    color: colors.inkDim,
    flexShrink: 1,
  },
  brand: {
    fontFamily: fonts.sansMedium,
    color: colors.inkDim,
  },
  mono: {
    fontFamily: fonts.mono,
  },
  dim: {
    opacity: 0.6,
  },
  summary: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 15,
    color: colors.inkDim,
    paddingLeft: 11,
    paddingTop: 2,
    paddingBottom: 2,
  },
});
