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
