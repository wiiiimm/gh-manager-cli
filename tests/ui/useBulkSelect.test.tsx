import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { useBulkSelect } from '../../src/ui/hooks/useBulkSelect';

type Hook = ReturnType<typeof useBulkSelect>;

// Capture the latest hook value on every render via onHook.
function Harness({ onHook }: { onHook: (h: Hook) => void }) {
  const h = useBulkSelect();
  onHook(h);
  return <Text>{`${h.multiSelectMode ? 'on' : 'off'}:${h.selectedRepos.size}`}</Text>;
}

const repo = (id: string) => ({ id, nameWithOwner: `o/${id}` }) as any;
const flush = () => new Promise(r => setTimeout(r, 0));

describe('useBulkSelect', () => {
  it('starts inactive with an empty selection', () => {
    let h!: Hook;
    const { lastFrame, unmount } = render(<Harness onHook={x => { h = x; }} />);
    expect(h.multiSelectMode).toBe(false);
    expect(h.selectedRepos.size).toBe(0);
    expect(lastFrame()).toBe('off:0');
    unmount();
  });

  it('toggles a repo in then out of the selection by id', async () => {
    let h!: Hook;
    const { unmount } = render(<Harness onHook={x => { h = x; }} />);

    h.toggleRepoSelection(repo('a'));
    await flush();
    expect(h.selectedRepos.has('a')).toBe(true);
    expect(h.selectedRepos.size).toBe(1);

    h.toggleRepoSelection(repo('a'));
    await flush();
    expect(h.selectedRepos.has('a')).toBe(false);
    expect(h.selectedRepos.size).toBe(0);
    unmount();
  });

  it('enters mode and, by default, exit clears the selection', async () => {
    let h!: Hook;
    const { unmount } = render(<Harness onHook={x => { h = x; }} />);

    h.enterMultiSelectMode();
    h.toggleRepoSelection(repo('a'));
    h.toggleRepoSelection(repo('b'));
    await flush();
    expect(h.multiSelectMode).toBe(true);
    expect(h.selectedRepos.size).toBe(2);

    h.exitMultiSelectMode();
    await flush();
    expect(h.multiSelectMode).toBe(false);
    expect(h.selectedRepos.size).toBe(0);
    unmount();
  });

  it('exitMultiSelectMode(false) leaves the selection intact', async () => {
    let h!: Hook;
    const { unmount } = render(<Harness onHook={x => { h = x; }} />);

    h.enterMultiSelectMode();
    h.toggleRepoSelection(repo('a'));
    await flush();

    h.exitMultiSelectMode(false);
    await flush();
    expect(h.multiSelectMode).toBe(false);
    expect(h.selectedRepos.has('a')).toBe(true);
    expect(h.selectedRepos.size).toBe(1);
    unmount();
  });

  it('stores full nodes (not just ids) so selections survive list changes', async () => {
    let h!: Hook;
    const { unmount } = render(<Harness onHook={x => { h = x; }} />);
    h.toggleRepoSelection(repo('a'));
    await flush();
    expect(h.selectedRepos.get('a')).toEqual({ id: 'a', nameWithOwner: 'o/a' });
    unmount();
  });
});
