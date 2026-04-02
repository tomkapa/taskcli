import { Box, Text } from 'ink';
import type { Task } from '../../types/task.js';
import { theme } from '../theme.js';

interface Props {
  task: Task;
}

export function ConfirmDialog({ task }: Props) {
  return (
    <Box
      flexDirection="column"
      borderStyle="bold"
      borderColor={theme.status.error}
      paddingX={3}
      paddingY={1}
      alignSelf="center"
    >
      <Text color={theme.dialog.label} bold>
        {'<Delete>'}
      </Text>
      <Text> </Text>
      <Text color={theme.dialog.fg}>Delete task &quot;{task.name}&quot;?</Text>
      <Text> </Text>
      <Box gap={3}>
        <Box>
          <Text
            backgroundColor={theme.dialog.buttonFocusBg}
            color={theme.dialog.buttonFocusFg}
            bold
          >
            {' y: OK '}
          </Text>
        </Box>
        <Box>
          <Text backgroundColor={theme.dialog.buttonBg} color={theme.dialog.buttonFg}>
            {' n: Cancel '}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
