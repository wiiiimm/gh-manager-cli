import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';

// Capture useInput callback so we can drive it from tests.
const inputCallbacks: Array<(input: string, key: any) => void> = [];

vi.mock('ink', async () => {
  const actual = await vi.importActual<any>('ink');
  return {
    ...actual,
    useInput: vi.fn((cb: any) => {
      inputCallbacks.push(cb);
    }),
  };
});

import OpenPRsIssuesModal from '../../src/ui/components/modals/OpenPRsIssuesModal';

const repoStub: any = {
  id: 'R_1',
  nameWithOwner: 'octocat/Hello-World',
  description: 'A test repo',
  stargazerCount: 5,
  forkCount: 2,
  openPullRequests: 4,
  openIssues: 11,
  isPrivate: false,
  isArchived: false,
  isFork: false,
  primaryLanguage: { name: 'TypeScript', color: '#3178c6' },
  updatedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  pushedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  diskUsage: 100,
};

const fireKey = (input: string, key: Partial<Record<string, boolean>> = {}) => {
  const cb = inputCallbacks[inputCallbacks.length - 1];
  cb(input, {
    return: false,
    escape: false,
    leftArrow: false,
    rightArrow: false,
    ctrl: false,
    shift: false,
    ...key,
  });
};

describe('OpenPRsIssuesModal (SWR-357)', () => {
  beforeEach(() => {
    inputCallbacks.length = 0;
  });

  it('renders chooser with PR and issue counts in the labels', () => {
    const { lastFrame, unmount } = render(
      <OpenPRsIssuesModal repo={repoStub} onOpen={() => {}} onCancel={() => {}} />
    );
    const output = lastFrame() || '';
    expect(output).toContain('octocat/Hello-World');
    expect(output).toContain('Pull Requests (4)');
    expect(output).toContain('Issues (11)');
    unmount();
  });

  it('omits the counts when the fields are undefined (older cache reads)', () => {
    const repo = { ...repoStub };
    delete (repo as any).openPullRequests;
    delete (repo as any).openIssues;
    const { lastFrame, unmount } = render(
      <OpenPRsIssuesModal repo={repo} onOpen={() => {}} onCancel={() => {}} />
    );
    const output = lastFrame() || '';
    expect(output).toContain('Pull Requests');
    expect(output).toContain('Issues');
    // No parenthesised count when missing
    expect(output).not.toMatch(/Pull Requests\s*\(/);
    expect(output).not.toMatch(/Issues\s*\(/);
    unmount();
  });

  it('Enter on the default (PRs) focus opens the /pulls URL', () => {
    const onOpen = vi.fn();
    const onCancel = vi.fn();
    const { unmount } = render(
      <OpenPRsIssuesModal repo={repoStub} onOpen={onOpen} onCancel={onCancel} />
    );

    fireKey('', { return: true });
    expect(onOpen).toHaveBeenCalledWith('https://github.com/octocat/Hello-World/pulls');
    expect(onCancel).not.toHaveBeenCalled();
    unmount();
  });

  it('right arrow then Enter switches focus to Issues and opens /issues', async () => {
    const onOpen = vi.fn();
    const { unmount } = render(
      <OpenPRsIssuesModal repo={repoStub} onOpen={onOpen} onCancel={() => {}} />
    );

    fireKey('', { rightArrow: true });
    // Flush React's re-render so the next useInput closure sees focus='issues'.
    // The mock pushes the new callback on re-mount; without this flush we'd
    // re-enter the original closure that still reads focus='prs'.
    await new Promise(r => setTimeout(r, 0));
    fireKey('', { return: true });
    expect(onOpen).toHaveBeenCalledWith('https://github.com/octocat/Hello-World/issues');
    unmount();
  });

  it('P shortcut opens /pulls regardless of focus', async () => {
    const onOpen = vi.fn();
    const { unmount } = render(
      <OpenPRsIssuesModal repo={repoStub} onOpen={onOpen} onCancel={() => {}} />
    );
    // Move focus to issues, then press P — should still go to /pulls.
    fireKey('', { rightArrow: true });
    await new Promise(r => setTimeout(r, 0));
    fireKey('p');
    expect(onOpen).toHaveBeenCalledWith('https://github.com/octocat/Hello-World/pulls');
    unmount();
  });

  it('I shortcut opens /issues regardless of focus', () => {
    const onOpen = vi.fn();
    const { unmount } = render(
      <OpenPRsIssuesModal repo={repoStub} onOpen={onOpen} onCancel={() => {}} />
    );
    fireKey('i');
    expect(onOpen).toHaveBeenCalledWith('https://github.com/octocat/Hello-World/issues');
    unmount();
  });

  it('Esc cancels without opening', () => {
    const onOpen = vi.fn();
    const onCancel = vi.fn();
    const { unmount } = render(
      <OpenPRsIssuesModal repo={repoStub} onOpen={onOpen} onCancel={onCancel} />
    );
    fireKey('', { escape: true });
    expect(onCancel).toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
    unmount();
  });

  it('C cancels without opening', () => {
    const onOpen = vi.fn();
    const onCancel = vi.fn();
    const { unmount } = render(
      <OpenPRsIssuesModal repo={repoStub} onOpen={onOpen} onCancel={onCancel} />
    );
    fireKey('c');
    expect(onCancel).toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
    unmount();
  });
});
