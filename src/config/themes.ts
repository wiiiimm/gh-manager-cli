export type ThemeName = 'default' | 'ocean' | 'forest' | 'monochrome';

export interface Theme {
  name: ThemeName;
  label: string;
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  muted: string;
  text: string;
  selected: string;
  /**
   * Background colour for the highlighted/selected row. Deliberately darker
   * than the foreground text so bright selected text stays high-contrast.
   * Hex is used for precise per-theme tones; chalk/Ink downsamples it to the
   * nearest ANSI colour on terminals without truecolour support.
   */
  selectedBg: string;
  private: string;
  archived: string;
  internal: string;
  fork: string;
  dim: string;
}

export const THEMES: Record<ThemeName, Theme> = {
  default: {
    name: 'default',
    label: 'Default',
    primary: 'cyan',
    secondary: 'blue',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    muted: 'gray',
    text: 'white',
    selected: 'cyan',
    selectedBg: '#1f4a57', // dark teal — contrasts the cyan/white selected text
    private: 'yellow',
    archived: 'gray',
    internal: 'magenta',
    fork: 'blue',
    dim: 'gray',
  },
  ocean: {
    name: 'ocean',
    label: 'Ocean',
    primary: 'blueBright',
    secondary: 'cyan',
    success: 'greenBright',
    warning: 'yellowBright',
    error: 'redBright',
    muted: 'blue',
    text: 'whiteBright',
    selected: 'blueBright',
    selectedBg: '#11294d', // deep blue — sits behind the bright blue/white text
    private: 'cyan',
    archived: 'blue',
    internal: 'magenta',
    fork: 'cyanBright',
    dim: 'blue',
  },
  forest: {
    name: 'forest',
    label: 'Forest',
    primary: 'green',
    secondary: 'greenBright',
    success: 'greenBright',
    warning: 'yellow',
    error: 'red',
    muted: 'gray',
    text: 'white',
    selected: 'green',
    selectedBg: '#14391f', // deep forest green behind the green/white text
    private: 'yellow',
    archived: 'gray',
    internal: 'magenta',
    fork: 'greenBright',
    dim: 'gray',
  },
  monochrome: {
    name: 'monochrome',
    label: 'Monochrome',
    primary: 'white',
    secondary: 'whiteBright',
    success: 'whiteBright',
    warning: 'white',
    error: 'white',
    muted: 'gray',
    text: 'white',
    selected: 'whiteBright',
    selectedBg: '#333333', // neutral dark grey — darker than the old bright grey
    private: 'white',
    archived: 'gray',
    internal: 'white',
    fork: 'white',
    dim: 'gray',
  },
};

export const THEME_ORDER: ThemeName[] = ['default', 'ocean', 'forest', 'monochrome'];

export function getTheme(name: ThemeName): Theme {
  return THEMES[name] ?? THEMES.default;
}

export function nextTheme(current: ThemeName): ThemeName {
  const idx = THEME_ORDER.indexOf(current);
  return THEME_ORDER[(idx + 1) % THEME_ORDER.length];
}
