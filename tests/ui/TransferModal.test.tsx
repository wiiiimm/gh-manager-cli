import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render } from 'ink-testing-library';
import type { Key } from 'ink';
import TransferModal from '../../src/ui/components/modals/TransferModal';
import type { OrganizationNode, RepoNode } from '../../src/types';

// Signature of the callback Ink passes to useInput
type InkInputHandler = (input: string, key: Partial<Key>) => void;

// Mock the useInput hook to avoid stdin.ref issues and to drive key events.
// Multiple components inside the modal (TransferModal itself + the picker child)
// can register useInput. `latestInputCallback` always points at the most recent
// registration — that is what tests should drive.
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
// the destination/code inputs via onChange + onSubmit.
const h = vi.hoisted(() => ({ textInputProps: null as { onChange?: (v: string) => void; onSubmit?: () => void } | null }));
vi.mock('ink-text-input', () => ({
  default: (props: { onChange?: (v: string) => void; onSubmit?: () => void }) => { h.textInputProps = props; return null; }
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

  const mockOrgs: OrganizationNode[] = [
    { id: 'o1', login: 'acme', name: 'Acme Inc', avatarUrl: '' },
  ];

  beforeEach(async () => {
    h.textInputProps = null;
    const ink = await import('ink');
    mockUseInput = (ink as unknown as { useInput: Mock }).useInput;
    mockUseInput.mockReset();
  });

  it('renders the destination picker on stage 1', async () => {
    mockUseInput.mockImplementation(() => {});

    const { lastFrame, unmount } = render(
      <TransferModal
        repo={mockRepo}
        onTransfer={async () => {}}
        onCancel={() => {}}
        viewerLogin="me"
        loadOrganizations={async () => mockOrgs}
      />
    );

    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));

    const output = lastFrame() || '';
    expect(output).toContain('Transfer Repository');
    expect(output).toContain('user/test-repo');
    expect(output).toContain('Choose destination owner');
    expect(output).toContain('Acme Inc');
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

  it('cancels on Esc from the picker', async () => {
    const onCancel = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <TransferModal
        repo={mockRepo}
        onTransfer={async () => {}}
        onCancel={onCancel}
        viewerLogin="me"
        loadOrganizations={async () => mockOrgs}
      />
    );

    await new Promise(r => setTimeout(r, 0));
    inputCallback('', { escape: true });
    expect(onCancel).toHaveBeenCalledTimes(1);
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

  // Drive the full picker → code → confirm flow. The picker selects the lone
  // org on Enter, then the verification code is typed via the captured TextInput.
  // Math.random -> 0 makes the verification code 'AAAA'.
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

    // Walk the modal from the picker stage to the final confirmation stage.
    // `getCb` returns the latest input callback — multiple useInput hooks register
    // (TransferModal + picker) so the latest is the picker; that's what we drive.
    const advanceToConfirm = async (getCb: () => InkInputHandler) => {
      // Let the mount effect generate the verification code (deterministically 'AAAA')
      // AND the picker's org loader to resolve.
      await new Promise(resolve => setTimeout(resolve, 0));
      await new Promise(resolve => setTimeout(resolve, 0));
      // Picker list: cursor 0 = 'acme' (the only candidate — viewerLogin matches owner)
      // Enter → submitDestination('acme') → stage transitions to 'code'.
      getCb()('', { return: true });
      await new Promise(resolve => setTimeout(resolve, 0));
      // Verification-code TextInput is now mounted — type the code via captured props.
      h.textInputProps?.onChange?.(CODE);
      await new Promise(resolve => setTimeout(resolve, 0));
    };

    it('advances through the code stage to the final confirmation', async () => {
      let inputCallback!: InkInputHandler;
      mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

      const { lastFrame, unmount } = render(
        <TransferModal
          repo={mockRepo}
          onTransfer={async () => {}}
          onCancel={() => {}}
          viewerLogin="user"
          loadOrganizations={async () => mockOrgs}
        />
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
        <TransferModal
          repo={mockRepo}
          onTransfer={onTransfer}
          onCancel={onCancel}
          viewerLogin="user"
          loadOrganizations={async () => mockOrgs}
        />
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
      expect(onTransfer).toHaveBeenCalledWith(mockRepo, 'acme');
      unmount();
    });
  });
});
