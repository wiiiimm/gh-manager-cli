import React from 'react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render } from 'ink-testing-library';
import type { Key } from 'ink';
import { ChangeVisibilityModal } from '../../src/ui/components/modals/ChangeVisibilityModal';

type InkInputHandler = (input: string, key: Partial<Key>) => void;

vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return { ...actual, useInput: vi.fn() };
});

// Capture the last-rendered TextInput props so we can drive its onSubmit (the
// modal's only Enter handler) directly. The real ink-text-input enables raw
// mode and throws under the test stdin, so it must be stubbed regardless.
const h = vi.hoisted(() => ({ textInputProps: null as { onSubmit?: () => void } | null }));
vi.mock('ink-text-input', () => ({
  default: (props: { onSubmit?: () => void }) => { h.textInputProps = props; return null; }
}));

describe('ChangeVisibilityModal', () => {
  let mockUseInput: Mock;

  beforeEach(async () => {
    const ink = await import('ink');
    mockUseInput = (ink as unknown as { useInput: Mock }).useInput;
    mockUseInput.mockReset();
    h.textInputProps = null;
  });

  const baseProps = {
    isOpen: true,
    repoName: 'user/test-repo',
    currentVisibility: 'PUBLIC',
    onVisibilityChange: () => {},
    onClose: () => {}
  };

  it('renders the visibility change prompt with the target option', () => {
    mockUseInput.mockImplementation(() => {});

    const { lastFrame, unmount } = render(<ChangeVisibilityModal {...baseProps} />);

    const output = lastFrame() || '';
    expect(output).toContain('Change Repository Visibility');
    expect(output).toContain('user/test-repo');
    expect(output).toContain('Private'); // PUBLIC -> PRIVATE is the only non-enterprise option
    unmount();
  });

  it('blocks visibility changes for forks', () => {
    mockUseInput.mockImplementation(() => {});

    const { lastFrame, unmount } = render(<ChangeVisibilityModal {...baseProps} isFork />);

    const output = lastFrame() || '';
    expect(output).toContain('Visibility Change Not Available');
    expect(output).toContain('Cannot change visibility of forked repositories');
    unmount();
  });

  it('shows the loading state while changing', () => {
    mockUseInput.mockImplementation(() => {});

    const { lastFrame, unmount } = render(<ChangeVisibilityModal {...baseProps} changing />);

    expect(lastFrame() || '').toContain('Changing visibility...');
    unmount();
  });

  it('ignores input while the change is in progress', () => {
    const onVisibilityChange = vi.fn();
    const onClose = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <ChangeVisibilityModal
        {...baseProps}
        onVisibilityChange={onVisibilityChange}
        onClose={onClose}
        changing
      />
    );

    // Neither the useInput keys nor the TextInput's Enter handler may fire.
    inputCallback('c', {});
    inputCallback('', { escape: true });
    inputCallback('y', {});
    h.textInputProps?.onSubmit?.();

    expect(onClose).not.toHaveBeenCalled();
    expect(onVisibilityChange).not.toHaveBeenCalled();
    unmount();
  });
});
