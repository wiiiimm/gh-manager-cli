import { useMemo } from 'react';
import { computeListLayout, type ListLayout } from '../../lib/utils';

/**
 * Memoised layout dimensions for the repository list view (GMC-28).
 *
 * Wraps {@link computeListLayout} in a `useMemo` so the derived heights are
 * only recomputed when an input changes. Behaviour-preserving extraction of the
 * inline `terminalWidth` / `availableHeight` / `contentHeight` / `listHeight`
 * math that previously lived in `RepoList.tsx`.
 *
 * @param columns          Terminal width (`stdout.columns`); 80 when unknown.
 * @param maxVisibleRows   View height passed from the host; 20 when unknown.
 * @param filterMode       Whether the filter input bar is shown (reserves 2 lines).
 * @param multiSelectMode  Whether the bulk-select bar is shown (reserves 2 lines).
 * @param footerCollapsed  Whether the help footer is the one-line form (GMC-50).
 */
export function useListLayout(
  columns: number | undefined,
  maxVisibleRows: number | undefined,
  filterMode: boolean,
  multiSelectMode: boolean,
  footerCollapsed: boolean = false,
): ListLayout {
  return useMemo(
    () => computeListLayout({ columns, maxVisibleRows, filterMode, multiSelectMode, footerCollapsed }),
    [columns, maxVisibleRows, filterMode, multiSelectMode, footerCollapsed],
  );
}
