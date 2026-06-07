import React from 'react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render } from 'ink-testing-library';
import type { Key } from 'ink';
import CreateRepoModal from '../../src/ui/components/modals/CreateRepoModal';

type InkInputHandler = (input: string, key: Partial<Key>) => void;

vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return { ...actual, useInput: vi.fn() };
});

// Capture the name TextInput so the test can simulate typing the repo name.
const h = vi.hoisted(() => ({ textInputProps: null as { onChange?: (v: string) => void } | null }));
vi.mock('ink-text-input', () => ({
  default: (props: { onChange?: (v: string) => void }) => { h.textInputProps = props; return null; }
}));

describe('CreateRepoModal', () => {
  let mockUseInput: Mock;

  beforeEach(async () => {
    const ink = await import('ink');
    mockUseInput = (ink as unknown as { useInput: Mock }).useInput;
    mockUseInput.mockReset();
    h.textInputProps = null;
  });

  it('renders the create prompt with the owner slug', () => {
    mockUseInput.mockImplementation(() => {});

    const { lastFrame, unmount } = render(
      <CreateRepoModal ownerSlug="octocat" onCreate={async () => {}} onCancel={() => {}} />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Create New Repository');
    expect(output).toContain('octocat');
    expect(output).toContain('Private');
    expect(output).toContain('Public');
    unmount();
  });

  it('does not create when the name is empty', () => {
    const onCreate = vi.fn(async () => {});
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <CreateRepoModal ownerSlug="octocat" onCreate={onCreate} onCancel={() => {}} />
    );

    inputCallback('', { return: true });
    expect(onCreate).not.toHaveBeenCalled();
    unmount();
  });

  it('cancels on Esc', () => {
    const onCancel = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <CreateRepoModal ownerSlug="octocat" onCreate={async () => {}} onCancel={onCancel} />
    );

    inputCallback('', { escape: true });
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('creates with the entered name and default Private visibility', async () => {
    const onCreate = vi.fn(() => new Promise<void>(() => {})); // never resolves
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { lastFrame, unmount } = render(
      <CreateRepoModal ownerSlug="octocat" onCreate={onCreate} onCancel={() => {}} />
    );

    h.textInputProps?.onChange?.('my-new-repo');
    // Flush so the input closure observes the typed name before we submit.
    await new Promise(resolve => setTimeout(resolve, 0));
    inputCallback('', { return: true });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(onCreate).toHaveBeenCalledWith('my-new-repo', 'PRIVATE');
    expect(lastFrame() || '').toContain('Creating repository...');
    unmount();
  });

  it('ignores input while creation is in progress', async () => {
    const onCreate = vi.fn(() => new Promise<void>(() => {})); // never resolves
    const onCancel = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <CreateRepoModal ownerSlug="octocat" onCreate={onCreate} onCancel={onCancel} />
    );

    // Type the name (flush so Enter sees it), then submit and, in the SAME tick,
    // hammer Esc/Enter/Tab. The synchronous submittingRef guard must swallow them.
    h.textInputProps?.onChange?.('my-new-repo');
    await new Promise(resolve => setTimeout(resolve, 0));
    inputCallback('', { return: true });
    inputCallback('', { escape: true });
    inputCallback('', { return: true });
    inputCallback('', { tab: true });

    expect(onCancel).not.toHaveBeenCalled();
    expect(onCreate).toHaveBeenCalledTimes(1);
    unmount();
  });
});
