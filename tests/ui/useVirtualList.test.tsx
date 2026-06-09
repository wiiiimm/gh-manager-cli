import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { useVirtualList } from '../../src/ui/hooks/useVirtualList';
import { computeWindow } from '../../src/lib/utils';

type Item = { description?: string | null };

// Harness that drives the hook and records every returned window object so the
// test can assert both the computed value and reference stability (memoisation).
function Harness({
  items,
  cursor,
  listHeight,
  spacingLines,
  sink,
}: {
  items: Item[];
  cursor: number;
  listHeight: number;
  spacingLines: number;
  sink: Array<{ start: number; end: number }>;
}) {
  const windowed = useVirtualList(items, cursor, listHeight, spacingLines);
  sink.push(windowed);
  return <Text>{`${windowed.start}-${windowed.end}`}</Text>;
}

const makeItems = (n: number, withDesc = true): Item[] =>
  Array.from({ length: n }, () => ({ description: withDesc ? 'desc' : null }));

describe('useVirtualList', () => {
  it('delegates to computeWindow (compact mode)', () => {
    const items = makeItems(20);
    const sink: Array<{ start: number; end: number }> = [];
    const { lastFrame, unmount } = render(
      <Harness items={items} cursor={10} listHeight={20} spacingLines={0} sink={sink} />,
    );
    const expected = computeWindow(items, 10, 20, 0);
    expect(sink[sink.length - 1]).toEqual(expected);
    expect(lastFrame()).toBe(`${expected.start}-${expected.end}`);
    unmount();
  });

  it('delegates to computeWindow (cozy mode)', () => {
    const items = makeItems(30);
    const sink: Array<{ start: number; end: number }> = [];
    const { unmount } = render(
      <Harness items={items} cursor={12} listHeight={20} spacingLines={1} sink={sink} />,
    );
    expect(sink[sink.length - 1]).toEqual(computeWindow(items, 12, 20, 1));
    unmount();
  });

  it('handles an empty list', () => {
    const sink: Array<{ start: number; end: number }> = [];
    const { lastFrame, unmount } = render(
      <Harness items={[]} cursor={0} listHeight={20} spacingLines={0} sink={sink} />,
    );
    expect(sink[sink.length - 1]).toEqual({ start: 0, end: 0 });
    expect(lastFrame()).toBe('0-0');
    unmount();
  });

  it('returns a stable reference when inputs are unchanged (memoised)', () => {
    const items = makeItems(20);
    const sink: Array<{ start: number; end: number }> = [];
    const { rerender, unmount } = render(
      <Harness items={items} cursor={5} listHeight={20} spacingLines={0} sink={sink} />,
    );
    const first = sink[sink.length - 1];
    rerender(<Harness items={items} cursor={5} listHeight={20} spacingLines={0} sink={sink} />);
    const second = sink[sink.length - 1];
    expect(second).toBe(first); // same object reference => memo hit
    unmount();
  });

  it('recomputes a new window when the cursor changes', () => {
    const items = makeItems(20);
    const sink: Array<{ start: number; end: number }> = [];
    const { rerender, unmount } = render(
      <Harness items={items} cursor={2} listHeight={20} spacingLines={0} sink={sink} />,
    );
    const first = sink[sink.length - 1];
    rerender(<Harness items={items} cursor={18} listHeight={20} spacingLines={0} sink={sink} />);
    const second = sink[sink.length - 1];
    expect(second).not.toBe(first);
    expect(second).toEqual(computeWindow(items, 18, 20, 0));
    unmount();
  });
});
