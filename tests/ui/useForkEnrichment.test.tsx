import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';

vi.mock('../../src/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../src/services/github', () => ({
  makeClient: vi.fn(() => vi.fn()),
  enrichForksWithAheadBehind: vi.fn(),
}));

import { useForkEnrichment } from '../../src/ui/hooks/useForkEnrichment';
import { enrichForksWithAheadBehind } from '../../src/services/github';

const enrichMock = vi.mocked(enrichForksWithAheadBehind);

type Hook = ReturnType<typeof useForkEnrichment>;

function Harness({
  onHook,
  ...props
}: Parameters<typeof useForkEnrichment>[0] & { onHook?: (h: Hook) => void }) {
  const hook = useForkEnrichment(props);
  onHook?.(hook);
  return <Text>{hook.enrichingForks ? 'enriching' : 'idle'}</Text>;
}

const fork = (id: string) => ({
  id,
  isFork: true,
  parent: { nameWithOwner: `up/${id}` },
  defaultBranchRef: { name: 'main' },
}) as any;

const baseProps = {
  client: (() => {}) as any,
  setItems: vi.fn(),
  loading: false,
  loadingMore: false,
  hasNextPage: false,
  forkTracking: true,
};

describe('useForkEnrichment', () => {
  beforeEach(() => {
    enrichMock.mockReset();
    enrichMock.mockImplementation(async (_client: any, batch: any) =>
      batch.map((b: any) => ({ id: b.id, forkHistoryCount: 10, parentHistoryCount: 7 })),
    );
  });

  it('enriches loaded forks and merges ahead/behind counts back into items', async () => {
    const setItems = vi.fn();
    const { unmount } = render(<Harness {...baseProps} items={[fork('f1')]} setItems={setItems} />);

    await vi.waitFor(() => expect(enrichMock).toHaveBeenCalled());
    expect(enrichMock).toHaveBeenCalledWith(expect.anything(), [{ id: 'f1', parentNameWithOwner: 'up/f1' }]);

    await vi.waitFor(() => expect(setItems).toHaveBeenCalled());
    const updater = setItems.mock.calls[0][0] as (prev: any[]) => any[];
    const merged = updater([fork('f1')]);
    expect(merged[0].defaultBranchRef.target.history.totalCount).toBe(10);
    expect(merged[0].parent.defaultBranchRef.target.history.totalCount).toBe(7);
    unmount();
  });

  it('does nothing while the list is still loading', async () => {
    const { unmount } = render(<Harness {...baseProps} items={[fork('f1')]} loading={true} />);
    await new Promise(r => setTimeout(r, 0));
    expect(enrichMock).not.toHaveBeenCalled();
    unmount();
  });

  it('does nothing when fork tracking is disabled', async () => {
    const { unmount } = render(<Harness {...baseProps} items={[fork('f1')]} forkTracking={false} />);
    await new Promise(r => setTimeout(r, 0));
    expect(enrichMock).not.toHaveBeenCalled();
    unmount();
  });

  it('skips forks whose node already carries both history counts (no redundant fetch)', async () => {
    // A fork that already has fork + parent history on its node data must be
    // excluded by the data-level guard, without ever calling the enrichment API.
    const forkWithHistory = {
      id: 'f1',
      isFork: true,
      parent: { nameWithOwner: 'up/f1', defaultBranchRef: { target: { history: { totalCount: 5 } } } },
      defaultBranchRef: { name: 'main', target: { history: { totalCount: 8 } } },
    } as any;
    const { unmount } = render(<Harness {...baseProps} items={[forkWithHistory]} />);
    await new Promise(r => setTimeout(r, 0));
    expect(enrichMock).not.toHaveBeenCalled();
    unmount();
  });

  it('does not re-enrich already-processed forks, but resetEnrichment re-enables them', async () => {
    let latest: Hook | null = null;
    const onHook = (h: Hook) => { latest = h; };
    const { rerender, unmount } = render(
      <Harness {...baseProps} items={[fork('f1')]} onHook={onHook} />,
    );
    await vi.waitFor(() => expect(enrichMock).toHaveBeenCalledTimes(1));

    // Length change re-runs the effect; f1 is already done so only f2 is enriched.
    rerender(<Harness {...baseProps} items={[fork('f1'), fork('f2')]} onHook={onHook} />);
    await vi.waitFor(() => expect(enrichMock).toHaveBeenCalledTimes(2));
    expect(enrichMock.mock.calls[1][1]).toEqual([{ id: 'f2', parentNameWithOwner: 'up/f2' }]);

    // After reset, the tracker is cleared so the next run re-enriches everything.
    latest!.resetEnrichment();
    rerender(<Harness {...baseProps} items={[fork('f1'), fork('f2'), fork('f3')]} onHook={onHook} />);
    await vi.waitFor(() => expect(enrichMock).toHaveBeenCalledTimes(3));
    expect(enrichMock.mock.calls[2][1]).toEqual([
      { id: 'f1', parentNameWithOwner: 'up/f1' },
      { id: 'f2', parentNameWithOwner: 'up/f2' },
      { id: 'f3', parentNameWithOwner: 'up/f3' },
    ]);
    unmount();
  });

  it('exposes enrichingForks: true while a batch is in flight, false once it completes', async () => {
    let resolveBatch!: (v: any) => void;
    enrichMock.mockImplementationOnce(() => new Promise(res => { resolveBatch = res; }));
    const { lastFrame, unmount } = render(<Harness {...baseProps} items={[fork('f1')]} />);

    await vi.waitFor(() => expect(lastFrame()).toBe('enriching'));
    resolveBatch([{ id: 'f1', forkHistoryCount: 1, parentHistoryCount: 1 }]);
    await vi.waitFor(() => expect(lastFrame()).toBe('idle'));
    unmount();
  });

  it('does not merge results from a pass that was torn down mid-flight', async () => {
    let resolveBatch!: (v: any) => void;
    enrichMock.mockImplementationOnce(() => new Promise(res => { resolveBatch = res; }));
    const setItems = vi.fn();
    const { lastFrame, unmount } = render(
      <Harness {...baseProps} items={[fork('f1')]} setItems={setItems} />,
    );

    await vi.waitFor(() => expect(lastFrame()).toBe('enriching'));
    unmount(); // cleanup sets cancelled = true before the batch resolves

    // The batch resolves after teardown — the cancelled pass must not setItems.
    resolveBatch([{ id: 'f1', forkHistoryCount: 1, parentHistoryCount: 1 }]);
    await new Promise(r => setTimeout(r, 0));
    expect(setItems).not.toHaveBeenCalled();
  });
});
