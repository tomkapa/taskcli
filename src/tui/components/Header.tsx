import { Box, Text } from 'ink';
import type { AppState } from '../types.js';
import { theme } from '../theme.js';
import { Logo } from './Logo.js';

interface KeyHint {
  key: string;
  desc: string;
}

function getKeyHints(view: string, isSearchActive: boolean, focusedPanel: string): KeyHint[] {
  if (isSearchActive) {
    return [
      { key: 'enter', desc: 'apply' },
      { key: 'esc', desc: 'cancel' },
    ];
  }
  if (view === 'task-list' && focusedPanel === 'epic') {
    return [
      { key: 'j/k', desc: 'nav' },
      { key: 'space', desc: 'toggle' },
      { key: '\u2190', desc: 'reorder' },
      { key: '0', desc: 'clear' },
      { key: 'tab', desc: 'tasks' },
      { key: '?', desc: 'help' },
      { key: 'q', desc: 'quit' },
    ];
  }
  if (view === 'task-list') {
    return [
      { key: 'enter', desc: 'view' },
      { key: 'c', desc: 'create' },
      { key: 'e', desc: 'edit' },
      { key: 'd', desc: 'del' },
      { key: 's', desc: 'status' },
      { key: 'a', desc: 'assign' },
      { key: 'A', desc: 'unassign' },
      { key: '\u2190', desc: 'reorder' },
      { key: '/', desc: 'search' },
      { key: 'p', desc: 'project' },
      { key: 'f', desc: 'status-f' },
      { key: 't', desc: 'type-f' },
      { key: 'PgDn/Up', desc: 'page' },
      { key: 'tab', desc: 'panel' },
      { key: '?', desc: 'help' },
      { key: 'q', desc: 'quit' },
    ];
  }
  if (view === 'task-detail') {
    return [
      { key: 'e', desc: 'edit' },
      { key: 's', desc: 'status' },
      { key: 'd', desc: 'del' },
      { key: 'm', desc: 'mermaid' },
      { key: 'esc', desc: 'back' },
      { key: '?', desc: 'help' },
      { key: 'q', desc: 'quit' },
    ];
  }
  return [
    { key: 'esc', desc: 'back' },
    { key: '?', desc: 'help' },
    { key: 'q', desc: 'quit' },
  ];
}

/** Split hints into N roughly-equal columns for compact layout. */
function chunkHints(hints: KeyHint[], cols: number): KeyHint[][] {
  const perCol = Math.ceil(hints.length / cols);
  const result: KeyHint[][] = [];
  for (let i = 0; i < hints.length; i += perCol) {
    result.push(hints.slice(i, i + perCol));
  }
  return result;
}

interface Props {
  state: AppState;
}

export function Header({ state }: Props) {
  const projectName = state.activeProject?.name ?? 'none';
  const taskCount = state.tasks.length;
  const hints = getKeyHints(state.activeView, state.isSearchActive, state.focusedPanel);

  const hintCols = hints.length <= 7 ? 2 : hints.length <= 12 ? 3 : 4;
  const columns = chunkHints(hints, hintCols);

  return (
    <Box flexDirection="row" gap={1}>
      <Box flexShrink={0}>
        <Logo />
      </Box>

      <Box flexDirection="column" justifyContent="center" flexShrink={0} paddingLeft={1}>
        <Text color={theme.logo} bold>
          tayto
        </Text>
        <Box gap={1}>
          <Text color={theme.fg}>Project:</Text>
          <Text color={theme.titleCounter} bold>
            {projectName}
          </Text>
        </Box>
        <Box gap={1}>
          <Text color={theme.fg}>Tasks:</Text>
          <Text color={theme.titleCounter} bold>
            {taskCount}
          </Text>
        </Box>
      </Box>

      <Box flexGrow={1} justifyContent="flex-end">
        <Box flexDirection="row" gap={2}>
          {columns.map((col, ci) => (
            <Box key={ci} flexDirection="column">
              {col.map((h) => (
                <Box key={h.key}>
                  <Text color={theme.menu.key} bold>
                    &lt;{h.key}&gt;
                  </Text>
                  <Text color={theme.menu.desc}>{h.desc}</Text>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
