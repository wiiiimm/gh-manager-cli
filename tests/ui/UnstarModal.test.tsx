import React from 'react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render } from 'ink-testing-library';
import type { Key } from 'ink';
import { UnstarModal } from '../../src/ui/components/modals/UnstarModal';
import type { RepoNode } from '../../src/types';

type InkInputHandler = (input: string, key: Partial<Key>) => void;

vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return { ...actual, useInput: vi.fn() };
});

describe('UnstarModal', () => {
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

  it('renders the unstar confirmation', () => {
    mockUseInput.mockImplementation(() => {});

    const { lastFrame, unmount } = render(
      <UnstarModal visible repo={mockRepo} onConfirm={() => {}} onCancel={() => {}} />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Unstar Repository');
    expect(output).toContain('user/test-repo');
    unmount();
  });

  it('renders nothing when not visible', () => {
    mockUseInput.mockImplementation(() => {});

    const { lastFrame, unmount } = render(
      <UnstarModal visible={false} repo={mockRepo} onConfirm={() => {}} onCancel={() => {}} />
    );

    expect((lastFrame() || '').trim()).toBe('');
    unmount();
  });

  it('calls onConfirm when U is pressed', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <UnstarModal visible repo={mockRepo} onConfirm={onConfirm} onCancel={onCancel} />
    );

    inputCallback('u', {});
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
      <UnstarModal visible repo={mockRepo} onConfirm={onConfirm} onCancel={onCancel} />
    );

    inputCallback('c', {});
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    unmount();
  });

  it('shows the loading state while unstarring', () => {
    mockUseInput.mockImplementation(() => {});

    const { lastFrame, unmount } = render(
      <UnstarModal visible repo={mockRepo} onConfirm={() => {}} onCancel={() => {}} isUnstarring />
    );

    expect(lastFrame() || '').toContain('Unstarring...');
    unmount();
  });

  it('ignores input while unstarring is in progress', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <UnstarModal visible repo={mockRepo} onConfirm={onConfirm} onCancel={onCancel} isUnstarring />
    );

    inputCallback('c', {});
    inputCallback('', { escape: true });
    inputCallback('y', {});
    inputCallback('u', {});
    inputCallback('', { return: true });

    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    unmount();
  });
});
