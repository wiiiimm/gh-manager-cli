import { useMemo } from 'react';
import chalk from 'chalk';
import { type Theme, type ThemeName, getTheme } from '../../config/themes';

export interface ThemeColors {
  primary: chalk.Chalk;
  secondary: chalk.Chalk;
  success: chalk.Chalk;
  warning: chalk.Chalk;
  error: chalk.Chalk;
  muted: chalk.Chalk;
  text: chalk.Chalk;
  selected: chalk.Chalk;
  private: chalk.Chalk;
  archived: chalk.Chalk;
  internal: chalk.Chalk;
  fork: chalk.Chalk;
  dim: chalk.Chalk;
  /** Selected option arrow indicator in modals, e.g. bgPrimary.black(' → ') */
  arrow: chalk.Chalk;
  /** Background+text for confirmed/active button */
  btnPrimary: chalk.Chalk;
  /** Background+text for muted/cancel button */
  btnMuted: chalk.Chalk;
}

export interface UseThemeResult {
  theme: Theme;
  c: ThemeColors;
}

function chalkFor(color: string): chalk.Chalk {
  return (chalk as any)[color] ?? chalk.white;
}

function bgChalkFor(color: string): chalk.Chalk {
  const bgKey = 'bg' + color.charAt(0).toUpperCase() + color.slice(1);
  return (chalk as any)[bgKey] ?? chalk.bgWhite;
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
      btnPrimary: bgChalkFor(theme.primary).black.bold,
      btnMuted: chalk.bgGray.white.bold,
    };
    return { theme, c };
  }, [name]);
}
