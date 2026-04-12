import { Box, Text } from 'ink';
import { theme } from '../theme.js';

interface Section {
  title: string;
  keys: [string, string][];
}

const ROW1: Section[] = [
  {
    title: 'NAVIGATION',
    keys: [
      ['j/k', 'Up/Down'],
      ['g/G', 'Top/Bottom'],
      ['PgDn/Up', 'Page'],
      ['tab', 'Next panel'],
      ['S-tab', 'Prev panel'],
      ['enter', 'View/select'],
      ['esc', 'Back'],
    ],
  },
  {
    title: 'ACTIONS',
    keys: [
      ['c', 'Create'],
      ['e', 'Edit'],
      ['d', 'Delete'],
      ['s', 'Status cycle'],
      ['a/A', 'Assign/unassign'],
      ['D', 'Dependencies'],
      ['m', 'Mermaid'],
    ],
  },
  {
    title: 'REORDER',
    keys: [
      ['←', 'Enter reorder'],
      ['↑↓', 'Move item'],
      ['t', 'Jump to top'],
      ['b', 'Jump to bottom'],
      ['→', 'Save position'],
      ['esc/←', 'Cancel'],
    ],
  },
  {
    title: 'FILTER',
    keys: [
      ['/', 'Search'],
      ['f', 'Status filter'],
      ['t', 'Type filter'],
      ['0', 'Clear filters'],
    ],
  },
];

const ROW2: Section[] = [
  {
    title: 'EPIC PANEL',
    keys: [
      ['j/k', 'Navigate'],
      ['space', 'Toggle filter'],
      ['0', 'Clear filter'],
      ['←', 'Reorder epics'],
    ],
  },
  {
    title: 'DEPS VIEW',
    keys: [
      ['a', 'Add blocker'],
      ['x', 'Remove dep'],
      ['enter', 'Go to task'],
      ['esc', 'Back'],
    ],
  },
  {
    title: 'FORMS',
    keys: [
      ['tab', 'Next field'],
      ['shift+tab', 'Prev field'],
      ['ctrl+s', 'Save'],
      ['enter', 'Open editor'],
      ['esc', 'Cancel'],
    ],
  },
  {
    title: 'GENERAL',
    keys: [
      ['p', 'Projects'],
      ['?', 'Help'],
      ['q', 'Quit'],
    ],
  },
];

function SectionRow({ sections }: { sections: Section[] }) {
  return (
    <Box flexDirection="row" gap={4}>
      {sections.map((section) => (
        <Box key={section.title} flexDirection="column">
          <Text color={theme.table.headerFg} bold>
            {section.title}
          </Text>
          {section.keys.map(([key, desc]) => (
            <Box key={key} gap={1}>
              <Text color={theme.menu.key} bold>
                {'<'}
                {key.padEnd(5)}
                {'>'}
              </Text>
              <Text dimColor>{desc}</Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}

export function HelpOverlay() {
  return (
    <Box
      flexDirection="column"
      borderStyle="bold"
      borderColor={theme.borderFocus}
      paddingX={2}
      paddingY={1}
    >
      <Text color={theme.title} bold>
        {' '}
        Help
      </Text>
      <Text> </Text>
      <Box flexDirection="column" gap={1}>
        <SectionRow sections={ROW1} />
        <SectionRow sections={ROW2} />
      </Box>
      <Text> </Text>
      <Text dimColor>Press any key to close</Text>
    </Box>
  );
}
