import { Box, Text } from 'ink';
import type { FlashLevel } from '../types.js';
import { theme } from '../theme.js';

interface Props {
  message: string;
  level: FlashLevel;
}

const LEVEL_COLOR: Record<FlashLevel, string> = {
  info: theme.flash.info,
  warn: theme.flash.warn,
  error: theme.flash.error,
};

export function FlashMessage({ message, level }: Props) {
  return (
    <Box justifyContent="center" width="100%">
      <Text color={LEVEL_COLOR[level]} bold={level === 'error'}>
        {message}
      </Text>
    </Box>
  );
}
