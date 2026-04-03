import { Box, Text } from 'ink';
import type { Task } from '../../types/task.js';
import { theme } from '../theme.js';
import { STATUS_COLOR } from '../constants.js';

interface Props {
  task: Task;
  blockers: Task[];
  dependents: Task[];
  related: Task[];
  duplicates: Task[];
  selectedIndex: number;
  isAddingDep: boolean;
  addDepInput: string;
}

function TaskRow({
  task,
  globalIndex,
  selectedIndex,
}: {
  task: Task;
  globalIndex: number;
  selectedIndex: number;
}) {
  const isSelected = globalIndex === selectedIndex;
  const statusColor = STATUS_COLOR[task.status] ?? theme.table.fg;
  return (
    <Box key={task.id}>
      {isSelected ? (
        <Text backgroundColor={theme.table.cursorBg} color={theme.table.cursorFg} bold>
          {'> '}
          {task.id.padEnd(12)}
          {task.status.padEnd(14)}
          {task.name}
        </Text>
      ) : (
        <>
          <Text>{'  '}</Text>
          <Text color={theme.yaml.value}>{task.id.padEnd(12)}</Text>
          <Text color={statusColor}>{task.status.padEnd(14)}</Text>
          <Text color={theme.table.fg}>{task.name}</Text>
        </>
      )}
    </Box>
  );
}

export function DependencyList({
  task,
  blockers,
  dependents,
  related,
  duplicates,
  selectedIndex,
  isAddingDep,
  addDepInput,
}: Props) {
  let offset = 0;
  const blockersOffset = offset;
  offset += blockers.length;
  const dependentsOffset = offset;
  offset += dependents.length;
  const relatedOffset = offset;
  offset += related.length;
  const duplicatesOffset = offset;

  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="bold" borderColor={theme.borderFocus}>
      {/* Title */}
      <Box gap={0}>
        <Text color={theme.title} bold>
          {' '}
          dependencies
        </Text>
        <Text color={theme.fg}>(</Text>
        <Text color={theme.titleHighlight} bold>
          {task.name}
        </Text>
        <Text color={theme.fg}>)</Text>
      </Box>

      {/* Blockers section */}
      <Box flexDirection="column" paddingX={1} paddingTop={1}>
        <Text color={theme.table.headerFg} bold>
          BLOCKED BY ({blockers.length})
        </Text>
        {blockers.length === 0 ? (
          <Text dimColor> No blockers</Text>
        ) : (
          blockers.map((t, i) => (
            <TaskRow
              key={t.id}
              task={t}
              globalIndex={blockersOffset + i}
              selectedIndex={selectedIndex}
            />
          ))
        )}
      </Box>

      {/* Dependents section */}
      <Box flexDirection="column" paddingX={1} paddingTop={1}>
        <Text color={theme.table.headerFg} bold>
          BLOCKS ({dependents.length})
        </Text>
        {dependents.length === 0 ? (
          <Text dimColor> No dependents</Text>
        ) : (
          dependents.map((t, i) => (
            <TaskRow
              key={t.id}
              task={t}
              globalIndex={dependentsOffset + i}
              selectedIndex={selectedIndex}
            />
          ))
        )}
      </Box>

      {/* Related section */}
      <Box flexDirection="column" paddingX={1} paddingTop={1}>
        <Text color={theme.table.headerFg} bold>
          RELATES TO ({related.length})
        </Text>
        {related.length === 0 ? (
          <Text dimColor> No related tasks</Text>
        ) : (
          related.map((t, i) => (
            <TaskRow
              key={t.id}
              task={t}
              globalIndex={relatedOffset + i}
              selectedIndex={selectedIndex}
            />
          ))
        )}
      </Box>

      {/* Duplicates section */}
      <Box flexDirection="column" paddingX={1} paddingTop={1}>
        <Text color={theme.table.headerFg} bold>
          DUPLICATES ({duplicates.length})
        </Text>
        {duplicates.length === 0 ? (
          <Text dimColor> No duplicate tasks</Text>
        ) : (
          duplicates.map((t, i) => (
            <TaskRow
              key={t.id}
              task={t}
              globalIndex={duplicatesOffset + i}
              selectedIndex={selectedIndex}
            />
          ))
        )}
      </Box>

      <Box flexGrow={1} />

      {/* Add dependency prompt */}
      {isAddingDep && (
        <Box borderStyle="round" borderColor={theme.prompt} paddingX={1}>
          <Text color={theme.prompt}>depends on (id or id:type): </Text>
          <Text color={theme.prompt}>{addDepInput}</Text>
          <Text color={theme.promptSuggest}>_</Text>
        </Box>
      )}

      {/* Hints */}
      <Box paddingX={1}>
        <Text dimColor>
          a: add dep (id or id:relates-to) | x: remove selected | enter: go to task | esc: back
        </Text>
      </Box>
    </Box>
  );
}
