import React from 'react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render } from 'ink-testing-library';
import type { Key } from 'ink';
import SyncModal from '../../src/ui/components/modals/SyncModal';
import type { RepoNode } from '../../src/types';

type InkInputHandler = (input: string, key: Partial<Key>) => void;

// Mock useInput so we can drive key events without touching the real stdin.
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return { ...actual, useInput: vi.fn() };
});

describe('SyncModal', () => {
  let mockUseInput: Mock;

  const mockRepo: RepoNode = {
    id: 'repo-123',
    name: 'test-repo',
    nameWithOwner: 'user/test-repo',
    description: 'Test repository',
    isArchived: false,
    isPrivate: false,
    isFork: true,
    parent: { nameWithOwner: 'upstream/test-repo' },
    stargazerCount: 10,
    forkCount: 5,
    primaryLanguage: { name: 'TypeScript', color: '#3178c6' },
    updatedAt: '2024-01-01T00:00:00Z',
    pushedAt: '2024-01-01T00:00:00Z',
    diskUsage: 1024,
    visibility: 'PUBLIC'
  } as RepoNode;

  beforeEach(async () => {
    const ink = await import('ink');
    mockUseInput = (ink as unknown as { useInput: Mock }).useInput;
    mockUseInput.mockReset();
  });

  it('renders the sync confirmation', () => {
    mockUseInput.mockImplementation(() => {});

    const { lastFrame, unmount } = render(
      <SyncModal repo={mockRepo} onSync={async () => {}} onCancel={() => {}} />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Sync Fork with Upstream');
    expect(output).toContain('user/test-repo');
    unmount();
  });

  it('calls onCancel when C is pressed', () => {
    const onSync = vi.fn(async () => {});
    const onCancel = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <SyncModal repo={mockRepo} onSync={onSync} onCancel={onCancel} />
    );

    inputCallback('c', {});
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSync).not.toHaveBeenCalled();
    unmount();
  });

  it('shows the loading state while syncing', async () => {
    const onSync = vi.fn(() => new Promise<void>(() => {})); // never resolves
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { lastFrame, unmount } = render(
      <SyncModal repo={mockRepo} onSync={onSync} onCancel={() => {}} />
    );

    inputCallback('y', {});
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(lastFrame() || '').toContain('Syncing fork with upstream...');
    unmount();
  });

  it('ignores input while syncing is in progress', async () => {
    const onSync = vi.fn(() => new Promise<void>(() => {})); // never resolves
    const onCancel = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <SyncModal repo={mockRepo} onSync={onSync} onCancel={onCancel} />
    );

    // Trigger the sync, then in the SAME tick try to cancel/re-submit. The
    // synchronous syncingRef guard must swallow these without any re-render.
    inputCallback('y', {});
    inputCallback('c', {});
    inputCallback('', { escape: true });
    inputCallback('y', {});
    inputCallback('', { return: true });

    expect(onCancel).not.toHaveBeenCalled();
    expect(onSync).toHaveBeenCalledTimes(1);
    unmount();
  });
});
