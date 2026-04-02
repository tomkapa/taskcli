// k9s-inspired color theme
export const theme = {
  // Body
  fg: '#1E90FF', // dodgerblue
  bg: 'black',
  logo: '#FFA500', // orange

  // Table
  table: {
    fg: '#00FFFF', // aqua
    cursorFg: 'black',
    cursorBg: '#00FFFF', // aqua
    headerFg: 'white',
    markColor: '#98FB98', // palegreen
  },

  // Status colors (row-level)
  status: {
    new: '#87CEFA', // lightskyblue
    modified: '#ADFF2F', // greenyellow
    added: '#1E90FF', // dodgerblue
    error: '#FF4500', // orangered
    pending: '#FF8C00', // darkorange
    highlight: '#00FFFF', // aqua
    kill: '#9370DB', // mediumpurple
    completed: '#778899', // lightslategray
  },

  // Frame / borders
  border: '#1E90FF', // dodgerblue
  borderFocus: '#00FFFF', // aqua

  // Title
  title: '#00FFFF', // aqua
  titleHighlight: '#FF00FF', // fuchsia
  titleCounter: '#FFEFD5', // papayawhip
  titleFilter: '#2E8B57', // seagreen

  // Prompt
  prompt: '#5F9EA0', // cadetblue
  promptSuggest: '#1E90FF', // dodgerblue

  // Dialog
  dialog: {
    fg: '#1E90FF', // dodgerblue
    buttonFg: 'black',
    buttonBg: '#1E90FF',
    buttonFocusFg: 'white',
    buttonFocusBg: '#FF00FF', // fuchsia
    label: '#FF00FF', // fuchsia
    field: '#1E90FF',
  },

  // Detail/YAML
  yaml: {
    key: '#4682B4', // steelblue
    colon: 'white',
    value: '#FFEFD5', // papayawhip
  },

  // Crumbs
  crumb: {
    fg: 'black',
    bg: '#4682B4', // steelblue
    activeBg: '#FFA500', // orange
  },

  // Flash
  flash: {
    info: '#FFDEAD', // navajowhite
    warn: '#FFA500', // orange
    error: '#FF4500', // orangered
  },

  // Menu / key hints
  menu: {
    key: '#1E90FF', // dodgerblue
    numKey: '#FF00FF', // fuchsia
    desc: 'white',
  },
} as const;
