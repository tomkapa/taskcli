import React from 'react';
import { Box, Text } from 'ink';
import { LOGO_PIXELS, LOGO_WIDTH, LOGO_HEIGHT, PALETTE } from '../assets/logo-data.js';

/**
 * Compact logo using upper half-block characters.
 * Packs 2 pixel rows into 1 terminal row for ~5-line output.
 */
export const Logo = React.memo(function Logo(): React.ReactElement {
  const lines: React.ReactElement[] = [];

  for (let y = 0; y < LOGO_HEIGHT; y += 2) {
    const chars: React.ReactElement[] = [];

    for (let x = 0; x < LOGO_WIDTH; x++) {
      const top = LOGO_PIXELS[y]?.[x] ?? null;
      const bot = LOGO_PIXELS[y + 1]?.[x] ?? null;
      const key = `${y}-${x}`;

      if (top && bot) {
        chars.push(
          <Text key={key} color={PALETTE[top]} backgroundColor={PALETTE[bot]}>
            ▀
          </Text>,
        );
      } else if (top) {
        chars.push(
          <Text key={key} color={PALETTE[top]}>
            ▀
          </Text>,
        );
      } else if (bot) {
        chars.push(
          <Text key={key} color={PALETTE[bot]}>
            ▄
          </Text>,
        );
      } else {
        chars.push(<Text key={key}> </Text>);
      }
    }

    lines.push(<Box key={`row-${y}`}>{chars}</Box>);
  }

  return <Box flexDirection="column">{lines}</Box>;
});
