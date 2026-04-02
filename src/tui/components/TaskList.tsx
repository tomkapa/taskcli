import { Box, Text, useStdout } from 'ink';
import type { Task } from '../../types/task.js';
import { theme } from '../theme.js';
import type { TaskFilter } from '../../types/task.js';
import type { SortState } from '../types.js';

interface Props {
  tasks: Task[];
  selectedIndex: number;
  searchQuery: string;
  isSearchActive: boolean;
  filter: TaskFilter;
  sort: SortState;
  activeProjectName: string;
}

const STATUS_COLOR: Record<string, string> = {
  backlog: theme.status.completed,
  todo: theme.status.new,
  'in-progress': theme.status.pending,
  review: theme.status.modified,
  done: theme.status.added,
  cancelled: theme.status.kill,
};

const TYPE_COLOR: Record<string, string> = {
  story: theme.status.highlight,
  'tech-debt': theme.status.pending,
  bug: theme.status.error,
};

const PRIORITY_COLOR: Record<number, string> = {
  1: theme.status.error,
  2: theme.status.pending,
  3: theme.status.new,
  4: theme.status.completed,
  5: theme.status.completed,
};

// Fixed column widths
const COL = {
  pri: 6,
  type: 12,
  status: 14,
};

const STATUS_ORDER: Record<string, number> = {
  backlog: 0,
  todo: 1,
  'in-progress': 2,
  review: 3,
  done: 4,
  cancelled: 5,
};

function sortTasks(tasks: Task[], sort: SortState): Task[] {
  const sorted = [...tasks];
  const dir = sort.direction === 'asc' ? 1 : -1;
  sorted.sort((a, b) => {
    switch (sort.column) {
      case 'priority':
        return (a.priority - b.priority) * dir;
      case 'status':
        return ((STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0)) * dir;
      case 'type':
        return a.type.localeCompare(b.type) * dir;
      case 'name':
        return a.name.localeCompare(b.name) * dir;
    }
  });
  return sorted;
}

function sortIndicator(column: string, sort: SortState): string {
  if (sort.column !== column) return '';
  return sort.direction === 'asc' ? ' ▲' : ' ▼';
}

export function TaskList({
  tasks,
  selectedIndex,
  searchQuery,
  isSearchActive,
  filter,
  sort,
  activeProjectName,
}: Props) {
  const { stdout } = useStdout();
  const termHeight = stdout.rows > 0 ? stdout.rows : 24;
  const overhead = 8;
  const visibleRows = Math.max(1, termHeight - overhead);

  const sortedTasks = sortTasks(tasks, sort);

  let viewStart = 0;
  if (selectedIndex >= viewStart + visibleRows) {
    viewStart = selectedIndex - visibleRows + 1;
  }
  if (selectedIndex < viewStart) {
    viewStart = selectedIndex;
  }

  const visibleTasks = sortedTasks.slice(viewStart, viewStart + visibleRows);

  // Title bar filters
  const filterParts: string[] = [];
  if (filter.status) filterParts.push(`status:${filter.status}`);
  if (filter.type) filterParts.push(`type:${filter.type}`);
  if (filter.priority) filterParts.push(`P${filter.priority}`);
  if (filter.search) filterParts.push(filter.search);
  const filterText = filterParts.length > 0 ? filterParts.join(' ') : '';

  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="bold" borderColor={theme.borderFocus}>
      {/* Title bar */}
      <Box>
        <Text color={theme.title} bold>
          {' '}
          tasks
        </Text>
        <Text color={theme.fg}>(</Text>
        <Text color={theme.titleHighlight} bold>
          {activeProjectName}
        </Text>
        <Text color={theme.fg}>)</Text>
        <Text color={theme.titleCounter} bold>
          [{sortedTasks.length}]
        </Text>
        <Text dimColor>
          {' '}
          sort:{sort.column}
          {sort.direction === 'asc' ? '▲' : '▼'}
        </Text>
        {filterText && <Text color={theme.titleFilter}> /{filterText}</Text>}
      </Box>

      {/* Search prompt */}
      {isSearchActive && (
        <Box borderStyle="round" borderColor={theme.prompt} paddingX={1}>
          <Text color={theme.prompt}>/</Text>
          <Text color={theme.prompt}>{searchQuery}</Text>
          <Text color={theme.promptSuggest}>_</Text>
        </Box>
      )}

      {/* Table header - sortable columns shown with indicator */}
      <Box>
        <Text color={theme.table.headerFg} bold>
          {'  '}
        </Text>
        <Text color={sort.column === 'priority' ? theme.borderFocus : theme.table.headerFg} bold>
          {('PRI' + sortIndicator('priority', sort)).padEnd(COL.pri)}
        </Text>
        <Text color={sort.column === 'type' ? theme.borderFocus : theme.table.headerFg} bold>
          {('TYPE' + sortIndicator('type', sort)).padEnd(COL.type)}
        </Text>
        <Text color={sort.column === 'status' ? theme.borderFocus : theme.table.headerFg} bold>
          {('STATUS' + sortIndicator('status', sort)).padEnd(COL.status)}
        </Text>
        <Text color={sort.column === 'name' ? theme.borderFocus : theme.table.headerFg} bold>
          {'NAME' + sortIndicator('name', sort)}
        </Text>
      </Box>

      {/* Task rows */}
      {sortedTasks.length === 0 ? (
        <Box paddingX={2} paddingY={1}>
          <Text color={theme.fg}>No tasks found. Press &apos;c&apos; to create one.</Text>
        </Box>
      ) : (
        visibleTasks.map((task, i) => {
          const actualIndex = viewStart + i;
          const isSelected = actualIndex === selectedIndex;
          const rowColor = STATUS_COLOR[task.status] ?? theme.table.fg;

          return (
            <Box key={task.id}>
              {isSelected ? (
                <Text backgroundColor={theme.table.cursorBg} color={theme.table.cursorFg} bold>
                  {'> '}
                  {`P${task.priority}`.padEnd(COL.pri)}
                  {task.type.padEnd(COL.type)}
                  {task.status.padEnd(COL.status)}
                  {task.name}
                </Text>
              ) : (
                <>
                  <Text>{'  '}</Text>
                  <Text color={PRIORITY_COLOR[task.priority] ?? rowColor} bold={task.priority <= 2}>
                    {`P${task.priority}`.padEnd(COL.pri)}
                  </Text>
                  <Text color={TYPE_COLOR[task.type] ?? rowColor}>
                    {task.type.padEnd(COL.type)}
                  </Text>
                  <Text color={STATUS_COLOR[task.status] ?? rowColor}>
                    {task.status.padEnd(COL.status)}
                  </Text>
                  <Text color={rowColor}>{task.name}</Text>
                </>
              )}
            </Box>
          );
        })
      )}

      <Box flexGrow={1} />

      {/* Scroll indicator */}
      {sortedTasks.length > visibleRows && (
        <Box justifyContent="flex-end" paddingRight={1}>
          <Text dimColor>
            [{viewStart + 1}-{Math.min(viewStart + visibleRows, sortedTasks.length)}/
            {sortedTasks.length}]
          </Text>
        </Box>
      )}
    </Box>
  );
}
