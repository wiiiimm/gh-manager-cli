import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import RepoRow from '../../src/ui/components/repo/RepoRow';

const repoStub: any = {
  id: 'R_123',
  nameWithOwner: 'octocat/Hello-World',
  description: 'Just a test repository',
  stargazerCount: 42,
  forkCount: 7,
  isPrivate: false,
  isArchived: false,
  isFork: false,
  primaryLanguage: { name: 'TypeScript', color: '#3178c6' },
  updatedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  pushedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  diskUsage: 123,
};

describe('RepoRow', () => {
  it('renders name and metadata', () => {
    const { lastFrame, unmount } = render(
      <RepoRow
        repo={repoStub}
        selected={false}
        index={1}
        maxWidth={80}
        spacingLines={0}
        forkTracking={true}
      />
    );

    const output = lastFrame() || '';
    expect(output).toContain('octocat/Hello-World');
    expect(output).toMatch(/★\s*42/);
    expect(output).toMatch(/TypeScript/);
    unmount();
  });

  it('does not show a checkbox when multiSelectMode is false', () => {
    const { lastFrame, unmount } = render(
      <RepoRow
        repo={repoStub}
        selected={false}
        index={1}
        maxWidth={80}
        spacingLines={0}
        forkTracking={false}
        multiSelectMode={false}
      />
    );

    const output = lastFrame() || '';
    // Assert the checkbox tokens are absent rather than a bare '[', which also
    // appears in ANSI colour escape sequences (e.g. "[90m") when colour output
    // is enabled.
    expect(output).not.toContain('[ ]');
    expect(output).not.toContain('[✓]');
    expect(output).not.toContain('✓');
    unmount();
  });

  it('shows unchecked checkbox when multiSelectMode is true and not checked', () => {
    const { lastFrame, unmount } = render(
      <RepoRow
        repo={repoStub}
        selected={false}
        index={1}
        maxWidth={80}
        spacingLines={0}
        forkTracking={false}
        multiSelectMode={true}
        isChecked={false}
      />
    );

    const output = lastFrame() || '';
    expect(output).toContain('[ ]');
    expect(output).not.toContain('✓');
    unmount();
  });

  it('shows checked checkbox when multiSelectMode is true and checked', () => {
    const { lastFrame, unmount } = render(
      <RepoRow
        repo={repoStub}
        selected={false}
        index={1}
        maxWidth={80}
        spacingLines={0}
        forkTracking={false}
        multiSelectMode={true}
        isChecked={true}
      />
    );

    const output = lastFrame() || '';
    expect(output).toContain('[✓]');
    unmount();
  });
});

