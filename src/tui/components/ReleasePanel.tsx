import { Box, Text } from 'ink';
import type { Task } from '../../types/task.js';
import { theme } from '../theme.js';
import { STATUS_COLOR } from '../constants.js';

const PAGE_SIZE = 20;

interface Props {
  releases: Task[];
  selectedIndex: number;
  selectedReleaseIds: Set<string>;
  isFocused: boolean;
  isReordering?: boolean;
}

export function ReleasePanel({
  releases,
  selectedIndex,
  selectedReleaseIds,
  isFocused,
  isReordering = false,
}: Props) {
  const filterActive = selectedReleaseIds.size > 0;
  const currentPage = Math.floor(selectedIndex / PAGE_SIZE);
  const viewStart = currentPage * PAGE_SIZE;
  const visibleReleases = releases.slice(viewStart, viewStart + PAGE_SIZE);

  return (
    <Box
      flexDirection="column"
      width={48}
      borderStyle="bold"
      borderColor={isFocused ? theme.borderFocus : theme.border}
    >
      <Box>
        <Text color={theme.title} bold>
          {' '}
          releases
        </Text>
        <Text color={theme.titleCounter} bold>
          [{releases.length}]
        </Text>
        {isReordering && (
          <Text color={theme.flash.warn} bold>
            {' '}
            REORDER
          </Text>
        )}
        {filterActive && <Text color={theme.titleFilter}> *{selectedReleaseIds.size}</Text>}
      </Box>

      <Box flexDirection="column" flexGrow={1} overflowY="hidden">
        {releases.length === 0 ? (
          <Box paddingX={1}>
            <Text dimColor>No releases</Text>
          </Box>
        ) : (
          visibleReleases.map((release, i) => {
            const actualIndex = viewStart + i;
            const isSelected = actualIndex === selectedIndex && isFocused;
            const isChecked = selectedReleaseIds.has(release.id);
            const marker = isChecked ? '[x]' : '[ ]';
            const statusColor = STATUS_COLOR[release.status] ?? theme.table.fg;

            if (isSelected) {
              const cursorBg = isReordering ? theme.flash.warn : theme.table.cursorBg;
              return (
                <Box key={release.id}>
                  <Text backgroundColor={cursorBg} color={theme.table.cursorFg} bold>
                    {isReordering ? '~ ' : ' '}
                    {marker} {release.name}
                  </Text>
                </Box>
              );
            }

            return (
              <Box key={release.id}>
                <Text color={isChecked ? theme.titleHighlight : statusColor}>
                  {' '}
                  {marker} {release.name}
                </Text>
              </Box>
            );
          })
        )}
      </Box>

      {releases.length > PAGE_SIZE && (
        <Box justifyContent="flex-end" paddingRight={1}>
          <Text dimColor>
            [{viewStart + 1}-{Math.min(viewStart + PAGE_SIZE, releases.length)}/{releases.length}]
          </Text>
        </Box>
      )}
    </Box>
  );
}
