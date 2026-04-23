import { useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import type { Task } from '../../types/task.js';
import type { TaskId } from '../../types/branded.js';
import { DependencyType, UIDependencyType } from '../../types/enums.js';
import { theme } from '../theme.js';
import { DEP_TYPE_LABEL } from '../constants.js';
import { calcViewStart } from '../viewport.js';

const DEP_TYPE_VALUES = Object.values(UIDependencyType);

const DEP_TYPE_COLOR: Record<string, string> = {
  [DependencyType.Blocks]: theme.status.error,
  [DependencyType.RelatesTo]: theme.status.new,
  [DependencyType.Duplicates]: theme.status.pending,
  [UIDependencyType.BlockedBy]: theme.status.modified,
};

export interface PickedDependency {
  id: TaskId;
  name: string;
  type: string;
}

interface Props {
  tasks: Task[];
  /** Task IDs to exclude from the picker (e.g., the task being edited) */
  excludeIds?: Set<TaskId>;
  initialSelection?: PickedDependency[];
  onConfirm: (selected: PickedDependency[]) => void;
  onCancel: () => void;
}

export function TaskPicker({ tasks, excludeIds, initialSelection, onConfirm, onCancel }: Props) {
  const { stdout } = useStdout();
  const termHeight = stdout.rows > 0 ? stdout.rows : 24;
  const maxVisible = Math.max(3, termHeight - 12);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [selected, setSelected] = useState<Map<TaskId, PickedDependency>>(() => {
    const map = new Map<TaskId, PickedDependency>();
    if (initialSelection) {
      for (const dep of initialSelection) {
        map.set(dep.id, dep);
      }
    }
    return map;
  });

  // Filter tasks by search query and exclusions
  const available = tasks.filter((t) => {
    if (excludeIds?.has(t.id)) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.id.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    );
  });

  const viewStart = calcViewStart(cursorIndex, maxVisible);
  const visible = available.slice(viewStart, viewStart + maxVisible);

  useInput((input, key) => {
    // Search mode
    if (isSearching) {
      if (key.escape) {
        setIsSearching(false);
        return;
      }
      if (key.return) {
        setIsSearching(false);
        setCursorIndex(0);
        return;
      }
      if (key.backspace || key.delete) {
        setSearchQuery((q) => q.slice(0, -1));
        setCursorIndex(0);
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setSearchQuery((q) => q + input);
        setCursorIndex(0);
        return;
      }
      return;
    }

    // Navigation
    if (key.upArrow || input === 'k') {
      setCursorIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (key.downArrow || input === 'j') {
      setCursorIndex((i) => Math.min(available.length - 1, i + 1));
      return;
    }

    // Space: select (with type cycle). First press selects as 'blocks',
    // subsequent presses cycle through: blocks -> relates-to -> duplicates -> deselect.
    if (input === ' ' || input === 't') {
      const task = available[cursorIndex];
      if (!task) return;
      setSelected((prev) => {
        const next = new Map(prev);
        const entry = prev.get(task.id);
        if (!entry) {
          // First select: default to blocks
          next.set(task.id, { id: task.id, name: task.name, type: DependencyType.Blocks });
        } else {
          // Cycle type, then deselect after last type
          const idx = DEP_TYPE_VALUES.indexOf(entry.type as DependencyType);
          if (idx < DEP_TYPE_VALUES.length - 1) {
            const nextType = DEP_TYPE_VALUES[idx + 1] ?? DependencyType.Blocks;
            next.set(task.id, { ...entry, type: nextType });
          } else {
            // Past last type -> deselect
            next.delete(task.id);
          }
        }
        return next;
      });
      return;
    }

    // x: deselect the item under cursor
    if (input === 'x') {
      const task = available[cursorIndex];
      if (!task) return;
      setSelected((prev) => {
        const next = new Map(prev);
        next.delete(task.id);
        return next;
      });
      return;
    }

    // Search
    if (input === '/') {
      setIsSearching(true);
      setSearchQuery('');
      return;
    }

    // Confirm
    if (key.return) {
      onConfirm(Array.from(selected.values()));
      return;
    }

    // Cancel
    if (key.escape || input === 'q') {
      onCancel();
      return;
    }
  });

  return (
    <Box flexDirection="column" borderStyle="bold" borderColor={theme.borderFocus} flexGrow={1}>
      {/* Title */}
      <Box gap={0}>
        <Text color={theme.title} bold>
          {' '}
          select dependencies
        </Text>
        <Text color={theme.titleCounter} bold>
          {' '}
          [{selected.size} selected]
        </Text>
      </Box>

      {/* Search bar */}
      {isSearching ? (
        <Box borderStyle="round" borderColor={theme.prompt} paddingX={1}>
          <Text color={theme.prompt}>/</Text>
          <Text color={theme.prompt}>{searchQuery}</Text>
          <Text color={theme.promptSuggest}>_</Text>
        </Box>
      ) : searchQuery ? (
        <Box paddingX={1}>
          <Text color={theme.titleFilter}>/{searchQuery}</Text>
        </Box>
      ) : null}

      {/* Header */}
      <Box paddingX={1}>
        <Text color={theme.table.headerFg} bold>
          {'  '}
          {'SEL'.padEnd(5)}
          {'ID'.padEnd(14)}
          {'REL TYPE'.padEnd(12)}
          {'STATUS'.padEnd(14)}
          {'NAME'}
        </Text>
      </Box>

      {/* Task rows */}
      {available.length === 0 ? (
        <Box paddingX={2} paddingY={1}>
          <Text dimColor>No tasks match the filter</Text>
        </Box>
      ) : (
        visible.map((task, i) => {
          const actualIndex = viewStart + i;
          const isCursor = actualIndex === cursorIndex;
          const entry = selected.get(task.id);
          const isChecked = !!entry;
          const checkMark = isChecked ? '[x]' : '[ ]';
          const depType = entry ? (DEP_TYPE_LABEL[entry.type] ?? entry.type) : '';
          const depColor = entry ? (DEP_TYPE_COLOR[entry.type] ?? theme.table.fg) : theme.table.fg;

          return (
            <Box key={task.id} paddingX={1}>
              {isCursor ? (
                <Text backgroundColor={theme.table.cursorBg} color={theme.table.cursorFg} bold>
                  {'> '}
                  {checkMark.padEnd(5)}
                  {task.id.padEnd(14)}
                  {depType.padEnd(12)}
                  {task.status.padEnd(14)}
                  {task.name}
                </Text>
              ) : (
                <>
                  <Text>{'  '}</Text>
                  <Text color={isChecked ? theme.status.added : theme.table.fg}>
                    {checkMark.padEnd(5)}
                  </Text>
                  <Text color={theme.yaml.value}>{task.id.padEnd(14)}</Text>
                  <Text color={depColor}>{depType.padEnd(12)}</Text>
                  <Text color={theme.status.completed}>{task.status.padEnd(14)}</Text>
                  <Text color={theme.table.fg}>{task.name}</Text>
                </>
              )}
            </Box>
          );
        })
      )}

      <Box flexGrow={1} />

      {/* Scroll indicator */}
      {available.length > maxVisible && (
        <Box justifyContent="flex-end" paddingRight={1}>
          <Text dimColor>
            [{viewStart + 1}-{Math.min(viewStart + maxVisible, available.length)}/{available.length}
            ]
          </Text>
        </Box>
      )}

      {/* Selected summary */}
      {selected.size > 0 && (
        <Box paddingX={1} flexDirection="column">
          <Text color={theme.table.headerFg} bold>
            Selected:
          </Text>
          <Box>
            <Text>
              {Array.from(selected.values())
                .map((d) => `${d.id} (${DEP_TYPE_LABEL[d.type] ?? d.type})`)
                .join(', ')}
            </Text>
          </Box>
        </Box>
      )}

      {/* Hints */}
      <Box paddingX={1}>
        <Text dimColor>
          space/t: select & cycle type (blocks {'->'} relates-to {'->'} duplicates {'->'} blocked-by{' '}
          {'->'} off) | x: deselect | /: search | enter: confirm | esc: cancel
        </Text>
      </Box>
    </Box>
  );
}
