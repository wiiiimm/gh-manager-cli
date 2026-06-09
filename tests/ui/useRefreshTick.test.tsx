import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { useRefreshTick } from '../../src/ui/hooks/useRefreshTick';

function Harness({ sink }: { sink: number[] }) {
  const tick = useRefreshTick();
  sink.push(tick);
  return <Text>{String(tick)}</Text>;
}

describe('useRefreshTick', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('initialises to the current whole-minute bucket', () => {
    vi.setSystemTime(new Date('2026-06-09T00:05:30Z'));
    const expected = Math.floor(Date.parse('2026-06-09T00:05:30Z') / 60_000);
    const { lastFrame, unmount } = render(<Harness sink={[]} />);
    expect(lastFrame()).toBe(String(expected));
    unmount();
  });

  it('advances to the next bucket once a minute boundary is crossed', async () => {
    vi.setSystemTime(new Date('2026-06-09T00:00:00Z'));
    const sink: number[] = [];
    const { unmount } = render(<Harness sink={sink} />);
    const start = sink[sink.length - 1];

    // Two 30s polls within the same minute → no change.
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.advanceTimersByTimeAsync(29_000);
    expect(sink[sink.length - 1]).toBe(start);

    // Cross the minute boundary → tick increments by 1.
    await vi.advanceTimersByTimeAsync(31_000);
    expect(sink[sink.length - 1]).toBe(start + 1);
    unmount();
  });

  it('clears its interval on unmount', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = render(<Harness sink={[]} />);
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
