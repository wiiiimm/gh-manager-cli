import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import ArchiveModal from '../../src/ui/components/modals/ArchiveModal';
import type { RepoNode } from '../../src/types';

// Mock the useInput hook to avoid stdin.ref issues
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn()
  };
});

describe('ArchiveModal', () => {
  let mockUseInput: any;
  
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
  };

  beforeEach(async () => {
    const ink = await import('ink');
    mockUseInput = (ink as any).useInput;
    mockUseInput.mockReset();
  });

  it('renders archive confirmation for non-archived repo', () => {
    mockUseInput.mockImplementation(() => {});
    
    const { lastFrame, unmount } = render(
      <ArchiveModal repo={mockRepo} onArchive={async () => {}} onCancel={() => {}} />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Archive Repository');
    expect(output).toContain('user/test-repo');
    expect(output).toContain('This will archive the repository');
    unmount();
  });

  it('renders unarchive confirmation for archived repo', () => {
    mockUseInput.mockImplementation(() => {});
    const archivedRepo = { ...mockRepo, isArchived: true };
    
    const { lastFrame, unmount } = render(
      <ArchiveModal repo={archivedRepo} onArchive={async () => {}} onCancel={() => {}} />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Unarchive Repository');
    expect(output).toContain('This will unarchive the repository');
    unmount();
  });

  it('shows confirm and cancel buttons', () => {
    mockUseInput.mockImplementation(() => {});
    
    const { lastFrame, unmount } = render(
      <ArchiveModal repo={mockRepo} onArchive={async () => {}} onCancel={() => {}} />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Archive');
    expect(output).toContain('Cancel');
    unmount();
  });

  it('calls onCancel when Escape is pressed', () => {
    const onCancel = vi.fn();
    
    mockUseInput.mockImplementation((callback: any) => {
      callback('', { escape: true });
    });
    
    const { unmount } = render(
      <ArchiveModal repo={mockRepo} onArchive={async () => {}} onCancel={onCancel} />
    );

    expect(onCancel).toHaveBeenCalled();
    unmount();
  });

  it('calls onCancel when C is pressed', () => {
    const onCancel = vi.fn();
    
    mockUseInput.mockImplementation((callback: any) => {
      callback('c', {});
    });
    
    const { unmount } = render(
      <ArchiveModal repo={mockRepo} onArchive={async () => {}} onCancel={onCancel} />
    );

    expect(onCancel).toHaveBeenCalled();
    unmount();
  });

  // Note: Interactive tests with keyboard callbacks are complex due to 
  // how useInput hook and component lifecycle interact. These would be
  // better tested with integration or e2e tests.

  it('handles null repo gracefully', () => {
    mockUseInput.mockImplementation(() => {});
    
    const { lastFrame, unmount } = render(
      <ArchiveModal repo={null} onArchive={async () => {}} onCancel={() => {}} />
    );

    // Should still render without crashing
    expect(lastFrame).toBeDefined();
    unmount();
  });

});