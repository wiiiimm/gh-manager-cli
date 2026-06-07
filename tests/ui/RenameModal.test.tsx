import React from 'react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render } from 'ink-testing-library';
import type { Key } from 'ink';
import RenameModal from '../../src/ui/components/modals/RenameModal';
import type { RepoNode } from '../../src/types';

type InkInputHandler = (input: string, key: Partial<Key>) => void;

vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return { ...actual, useInput: vi.fn() };
});

// Capture the name TextInput so the test can simulate typing a new name; the
// real ink-text-input cannot receive characters under this stubbed-input harness.
const h = vi.hoisted(() => ({ textInputProps: null as { onChange?: (v: string) => void } | null }));
vi.mock('ink-text-input', () => ({
  default: (props: { onChange?: (v: string) => void }) => { h.textInputProps = props; return null; }
}));

describe('RenameModal', () => {
  let mockUseInput: Mock;

  const mockRepo: RepoNode = {
    id: 'repo-123',
    name: 'test-repo',
    nameWithOwner: 'user/test-repo',
    description: 'Test repository',
    isArchived: false,
    isPrivate: false,
    isFork: false,
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
    h.textInputProps = null;
  });

  it('renders the rename prompt with the current name', () => {
    mockUseInput.mockImplementation(() => {});

    const { lastFrame, unmount } = render(
      <RenameModal repo={mockRepo} onRename={async () => {}} onCancel={() => {}} />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Rename Repository');
    expect(output).toContain('user/test-repo');
    unmount();
  });

  it('renders nothing when repo is null', () => {
    mockUseInput.mockImplementation(() => {});

    const { lastFrame, unmount } = render(
      <RenameModal repo={null} onRename={async () => {}} onCancel={() => {}} />
    );

    expect((lastFrame() || '').trim()).toBe('');
    unmount();
  });

  it('does not rename when the name is unchanged', () => {
    const onRename = vi.fn(async () => {});
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <RenameModal repo={mockRepo} onRename={onRename} onCancel={() => {}} />
    );

    // Name still equals repo.name -> Enter must be a no-op.
    inputCallback('', { return: true });
    expect(onRename).not.toHaveBeenCalled();
    unmount();
  });

  it('renames with the trimmed new name on Enter', async () => {
    const onRename = vi.fn(() => new Promise<void>(() => {})); // never resolves
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { lastFrame, unmount } = render(
      <RenameModal repo={mockRepo} onRename={onRename} onCancel={() => {}} />
    );

    h.textInputProps?.onChange?.('renamed-repo');
    // Flush so the input closure observes the new name before we submit.
    await new Promise(resolve => setTimeout(resolve, 0));
    inputCallback('', { return: true });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(onRename).toHaveBeenCalledWith(mockRepo, 'renamed-repo');
    expect(lastFrame() || '').toContain('Renaming repository...');
    unmount();
  });

  it('ignores input while renaming is in progress', async () => {
    const onRename = vi.fn(() => new Promise<void>(() => {})); // never resolves
    const onCancel = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <RenameModal repo={mockRepo} onRename={onRename} onCancel={onCancel} />
    );

    // Type a new name (flush so the Enter closure sees it), then submit and, in
    // the SAME tick, try to cancel/re-submit. The synchronous renamingRef guard
    // must swallow these without any further re-render.
    h.textInputProps?.onChange?.('renamed-repo');
    await new Promise(resolve => setTimeout(resolve, 0));
    inputCallback('', { return: true });
    inputCallback('', { escape: true });
    inputCallback('', { return: true });

    expect(onCancel).not.toHaveBeenCalled();
    expect(onRename).toHaveBeenCalledTimes(1);
    unmount();
  });
});
