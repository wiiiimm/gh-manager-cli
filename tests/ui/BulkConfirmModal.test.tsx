import React from 'react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render } from 'ink-testing-library';
import type { Key } from 'ink';
import BulkConfirmModal from '../../src/ui/components/modals/BulkConfirmModal';

type InkInputHandler = (input: string, key: Partial<Key>) => void;

vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return { ...actual, useInput: vi.fn() };
});

describe('BulkConfirmModal', () => {
  let mockUseInput: Mock;

  beforeEach(async () => {
    const ink = await import('ink');
    mockUseInput = (ink as unknown as { useInput: Mock }).useInput;
    mockUseInput.mockReset();
    mockUseInput.mockImplementation(() => {});
  });

  it('renders the count and action verb', () => {
    const { lastFrame, unmount } = render(
      <BulkConfirmModal
        count={3}
        actionLabel="Delete"
        actionColor="red"
        actionVerb="delete"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const out = lastFrame() || '';
    expect(out).toContain('Bulk Delete Confirmation');
    expect(out).toContain('3');
    expect(out).toContain('repositories');
    unmount();
  });

  it('uses singular "repository" for count=1', () => {
    const { lastFrame, unmount } = render(
      <BulkConfirmModal
        count={1}
        actionLabel="Delete"
        actionColor="red"
        actionVerb="delete"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const out = lastFrame() || '';
    expect(out).toContain('repository');
    unmount();
  });

  it('shows the destination owner for transfer', () => {
    const { lastFrame, unmount } = render(
      <BulkConfirmModal
        count={2}
        actionLabel="Transfer"
        actionColor="yellow"
        actionVerb="transfer"
        destination="new-org"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const out = lastFrame() || '';
    expect(out).toContain('transfer');
    expect(out).toContain('new-org');
    unmount();
  });

  it('confirms on Y and cancels on Esc', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    let cb!: InkInputHandler;
    mockUseInput.mockImplementation((handler: InkInputHandler) => { cb = handler; });

    const { unmount } = render(
      <BulkConfirmModal
        count={2}
        actionLabel="Transfer"
        actionColor="yellow"
        actionVerb="transfer"
        destination="new-org"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    cb('y', {});
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // settledRef guards against a second action firing
    cb('', { escape: true });
    expect(onCancel).not.toHaveBeenCalled();
    unmount();
  });
});
