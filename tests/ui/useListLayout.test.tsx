import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { useListLayout } from '../../src/ui/hooks/useListLayout';
import { computeListLayout, type ListLayout } from '../../src/lib/utils';

// Harness that drives the hook and records every returned layout so the test
// can assert both the computed value and reference stability (memoisation).
function Harness({
  columns,
  maxVisibleRows,
  filterMode,
  multiSelectMode,
  sink,
}: {
  columns?: number;
  maxVisibleRows?: number;
  filterMode: boolean;
  multiSelectMode: boolean;
  sink: ListLayout[];
}) {
  const layout = useListLayout(columns, maxVisibleRows, filterMode, multiSelectMode);
  sink.push(layout);
  return <Text>{`${layout.terminalWidth}x${layout.listHeight}`}</Text>;
}

describe('useListLayout', () => {
  it('delegates to computeListLayout', () => {
    const sink: ListLayout[] = [];
    const { lastFrame, unmount } = render(
      <Harness columns={120} maxVisibleRows={40} filterMode={false} multiSelectMode={false} sink={sink} />,
    );
    const expected = computeListLayout({ columns: 120, maxVisibleRows: 40, filterMode: false, multiSelectMode: false });
    expect(sink[sink.length - 1]).toEqual(expected);
    expect(lastFrame()).toBe(`${expected.terminalWidth}x${expected.listHeight}`);
    unmount();
  });

  it('returns a stable reference when inputs are unchanged (memoised)', () => {
    const sink: ListLayout[] = [];
    const { rerender, unmount } = render(
      <Harness columns={100} maxVisibleRows={30} filterMode={false} multiSelectMode={false} sink={sink} />,
    );
    const first = sink[sink.length - 1];
    rerender(<Harness columns={100} maxVisibleRows={30} filterMode={false} multiSelectMode={false} sink={sink} />);
    expect(sink[sink.length - 1]).toBe(first); // same object reference => memo hit
    unmount();
  });

  it('recomputes when filterMode toggles', () => {
    const sink: ListLayout[] = [];
    const { rerender, unmount } = render(
      <Harness columns={100} maxVisibleRows={30} filterMode={false} multiSelectMode={false} sink={sink} />,
    );
    const before = sink[sink.length - 1];
    rerender(<Harness columns={100} maxVisibleRows={30} filterMode={true} multiSelectMode={false} sink={sink} />);
    const after = sink[sink.length - 1];
    expect(after).not.toBe(before);
    expect(after.listHeight).toBe(before.listHeight - 2);
  });
});
