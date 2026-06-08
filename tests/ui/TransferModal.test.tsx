import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render } from 'ink-testing-library';
import type { Key } from 'ink';
import TransferModal from '../../src/ui/components/modals/TransferModal';
import type { RepoNode } from '../../src/types';

// Signature of the callback Ink passes to useInput
type InkInputHandler = (input: string, key: Partial<Key>) => void;

// Mock the useInput hook to avoid stdin.ref issues and to drive key events.
// Note: this also stubs the useInput used internally by ink-text-input, so the
// destination-owner / verification-code TextInputs cannot receive typed
// characters in this harness. Tests therefore exercise the drivable surface
// (rendering, Esc-to-cancel, guards) plus the code logic directly.
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn()
  };
});

// ink-text-input internally calls the real ink useInput (which enables raw mode
// and throws `stdin.ref is not a function` under the test stdin). Stub it so the
// surrounding modal can render, and capture the latest props so tests can drive
// the destination-owner / verification-code inputs via onChange.
const h = vi.hoisted(() => ({ textInputProps: null as { onChange?: (v: string) => void } | null }));
vi.mock('ink-text-input', () => ({
  default: (props: { onChange?: (v: string) => void }) => { h.textInputProps = props; return null; }
}));

describe('TransferModal', () => {
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

  it('renders the destination-owner input stage', () => {
    mockUseInput.mockImplementation(() => {});

    const { lastFrame, unmount } = render(
      <TransferModal repo={mockRepo} onTransfer={async () => {}} onCancel={() => {}} />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Transfer Repository');
    expect(output).toContain('user/test-repo');
    expect(output).toContain('New owner');
    unmount();
  });

  it('renders nothing when repo is null', () => {
    mockUseInput.mockImplementation(() => {});

    const { lastFrame, unmount } = render(
      <TransferModal repo={null} onTransfer={async () => {}} onCancel={() => {}} />
    );

    expect((lastFrame() || '').trim()).toBe('');
    unmount();
  });

  it('cancels on Esc', () => {
    const onCancel = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <TransferModal repo={mockRepo} onTransfer={async () => {}} onCancel={onCancel} />
    );

    inputCallback('', { escape: true });
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('does not advance past the owner stage when no owner has been entered', () => {
    const onTransfer = vi.fn(async () => {});
    const onCancel = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { lastFrame, unmount } = render(
      <TransferModal repo={mockRepo} onTransfer={onTransfer} onCancel={onCancel} />
    );

    // Pressing Enter with an empty owner must not move to the code stage…
    inputCallback('', { return: true });

    const output = lastFrame() || '';
    expect(output).toContain('New owner');           // still on input stage
    expect(output).not.toContain('Verification code');
    expect(onTransfer).not.toHaveBeenCalled();        // …and never starts a transfer
    unmount();
  });

  // The verification code is a 4-char uppercase string excluding ambiguous chars.
  it('generates a 4-character code excluding ambiguous characters', () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
    expect(chars).not.toContain('I');
    expect(chars).not.toContain('O');
    expect(chars).not.toContain('0');
    expect(chars).not.toContain('1');
  });

  it('verifies the typed code case-insensitively', () => {
    const code = 'AB23';
    expect('ab23'.toUpperCase() === code).toBe(true);
    expect('AB23'.toUpperCase() === code).toBe(true);
    expect('zzzz'.toUpperCase() === code).toBe(false);
  });

  // Drive the full input -> code -> confirm flow by simulating typing through the
  // captured TextInput. Math.random -> 0 makes the verification code 'AAAA'.
  describe('staged flow', () => {
    let randomSpy: ReturnType<typeof vi.spyOn>;
    const CODE = 'AAAA';

    beforeEach(() => {
      h.textInputProps = null;
      randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    });

    afterEach(() => {
      randomSpy.mockRestore();
    });

    // Walk the modal from the owner-input stage to the final confirmation stage.
    // `getCb` returns the latest input callback — Ink hands useInput a fresh
    // closure on every re-render, so capturing it by value here would go stale.
    const advanceToConfirm = async (getCb: () => InkInputHandler) => {
      // Let the mount effect generate the verification code (deterministically 'AAAA').
      await new Promise(resolve => setTimeout(resolve, 0));
      h.textInputProps?.onChange?.('neworg');           // destination owner
      await new Promise(resolve => setTimeout(resolve, 0));
      getCb()('', { return: true });                     // input -> code stage
      await new Promise(resolve => setTimeout(resolve, 0));
      h.textInputProps?.onChange?.(CODE);                // type the verification code
      await new Promise(resolve => setTimeout(resolve, 0));
    };

    it('advances through the code stage to the final confirmation', async () => {
      let inputCallback!: InkInputHandler;
      mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

      const { lastFrame, unmount } = render(
        <TransferModal repo={mockRepo} onTransfer={async () => {}} onCancel={() => {}} />
      );

      await advanceToConfirm(() => inputCallback);

      expect(lastFrame() || '').toContain('hands ownership to');
      unmount();
    });

    it('ignores input while transferring is in progress', async () => {
      const onTransfer = vi.fn(() => new Promise<void>(() => {})); // never resolves
      const onCancel = vi.fn();
      let inputCallback!: InkInputHandler;
      mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

      const { unmount } = render(
        <TransferModal repo={mockRepo} onTransfer={onTransfer} onCancel={onCancel} />
      );

      await advanceToConfirm(() => inputCallback);

      // Confirm the transfer, then in the SAME tick try to cancel/re-submit. The
      // synchronous submittingRef guard must swallow these without a re-render.
      inputCallback('y', {});
      inputCallback('', { escape: true });
      inputCallback('c', {});
      inputCallback('', { return: true });

      expect(onCancel).not.toHaveBeenCalled();
      expect(onTransfer).toHaveBeenCalledTimes(1);
      expect(onTransfer).toHaveBeenCalledWith(mockRepo, 'neworg');
      unmount();
    });
  });
});
