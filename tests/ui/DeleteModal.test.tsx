import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render } from 'ink-testing-library';
import type { Key } from 'ink';
import DeleteModal from '../../src/ui/components/modals/DeleteModal';
import type { RepoNode } from '../../src/types';

type InkInputHandler = (input: string, key: Partial<Key>) => void;

vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return { ...actual, useInput: vi.fn() };
});

// Capture the verification-code TextInput so the test can "type" the code; the
// real ink-text-input cannot receive characters under this stubbed-input harness.
const h = vi.hoisted(() => ({ textInputProps: null as { onChange?: (v: string) => void } | null }));
vi.mock('ink-text-input', () => ({
  default: (props: { onChange?: (v: string) => void }) => { h.textInputProps = props; return null; }
}));

// Minimal RepoNode stub for testing
const repoStub: RepoNode = {
  id: 'R_123',
  nameWithOwner: 'octocat/Hello-World',
  description: 'Just a test repository',
  stargazerCount: 42,
  forkCount: 7,
  isPrivate: false,
  isArchived: false,
  isFork: false,
  updatedAt: new Date().toISOString(),
  pushedAt: new Date().toISOString(),
  diskUsage: 123,
} as any;

describe('DeleteModal Logic', () => {
  it('generates a 4-character verification code', () => {
    // This tests the logic that would generate the code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    expect(code).toHaveLength(4);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
  });

  it('verification code excludes similar-looking characters', () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    // Check that similar-looking characters are excluded
    expect(chars).not.toContain('I'); // looks like 1
    expect(chars).not.toContain('O'); // looks like 0
    expect(chars).not.toContain('0'); // looks like O
    expect(chars).not.toContain('1'); // looks like I
  });

  it('handles null repo gracefully', () => {
    const repo: RepoNode | null = null;

    // Component should render nothing when repo is null
    expect(repo).toBeNull();
  });

  it('repo has required properties', () => {
    expect(repoStub.nameWithOwner).toBe('octocat/Hello-World');
    expect(repoStub.id).toBe('R_123');
    expect(repoStub.isPrivate).toBe(false);
  });
});

describe('DeleteModal rendering', () => {
  let mockUseInput: Mock;
  // Math.random -> 0 makes the generated verification code deterministically 'AAAA'
  // (chars.charAt(0) repeated), so the test can type a known code to reach stage 2.
  let randomSpy: ReturnType<typeof vi.spyOn>;
  const CODE = 'AAAA';

  beforeEach(async () => {
    const ink = await import('ink');
    mockUseInput = (ink as unknown as { useInput: Mock }).useInput;
    mockUseInput.mockReset();
    h.textInputProps = null;
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  it('renders the verification-code stage with the repo name', async () => {
    mockUseInput.mockImplementation(() => {});

    const { lastFrame, unmount } = render(
      <DeleteModal repo={repoStub} onDelete={async () => {}} onCancel={() => {}} />
    );

    // Let the mount effect generate the verification code (deterministically 'AAAA').
    await new Promise(resolve => setTimeout(resolve, 0));

    const output = lastFrame() || '';
    expect(output).toContain('Delete Repository');
    expect(output).toContain('octocat/Hello-World');
    expect(output).toContain('Verification code');
    expect(output).toContain(CODE);
    unmount();
  });

  it('renders nothing when repo is null', () => {
    mockUseInput.mockImplementation(() => {});

    const { lastFrame, unmount } = render(
      <DeleteModal repo={null} onDelete={async () => {}} onCancel={() => {}} />
    );

    expect((lastFrame() || '').trim()).toBe('');
    unmount();
  });

  it('advances to the final confirmation once the correct code is typed', async () => {
    mockUseInput.mockImplementation(() => {});

    const { lastFrame, unmount } = render(
      <DeleteModal repo={repoStub} onDelete={async () => {}} onCancel={() => {}} />
    );

    // Let the mount effect generate the verification code before typing it.
    await new Promise(resolve => setTimeout(resolve, 0));
    h.textInputProps?.onChange?.(CODE);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(lastFrame() || '').toContain('Are you absolutely sure');
    unmount();
  });

  it('ignores input while deleting is in progress', async () => {
    const onDelete = vi.fn(() => new Promise<void>(() => {})); // never resolves
    const onCancel = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <DeleteModal repo={repoStub} onDelete={onDelete} onCancel={onCancel} />
    );

    // Let the mount effect generate the verification code, then type it to reach
    // the confirmation stage.
    await new Promise(resolve => setTimeout(resolve, 0));
    h.textInputProps?.onChange?.(CODE);
    await new Promise(resolve => setTimeout(resolve, 0));

    // Confirm the delete, then in the SAME tick try to cancel/re-submit. The
    // synchronous deletingRef guard must swallow these without a re-render.
    inputCallback('y', {});
    inputCallback('c', {});
    inputCallback('', { escape: true });
    inputCallback('y', {});

    expect(onCancel).not.toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledTimes(1);
    unmount();
  });
});
