import { Box, Text } from 'ink';
import type { Task } from '../../types/task.js';
import { theme } from '../theme.js';
import { Markdown, MermaidHint } from './Markdown.js';

interface Props {
  task: Task;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Box gap={0}>
      <Text color={theme.yaml.key} bold>
        {label}
      </Text>
      <Text color={theme.yaml.colon}>: </Text>
      <Text color={theme.yaml.value}>{value}</Text>
    </Box>
  );
}

function hasMermaid(text: string): boolean {
  return /```mermaid/i.test(text);
}

export function TaskDetail({ task }: Props) {
  const allText = `${task.description}\n${task.technicalNotes}\n${task.additionalRequirements}`;
  const showMermaidHint = hasMermaid(allText);

  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="bold" borderColor={theme.borderFocus}>
      {/* Title bar */}
      <Box gap={0}>
        <Text color={theme.title} bold>
          {' '}
          detail
        </Text>
        <Text color={theme.fg}>(</Text>
        <Text color={theme.titleHighlight} bold>
          {task.name}
        </Text>
        <Text color={theme.fg}>)</Text>
      </Box>

      {/* Metadata in YAML style */}
      <Box flexDirection="column" paddingX={1} paddingY={0}>
        <Field label="id" value={task.id} />
        <Field label="type" value={task.type} />
        <Field label="status" value={task.status} />
        <Field label="priority" value={`P${task.priority}`} />
        <Field label="created" value={new Date(task.createdAt).toLocaleString()} />
        <Field label="updated" value={new Date(task.updatedAt).toLocaleString()} />
        {task.parentId && <Field label="parent" value={task.parentId} />}
      </Box>

      {/* Description */}
      <Box flexDirection="column" paddingX={1}>
        <Text color={theme.title} bold>
          --- description ---
        </Text>
        {task.description.trim() ? (
          <Markdown content={task.description} />
        ) : (
          <Text dimColor>No description</Text>
        )}
      </Box>

      {/* Technical Notes */}
      {task.technicalNotes.trim() && (
        <Box flexDirection="column" paddingX={1}>
          <Text color={theme.title} bold>
            --- technical notes ---
          </Text>
          <Markdown content={task.technicalNotes} />
        </Box>
      )}

      {/* Additional Requirements */}
      {task.additionalRequirements.trim() && (
        <Box flexDirection="column" paddingX={1}>
          <Text color={theme.title} bold>
            --- requirements ---
          </Text>
          <Markdown content={task.additionalRequirements} />
        </Box>
      )}

      <Box flexGrow={1} />

      {/* Mermaid diagram hint */}
      {showMermaidHint && (
        <Box paddingX={1}>
          <MermaidHint content={allText} />
        </Box>
      )}
    </Box>
  );
}
