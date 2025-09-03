import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import CopyUrlModal from '../../src/ui/components/modals/CopyUrlModal';
import type { RepoNode } from '../../src/types';

// Mock the useInput hook to avoid stdin.ref issues
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn()
  };
});

describe('CopyUrlModal', () => {
  let mockUseInput: any;
  
  const mockRepo: RepoNode = {
    id: 'test-id',
    name: 'test-repo',
    nameWithOwner: 'owner/test-repo',
    description: 'Test repository',
    isPrivate: false,
    isFork: false,
    isArchived: false,
    stargazerCount: 10,
    forkCount: 5,
    visibility: 'PUBLIC',
    updatedAt: '2023-01-01T00:00:00Z',
    pushedAt: '2023-01-01T00:00:00Z',
    diskUsage: 1000,
    primaryLanguage: { name: 'TypeScript', color: '#3178c6' },
    defaultBranchRef: null,
    parent: null
  };

  const defaultProps = {
    repo: mockRepo,
    terminalWidth: 80,
    onClose: vi.fn(),
    onCopy: vi.fn()
  };

  beforeEach(async () => {
    // Reset and get the mocked useInput using dynamic import
    const ink = await import('ink');
    mockUseInput = (ink as any).useInput;
    mockUseInput.mockReset();
  });

  it('renders modal with repository name and URLs', () => {
    mockUseInput.mockImplementation(() => {}); // No-op for basic render test
    
    const { lastFrame, unmount } = render(<CopyUrlModal {...defaultProps} />);
    
    const output = lastFrame() || '';
    expect(output).toContain('Copy Repository URL');
    expect(output).toContain('owner/test-repo');
    expect(output).toContain('SSH URL:');
    expect(output).toContain('git@github.com:owner/test-repo.git');
    expect(output).toContain('HTTPS URL:');
    expect(output).toContain('https://github.com/owner/test-repo.git');
    unmount();
  });

  it('shows SSH as selected by default with visual indicators', () => {
    mockUseInput.mockImplementation(() => {});
    
    const { lastFrame, unmount } = render(<CopyUrlModal {...defaultProps} />);
    
    const output = lastFrame() || '';
    expect(output).toContain('▶ git@github.com:owner/test-repo.git');
    expect(output).toContain('  https://github.com/owner/test-repo.git');
    expect(output).toContain('Enter/Y to copy SSH');
    unmount();
  });

  it('shows correct instructions in footer', () => {
    mockUseInput.mockImplementation(() => {});
    
    const { lastFrame, unmount } = render(<CopyUrlModal {...defaultProps} />);
    
    const output = lastFrame() || '';
    expect(output).toContain('↑↓ Select');
    expect(output).toContain('Enter/Y to copy SSH');
    expect(output).toContain('S copy SSH');
    expect(output).toContain('H copy HTTPS');
    expect(output).toContain('Esc/Q/C to close');
    unmount();
  });

  it('handles Enter key to copy selected option (SSH by default)', () => {
    const mockOnCopy = vi.fn().mockResolvedValue(undefined);
    let inputCallback: any;
    
    mockUseInput.mockImplementation((callback: any) => {
      inputCallback = callback;
    });
    
    const { unmount } = render(<CopyUrlModal {...defaultProps} onCopy={mockOnCopy} />);
    
    // Simulate Enter key (SSH should be selected by default)
    inputCallback('', { return: true });
    
    expect(mockOnCopy).toHaveBeenCalledWith('git@github.com:owner/test-repo.git', 'SSH');
    unmount();
  });

  it('handles S key to copy SSH URL', () => {
    const mockOnCopy = vi.fn().mockResolvedValue(undefined);
    let inputCallback: any;
    
    mockUseInput.mockImplementation((callback: any) => {
      inputCallback = callback;
    });
    
    const { unmount } = render(<CopyUrlModal {...defaultProps} onCopy={mockOnCopy} />);
    
    // Simulate 's' key
    inputCallback('s', {});
    
    expect(mockOnCopy).toHaveBeenCalledWith('git@github.com:owner/test-repo.git', 'SSH');
    unmount();
  });

  it('handles H key to copy HTTPS URL', () => {
    const mockOnCopy = vi.fn().mockResolvedValue(undefined);
    let inputCallback: any;
    
    mockUseInput.mockImplementation((callback: any) => {
      inputCallback = callback;
    });
    
    const { unmount } = render(<CopyUrlModal {...defaultProps} onCopy={mockOnCopy} />);
    
    // Simulate 'h' key
    inputCallback('h', {});
    
    expect(mockOnCopy).toHaveBeenCalledWith('https://github.com/owner/test-repo.git', 'HTTPS');
    unmount();
  });

  it('handles copy failure and shows error message', async () => {
    const mockOnCopy = vi.fn().mockRejectedValue(new Error('copy failed'));
    const mockOnClose = vi.fn();
    let inputCallback: any;
    
    mockUseInput.mockImplementation((callback: any) => {
      inputCallback = callback;
    });
    
    const { lastFrame, unmount } = render(
      <CopyUrlModal {...defaultProps} onCopy={mockOnCopy} onClose={mockOnClose} />
    );
    
    // Simulate 'h' key to attempt HTTPS copy
    inputCallback('h', {});
    
    // Wait for async error handling
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Should show error message in the UI
    const output = lastFrame() || '';
    expect(output).toContain('Failed to copy HTTPS URL: copy failed');
    
    // Modal should remain open (onClose not called)
    expect(mockOnClose).not.toHaveBeenCalled();
    
    unmount();
  });

  it('handles up arrow to select SSH', () => {
    let inputCallback: any;
    
    mockUseInput.mockImplementation((callback: any) => {
      inputCallback = callback;
    });
    
    const { lastFrame, rerender, unmount } = render(<CopyUrlModal {...defaultProps} />);
    
    // Simulate up arrow
    inputCallback('', { upArrow: true });
    rerender(<CopyUrlModal {...defaultProps} />);
    
    expect(lastFrame()).toContain('Enter/Y to copy SSH');
    unmount();
  });

  it('handles down arrow to select HTTPS', () => {
    let inputCallback: any;
    
    mockUseInput.mockImplementation((callback: any) => {
      inputCallback = callback;
    });
    
    const { lastFrame, rerender, unmount } = render(<CopyUrlModal {...defaultProps} />);
    
    // Simulate down arrow
    inputCallback('', { downArrow: true });
    rerender(<CopyUrlModal {...defaultProps} />);
    
    expect(lastFrame()).toContain('Enter/Y to copy HTTPS');
    unmount();
  });

  it('handles Escape key to close modal', () => {
    const mockOnClose = vi.fn();
    
    mockUseInput.mockImplementation((callback: any) => {
      // Simulate pressing Escape
      callback('', { escape: true });
    });
    
    const { unmount } = render(<CopyUrlModal {...defaultProps} onClose={mockOnClose} />);
    
    expect(mockOnClose).toHaveBeenCalled();
    unmount();
  });

  it('handles Q key to close modal', () => {
    const mockOnClose = vi.fn();
    
    mockUseInput.mockImplementation((callback: any) => {
      // Simulate pressing 'q'
      callback('q', {});
    });
    
    const { unmount } = render(<CopyUrlModal {...defaultProps} onClose={mockOnClose} />);
    
    expect(mockOnClose).toHaveBeenCalled();
    unmount();
  });

  it('handles C key to close modal', () => {
    const mockOnClose = vi.fn();
    
    mockUseInput.mockImplementation((callback: any) => {
      // Simulate pressing 'c'
      callback('c', {});
    });
    
    const { unmount } = render(<CopyUrlModal {...defaultProps} onClose={mockOnClose} />);
    
    expect(mockOnClose).toHaveBeenCalled();
    unmount();
  });

  it('shows "No repository selected" when repo is null', () => {
    mockUseInput.mockImplementation(() => {});
    
    const { lastFrame, unmount } = render(<CopyUrlModal {...defaultProps} repo={null} />);
    
    expect(lastFrame()).toContain('No repository selected.');
    unmount();
  });

  it('generates correct SSH and HTTPS URLs', () => {
    mockUseInput.mockImplementation(() => {});
    
    const { lastFrame, unmount } = render(<CopyUrlModal {...defaultProps} />);
    
    const output = lastFrame() || '';
    expect(output).toContain('git@github.com:owner/test-repo.git');
    expect(output).toContain('https://github.com/owner/test-repo.git');
    unmount();
  });

  it('switches selection when arrow keys are pressed', () => {
    let callbackRef: any;
    mockUseInput.mockImplementation((callback: any) => {
      callbackRef = callback;
    });
    
    const { lastFrame, rerender, unmount } = render(<CopyUrlModal {...defaultProps} />);

    // Initial state - SSH is selected
    expect(lastFrame()).toContain('Enter/Y to copy SSH');
    
    // Simulate pressing down arrow to switch to HTTPS
    callbackRef('', { downArrow: true });
    rerender(<CopyUrlModal {...defaultProps} />);
    expect(lastFrame()).toContain('Enter/Y to copy HTTPS');
    
    // Simulate pressing up arrow to switch back to SSH
    callbackRef('', { upArrow: true });
    rerender(<CopyUrlModal {...defaultProps} />);
    expect(lastFrame()).toContain('Enter/Y to copy SSH');
    
    unmount();
  });

  it('calls correct copy handler for Enter based on selection state', async () => {
    const mockOnCopy = vi.fn().mockResolvedValue(undefined);
    let cb: any;
    mockUseInput.mockImplementation((fn: any) => { cb = fn; });
    const { unmount } = render(<CopyUrlModal {...defaultProps} onCopy={mockOnCopy} />);

    // Default selection = SSH
    cb('', { return: true });
    expect(mockOnCopy).toHaveBeenCalledWith('git@github.com:owner/test-repo.git', 'SSH');

    // Switch selection to HTTPS, await re-render, then Enter
    cb('', { downArrow: true });
    await new Promise(r => setTimeout(r, 0));
    cb('', { return: true });
    expect(mockOnCopy).toHaveBeenCalledWith('https://github.com/owner/test-repo.git', 'HTTPS');
    unmount();
  });

  it('handles left arrow navigation with wrap-around', () => {
    let callbackRef: any;
    mockUseInput.mockImplementation((callback: any) => {
      callbackRef = callback;
    });
    
    const { lastFrame, rerender, unmount } = render(<CopyUrlModal {...defaultProps} />);

    // Initial state - SSH is selected
    expect(lastFrame()).toContain('Enter/Y to copy SSH');
    
    // Simulate pressing left arrow - should wrap to HTTPS (last option)
    callbackRef('', { leftArrow: true });
    rerender(<CopyUrlModal {...defaultProps} />);
    expect(lastFrame()).toContain('Enter/Y to copy HTTPS');
    
    // Simulate pressing left arrow again - should wrap back to SSH
    callbackRef('', { leftArrow: true });
    rerender(<CopyUrlModal {...defaultProps} />);
    expect(lastFrame()).toContain('Enter/Y to copy SSH');
    
    unmount();
  });

  it('handles right arrow navigation with wrap-around', () => {
    let callbackRef: any;
    mockUseInput.mockImplementation((callback: any) => {
      callbackRef = callback;
    });
    
    const { lastFrame, rerender, unmount } = render(<CopyUrlModal {...defaultProps} />);

    // Initial state - SSH is selected
    expect(lastFrame()).toContain('Enter/Y to copy SSH');
    
    // Simulate pressing right arrow - should move to HTTPS
    callbackRef('', { rightArrow: true });
    rerender(<CopyUrlModal {...defaultProps} />);
    expect(lastFrame()).toContain('Enter/Y to copy HTTPS');
    
    // Simulate pressing right arrow again - should wrap back to SSH
    callbackRef('', { rightArrow: true });
    rerender(<CopyUrlModal {...defaultProps} />);
    expect(lastFrame()).toContain('Enter/Y to copy SSH');
    
    unmount();
  });

  it('handles Y key to copy selected option (lowercase)', () => {
    const mockOnCopy = vi.fn().mockResolvedValue(undefined);
    let inputCallback: any;
    
    mockUseInput.mockImplementation((callback: any) => {
      inputCallback = callback;
    });
    
    const { unmount } = render(<CopyUrlModal {...defaultProps} onCopy={mockOnCopy} />);
    
    // Simulate 'y' key (SSH should be selected by default)
    inputCallback('y', {});
    
    expect(mockOnCopy).toHaveBeenCalledWith('git@github.com:owner/test-repo.git', 'SSH');
    unmount();
  });

  it('handles Y key to copy selected option (uppercase)', () => {
    const mockOnCopy = vi.fn().mockResolvedValue(undefined);
    let inputCallback: any;
    
    mockUseInput.mockImplementation((callback: any) => {
      inputCallback = callback;
    });
    
    const { unmount } = render(<CopyUrlModal {...defaultProps} onCopy={mockOnCopy} />);
    
    // Simulate 'Y' key (SSH should be selected by default)
    inputCallback('Y', {});
    
    expect(mockOnCopy).toHaveBeenCalledWith('git@github.com:owner/test-repo.git', 'SSH');
    unmount();
  });

  it('shows updated footer instructions with new navigation options', () => {
    mockUseInput.mockImplementation(() => {});
    
    const { lastFrame, unmount } = render(<CopyUrlModal {...defaultProps} />);
    
    const output = lastFrame() || '';
    expect(output).toContain('↑↓ Select');
    expect(output).toContain('Enter/Y to copy SSH');
    expect(output).toContain('S copy SSH');
    expect(output).toContain('H copy HTTPS');
    expect(output).toContain('Esc/Q/C to close');
    unmount();
  });
});