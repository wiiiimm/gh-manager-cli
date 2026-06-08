import React from 'react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render } from 'ink-testing-library';
import type { Key } from 'ink';
import { StarModal } from '../../src/ui/components/modals/StarModal';
import type { RepoNode } from '../../src/types';

type InkInputHandler = (input: string, key: Partial<Key>) => void;

vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return { ...actual, useInput: vi.fn() };
});

describe('StarModal', () => {
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
  });

  it('renders the star confirmation', () => {
    mockUseInput.mockImplementation(() => {});

    const { lastFrame, unmount } = render(
      <StarModal visible repo={mockRepo} isStarred={false} onConfirm={() => {}} onCancel={() => {}} />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Star Repository');
    expect(output).toContain('user/test-repo');
    unmount();
  });

  it('calls onConfirm when S is pressed', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <StarModal visible repo={mockRepo} isStarred={false} onConfirm={onConfirm} onCancel={onCancel} />
    );

    inputCallback('s', {});
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    unmount();
  });

  it('calls onCancel when C is pressed', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <StarModal visible repo={mockRepo} isStarred={false} onConfirm={onConfirm} onCancel={onCancel} />
    );

    inputCallback('c', {});
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    unmount();
  });

  it('shows the loading state while starring', () => {
    mockUseInput.mockImplementation(() => {});

    const { lastFrame, unmount } = render(
      <StarModal visible repo={mockRepo} isStarred={false} onConfirm={() => {}} onCancel={() => {}} isStarring />
    );

    expect(lastFrame() || '').toContain('Starring...');
    unmount();
  });

  it('ignores input while starring is in progress', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    // `isStarring` is owned by the parent, so we can render the in-flight state
    // directly — no trigger/flush dance required.
    const { unmount } = render(
      <StarModal visible repo={mockRepo} isStarred={false} onConfirm={onConfirm} onCancel={onCancel} isStarring />
    );

    inputCallback('c', {});
    inputCallback('', { escape: true });
    inputCallback('y', {});
    inputCallback('s', {});
    inputCallback('', { return: true });

    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    unmount();
  });
});
