import React from 'react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render } from 'ink-testing-library';
import type { Key } from 'ink';
import BulkReviewModal from '../../src/ui/components/modals/BulkReviewModal';
import type { RepoNode } from '../../src/types';

type InkInputHandler = (input: string, key: Partial<Key>) => void;

vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return { ...actual, useInput: vi.fn() };
});

function repo(
  id: string,
  nameWithOwner: string,
  overrides: Partial<RepoNode> = {},
): RepoNode {
  return {
    id,
    nameWithOwner,
    name: nameWithOwner.split('/')[1],
    isPrivate: false,
    visibility: 'PUBLIC',
    isArchived: false,
    ...overrides,
  } as unknown as RepoNode;
}

function makeSelection(...repos: RepoNode[]): Map<string, RepoNode> {
  return new Map(repos.map(r => [r.id, r]));
}

describe('BulkReviewModal', () => {
  let mockUseInput: Mock;

  beforeEach(async () => {
    const ink = await import('ink');
    mockUseInput = (ink as unknown as { useInput: Mock }).useInput;
    mockUseInput.mockReset();
    mockUseInput.mockImplementation(() => {});
  });

  it('renders the selected repositories and the action label', () => {
    const { lastFrame, unmount } = render(
      <BulkReviewModal
        selectedRepos={makeSelection(repo('1', 'me/alpha'), repo('2', 'me/beta'))}
        actionLabel="Transfer"
        actionColor="yellow"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const out = lastFrame() || '';
    expect(out).toContain('Bulk Transfer — Review Selection');
    expect(out).toContain('me/alpha');
    expect(out).toContain('me/beta');
    expect(out).toContain('2 repositories selected');
    unmount();
  });

  it('keeps the visibility badge inline with the name on the highlighted row, sharing the highlight background', () => {
    // The first repo is the highlighted (cursor) row by default. Regression for
    // SWR-374: the badge must not wrap to the next line and must sit inside the
    // background-highlighted segment.
    const { lastFrame, unmount } = render(
      <BulkReviewModal
        selectedRepos={makeSelection(
          repo('1', 'me/secret', { isPrivate: true, visibility: 'PRIVATE' }),
          repo('2', 'me/beta'),
        )}
        actionLabel="Delete"
        actionColor="red"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const out = lastFrame() || '';
    const nameLine = out.split('\n').find(l => l.includes('me/secret')) || '';
    // Same visual line as the name (would be on a separate wrapped line if broken).
    expect(nameLine).toContain('Private');
    // bgCyan open code ([46m) is present on that line → badge is highlighted.
    expect(nameLine).toContain('[46m');
    unmount();
  });

  it('shows the Internal badge inline for an internal repo on the highlighted row', () => {
    const { lastFrame, unmount } = render(
      <BulkReviewModal
        selectedRepos={makeSelection(
          repo('1', 'org/intra', { visibility: 'INTERNAL' }),
        )}
        actionLabel="Archive"
        actionColor="yellow"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const out = lastFrame() || '';
    const nameLine = out.split('\n').find(l => l.includes('org/intra')) || '';
    expect(nameLine).toContain('Internal');
    expect(nameLine).toContain('[46m');
    unmount();
  });

  it('confirms with the full selection when nothing is unselected', async () => {
    const onConfirm = vi.fn();
    let cb!: InkInputHandler;
    mockUseInput.mockImplementation((handler: InkInputHandler) => { cb = handler; });

    const sel = makeSelection(repo('1', 'me/alpha'), repo('2', 'me/beta'));
    const { unmount } = render(
      <BulkReviewModal
        selectedRepos={sel}
        actionLabel="Transfer"
        actionColor="yellow"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );

    cb('', { tab: true }); // list → buttons
    await new Promise(r => setTimeout(r, 0)); // flush → fresh handler with focusArea='buttons'
    cb('y', {});           // confirm
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const passed = onConfirm.mock.calls[0][0] as Map<string, RepoNode>;
    expect(passed.size).toBe(2);
    unmount();
  });

  it('Space unselects the highlighted repo and confirm emits the trimmed selection', async () => {
    const onConfirm = vi.fn();
    let cb!: InkInputHandler;
    mockUseInput.mockImplementation((handler: InkInputHandler) => { cb = handler; });

    const sel = makeSelection(repo('1', 'me/alpha'), repo('2', 'me/beta'), repo('3', 'me/gamma'));
    const { unmount } = render(
      <BulkReviewModal
        selectedRepos={sel}
        actionLabel="Transfer"
        actionColor="yellow"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );

    cb(' ', {});            // unselect the first repo (cursor at 0 → 'me/alpha')
    await new Promise(r => setTimeout(r, 0)); // flush trimmed selection
    cb('', { tab: true });  // list → buttons
    await new Promise(r => setTimeout(r, 0)); // flush focusArea change
    cb('y', {});            // confirm

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const passed = onConfirm.mock.calls[0][0] as Map<string, RepoNode>;
    expect(passed.size).toBe(2);
    expect(passed.has('1')).toBe(false);
    expect(passed.has('2')).toBe(true);
    expect(passed.has('3')).toBe(true);
    unmount();
  });

  it('cancels when the last repo is unselected', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    let cb!: InkInputHandler;
    mockUseInput.mockImplementation((handler: InkInputHandler) => { cb = handler; });

    const { unmount } = render(
      <BulkReviewModal
        selectedRepos={makeSelection(repo('1', 'me/only'))}
        actionLabel="Transfer"
        actionColor="yellow"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    cb(' ', {}); // unselect the only repo → should cancel
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    unmount();
  });

  it('cancels on Esc', () => {
    const onCancel = vi.fn();
    let cb!: InkInputHandler;
    mockUseInput.mockImplementation((handler: InkInputHandler) => { cb = handler; });

    const { unmount } = render(
      <BulkReviewModal
        selectedRepos={makeSelection(repo('1', 'me/alpha'))}
        actionLabel="Transfer"
        actionColor="yellow"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );

    cb('', { escape: true });
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();
  });
});
