import { useMemo } from 'react';
import { computeWindow } from '../../lib/utils';

/**
 * Memoised windowing for the repository list (GMC-28).
 *
 * Wraps {@link computeWindow} in a `useMemo` so the visible slice is only
 * recomputed when the inputs actually change. This is a behaviour-preserving
 * extraction of the inline `windowed` memo that previously lived in
 * `RepoList.tsx`; the window still recentres on the cursor on every move.
 *
 * `RepoRow` memoisation (GMC-8) handles per-row re-render cost separately — this
 * hook only governs which rows are mounted.
 *
 * @param items         The list being rendered (only `description` affects row height).
 * @param cursor        Index of the selected row.
 * @param listHeight    Available height (in terminal rows) for the list body.
 * @param spacingLines  Density spacer lines (0 compact, 1 cozy, 2 comfy).
 * @param buffer        Extra rows rendered above/below the window (default 2).
 * @returns The `{ start, end }` slice bounds to render.
 */
export function useVirtualList(
  items: { description?: string | null }[],
  cursor: number,
  listHeight: number,
  spacingLines: number,
  buffer = 2,
): { start: number; end: number } {
  return useMemo(
    () => computeWindow(items, cursor, listHeight, spacingLines, buffer),
    [items, cursor, listHeight, spacingLines, buffer],
  );
}
