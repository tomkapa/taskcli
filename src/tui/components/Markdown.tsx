import { Text, Box } from 'ink';
import { Marked, type Tokens } from 'marked';
import { markedTerminal } from 'marked-terminal';
import chalk from 'chalk';
import { theme } from '../theme.js';
import { openMermaidInBrowser } from '../mermaid.js';

// Collect mermaid blocks during parse for later rendering
let collectedMermaidBlocks: string[] = [];

const mermaidExtension = {
  renderer: {
    code(token: Tokens.Code): string | false {
      if (token.lang !== 'mermaid') return false;

      collectedMermaidBlocks.push(token.text);
      const index = collectedMermaidBlocks.length;

      const lines = token.text.split('\n');
      const preview = lines.slice(0, 6);
      const maxLen = Math.max(...preview.map((l) => l.length), 30);
      const border = '─'.repeat(maxLen + 2);

      const framed = preview
        .map((l) => `  ${chalk.dim('│')} ${chalk.hex(theme.table.fg)(l)}`)
        .join('\n');
      const truncated =
        lines.length > 6
          ? `\n  ${chalk.dim('│')} ${chalk.dim(`... ${lines.length - 6} more lines`)}`
          : '';

      return [
        '',
        `  ${chalk.hex(theme.title).bold(`┌ Mermaid Diagram #${index}`)}  ${chalk.hex(theme.menu.key)('[press m to open in browser]')}`,
        `  ${chalk.dim(border)}`,
        framed,
        truncated,
        `  ${chalk.dim(border)}`,
        '',
      ].join('\n');
    },
  },
};

const terminalExt = markedTerminal as unknown as (
  opts: Record<string, unknown>,
) => Parameters<Marked['use']>[0];
const marked = new Marked(
  terminalExt({
    showSectionPrefix: false,
    reflowText: true,
    tab: 2,
  }),
  mermaidExtension,
);

interface Props {
  content: string;
}

export function Markdown({ content }: Props) {
  if (!content.trim()) {
    return <Text dimColor>No content</Text>;
  }

  // Reset collected blocks before parsing
  collectedMermaidBlocks = [];

  const rendered = marked.parse(content);
  if (typeof rendered !== 'string') {
    return <Text>{content}</Text>;
  }

  return <Text>{rendered.trimEnd()}</Text>;
}

interface MermaidProps {
  content: string;
}

export function getMermaidBlocks(content: string): string[] {
  collectedMermaidBlocks = [];
  void marked.parse(content);
  return [...collectedMermaidBlocks];
}

export function MermaidHint({ content }: MermaidProps) {
  const blocks = getMermaidBlocks(content);
  if (blocks.length === 0) return null;

  return (
    <Box>
      <Text color={theme.menu.key} bold>
        {'<m>'}{' '}
      </Text>
      <Text dimColor>
        Open {blocks.length} mermaid diagram{blocks.length > 1 ? 's' : ''} in browser
      </Text>
    </Box>
  );
}

export function openAllMermaidDiagrams(content: string): number {
  const blocks = getMermaidBlocks(content);
  for (const block of blocks) {
    openMermaidInBrowser(block);
  }
  return blocks.length;
}
