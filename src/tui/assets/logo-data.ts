/**
 * Tayto Strongman - Compact Pixel Logo (7x9 grid)
 *
 * Visual layout:
 *   Row 0:  . . R R R . .   R = red (#C82D28)
 *   Row 1:  . G R D R G .   D = redDark
 *   Row 2:  . G G G G G .   G = grey (#9B9BA5)
 *   Row 3:  . S B S B S .   S = skin (#D7A578)
 *   Row 4:  . S S S S S .   B = black (#19191E)
 *   Row 5:  S S U U U S S   U = blue (#2D4BAA)
 *   Row 6:  . . U d U . .   d = blueDark
 *   Row 7:  . . S . S . .   W = brown (#82502D)
 *   Row 8:  . W W . W W .   . = transparent
 */

export const PALETTE = {
  red: '#C82D28',
  redDark: '#A02320',
  grey: '#9B9BA5',
  greyDark: '#73737D',
  skin: '#D7A578',
  skinDark: '#B9875F',
  blue: '#2D4BAA',
  blueDark: '#1E3782',
  brown: '#82502D',
  brownDark: '#5F371E',
  black: '#19191E',
} as const;

type PixelColor = keyof typeof PALETTE | null;

export const LOGO_WIDTH = 7;
export const LOGO_HEIGHT = 9;

export const LOGO_PIXELS: PixelColor[][] = [
  [null, null, 'red', 'red', 'red', null, null],
  [null, 'grey', 'red', 'redDark', 'red', 'grey', null],
  [null, 'grey', 'grey', 'grey', 'grey', 'grey', null],
  [null, 'skin', 'black', 'skin', 'black', 'skin', null],
  [null, 'skin', 'skin', 'skin', 'skin', 'skin', null],
  ['skin', 'skin', 'blue', 'blue', 'blue', 'skin', 'skin'],
  [null, null, 'blue', 'blueDark', 'blue', null, null],
  [null, null, 'skin', null, 'skin', null, null],
  [null, 'brown', 'brown', null, 'brown', 'brown', null],
];
