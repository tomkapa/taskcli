import { PALETTE } from './assets/logo-data.js';

// Color theme derived from the Tayto logo palette.
// Primary chrome: PALETTE.grey (#9B9BA5)
// Accent: PALETTE.red (#C82D28)
// Warm: PALETTE.skin (#D7A578)
// Muted: PALETTE.greyDark (#73737D)
export const theme = {
  fg: PALETTE.grey,
  bg: 'black',
  logo: PALETTE.red,

  table: {
    fg: '#C4C4CF',
    cursorFg: 'black',
    cursorBg: PALETTE.grey,
    headerFg: '#D5D5DF',
    markColor: PALETTE.skin,
    depHighlightBg: PALETTE.blueDark,
    blockedCursorBg: PALETTE.redDark,
  },

  status: {
    new: '#87CEFA',
    modified: '#C4C4CF',
    added: '#4682B4',
    error: PALETTE.red,
    pending: PALETTE.skin,
    highlight: PALETTE.grey,
    kill: '#5A5A64',
    completed: PALETTE.greyDark,
  },

  border: '#5A5A64',
  borderFocus: PALETTE.grey,

  title: PALETTE.grey,
  titleHighlight: PALETTE.red,
  titleCounter: PALETTE.skin,
  titleFilter: PALETTE.greyDark,

  prompt: PALETTE.greyDark,
  promptSuggest: PALETTE.grey,

  dialog: {
    fg: PALETTE.grey,
    buttonFg: 'black',
    buttonBg: PALETTE.grey,
    buttonFocusFg: 'white',
    buttonFocusBg: PALETTE.red,
    label: PALETTE.red,
    field: PALETTE.grey,
  },

  yaml: {
    key: PALETTE.greyDark,
    colon: PALETTE.grey,
    value: '#D5D5DF',
  },

  crumb: {
    fg: 'black',
    bg: '#5A5A64',
    activeBg: PALETTE.grey,
  },

  flash: {
    info: '#C4C4CF',
    warn: PALETTE.skin,
    error: PALETTE.red,
  },

  menu: {
    key: PALETTE.grey,
    numKey: PALETTE.red,
    desc: PALETTE.greyDark,
  },
} as const;
