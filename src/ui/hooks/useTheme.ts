import { useMemo } from 'react';
import chalk, { type ChalkInstance } from 'chalk';
import { type Theme, type ThemeName, getTheme } from '../../config/themes';

export interface ThemeColors {
  primary: ChalkInstance;
  secondary: ChalkInstance;
  success: ChalkInstance;
  warning: ChalkInstance;
  error: ChalkInstance;
  muted: ChalkInstance;
  text: ChalkInstance;
  selected: ChalkInstance;
  private: ChalkInstance;
  archived: ChalkInstance;
  internal: ChalkInstance;
  fork: ChalkInstance;
  dim: ChalkInstance;
  /** Selected option arrow indicator in modals, e.g. bgPrimary.black(' → ') */
  arrow: ChalkInstance;
  /** Neutral arrow indicator for the focused cancel/muted option in modals */
  arrowMuted: ChalkInstance;
  /** Background+text for confirmed/active button */
  btnPrimary: ChalkInstance;
  /** Background+text for muted/cancel button */
  btnMuted: ChalkInstance;
}

export interface UseThemeResult {
  theme: Theme;
  c: ThemeColors;
}

function chalkFor(color: string): ChalkInstance {
  return (chalk as unknown as Record<string, ChalkInstance | undefined>)[color] ?? chalk.white;
}

function bgChalkFor(color: string): ChalkInstance {
  const bgKey = 'bg' + color.charAt(0).toUpperCase() + color.slice(1);
  return (chalk as unknown as Record<string, ChalkInstance | undefined>)[bgKey] ?? chalk.bgWhite;
}

export function useTheme(name: ThemeName): UseThemeResult {
  return useMemo(() => {
    const theme = getTheme(name);
    const c: ThemeColors = {
      primary: chalkFor(theme.primary),
      secondary: chalkFor(theme.secondary),
      success: chalkFor(theme.success),
      warning: chalkFor(theme.warning),
      error: chalkFor(theme.error),
      muted: chalkFor(theme.muted),
      text: chalkFor(theme.text),
      selected: chalkFor(theme.selected),
      private: chalkFor(theme.private),
      archived: chalkFor(theme.archived),
      internal: chalkFor(theme.internal),
      fork: chalkFor(theme.fork),
      dim: chalkFor(theme.dim),
      arrow: bgChalkFor(theme.primary).black,
      arrowMuted: bgChalkFor(theme.muted).whiteBright,
      btnPrimary: bgChalkFor(theme.primary).black.bold,
      btnMuted: chalk.bgGray.white.bold,
    };
    return { theme, c };
  }, [name]);
}
