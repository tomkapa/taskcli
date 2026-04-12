import { useState, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Project } from '../../types/project.js';
import { theme } from '../theme.js';

interface Props {
  project: Project;
  onSave: (remote: string) => void;
  onUnlink: () => void;
  onDetect: () => string | null;
  onCancel: () => void;
}

export function ProjectLinkForm({ project, onSave, onUnlink, onDetect, onCancel }: Props) {
  const [remoteUrl, setRemoteUrl] = useState(project.gitRemote?.value ?? '');
  const [cursorPos, setCursorPos] = useState(() => (project.gitRemote?.value ?? '').length);
  const cursorRef = useRef(cursorPos);
  cursorRef.current = cursorPos;

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (input === 's' && key.ctrl) {
      const trimmed = remoteUrl.trim();
      if (trimmed) {
        onSave(trimmed);
      }
      return;
    }

    if (input === 'd' && key.ctrl) {
      const detected = onDetect();
      if (detected) {
        setRemoteUrl(detected);
        cursorRef.current = detected.length;
        setCursorPos(detected.length);
      }
      return;
    }

    if (input === 'u' && key.ctrl) {
      if (project.gitRemote) {
        onUnlink();
      }
      return;
    }

    if (key.leftArrow) {
      setCursorPos((p) => Math.max(0, p - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorPos((p) => Math.min(remoteUrl.length, p + 1));
      return;
    }

    if (key.backspace || key.delete) {
      const pos = cursorRef.current;
      if (pos > 0) {
        setRemoteUrl((v) => v.slice(0, pos - 1) + v.slice(pos));
        cursorRef.current = pos - 1;
        setCursorPos(pos - 1);
      }
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      const pos = cursorRef.current;
      setRemoteUrl((v) => v.slice(0, pos) + input + v.slice(pos));
      cursorRef.current = pos + input.length;
      setCursorPos(pos + input.length);
    }
  });

  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="bold" borderColor={theme.borderFocus}>
      <Box gap={0}>
        <Text color={theme.title} bold>
          {' '}
          link git remote
        </Text>
        <Text color={theme.titleCounter} bold>
          {' '}
          [{project.name}]
        </Text>
      </Box>

      <Box flexDirection="column" paddingX={1} paddingY={1}>
        <Box gap={1}>
          <Text color={theme.dialog.label} bold>
            Current:
          </Text>
          <Text
            color={project.gitRemote ? theme.yaml.value : theme.table.fg}
            dimColor={!project.gitRemote}
          >
            {project.gitRemote?.value ?? '(none)'}
          </Text>
        </Box>

        <Box gap={1} marginTop={1}>
          <Text color={theme.dialog.label} bold>
            {'Remote URL: '}
          </Text>
          <Text color={theme.yaml.value}>
            {remoteUrl.slice(0, cursorPos)}
            <Text color={theme.titleHighlight}>_</Text>
            {remoteUrl.slice(cursorPos)}
          </Text>
        </Box>
      </Box>

      <Box flexGrow={1} />

      <Box paddingX={1}>
        <Text dimColor>ctrl+s: save | ctrl+d: detect from cwd | ctrl+u: unlink | esc: cancel</Text>
      </Box>
    </Box>
  );
}
