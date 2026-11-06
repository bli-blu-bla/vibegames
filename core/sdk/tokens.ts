/** Farb-Tokens aus design/tokens.json (ein Test prüft, dass die Liste vollständig ist). */
export const COLOR_TOKENS = [
  'surface-100',
  'surface-200',
  'surface-300',
  'line',
  'line-strong',
  'ink',
  'ink-muted',
  'accent',
  'on-accent',
  'highlight',
  'danger',
  'game-sky',
  'game-rose',
  'game-sand',
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];
