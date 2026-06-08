import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import ViewFiltersModal from '../../src/ui/components/modals/ViewFiltersModal';
import type { ViewFiltersValue } from '../../src/ui/components/modals/ViewFiltersModal';

vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
  };
});

const baseCurrent: ViewFiltersValue = { visibility: 'all', archive: 'all', fork: 'all' };

describe('ViewFiltersModal', () => {
  let mockUseInput: any;

  beforeEach(async () => {
    const ink = await import('ink');
    mockUseInput = (ink as any).useInput;
    mockUseInput.mockReset();
    mockUseInput.mockImplementation(() => {});
  });

  it('renders the three filter groups', () => {
    const { lastFrame, unmount } = render(
      <ViewFiltersModal
        current={baseCurrent}
        isEnterprise={false}
        starsMode={false}
        onApply={() => {}}
        onCancel={() => {}}
      />
    );
    const output = lastFrame() || '';
    expect(output).toContain('View Filters');
    expect(output).toContain('Visibility');
    expect(output).toContain('Archive');
    expect(output).toContain('Fork');
    expect(output).toContain('Public');
    expect(output).toContain('Unarchived');
    expect(output).toContain('Forks only');
    expect(output).toContain('Non-forks only');
    unmount();
  });

  it('shows "Private/Internal" label when isEnterprise is true', () => {
    const { lastFrame, unmount } = render(
      <ViewFiltersModal
        current={baseCurrent}
        isEnterprise={true}
        starsMode={false}
        onApply={() => {}}
        onCancel={() => {}}
      />
    );
    expect(lastFrame() || '').toContain('Private/Internal');
    unmount();
  });

  it('shows "Private" label when not enterprise', () => {
    const { lastFrame, unmount } = render(
      <ViewFiltersModal
        current={baseCurrent}
        isEnterprise={false}
        starsMode={false}
        onApply={() => {}}
        onCancel={() => {}}
      />
    );
    const output = lastFrame() || '';
    expect(output).toContain('Private');
    expect(output).not.toContain('Private/Internal');
    unmount();
  });

  it('hides the Visibility group in stars mode but keeps Archive and Fork', () => {
    const { lastFrame, unmount } = render(
      <ViewFiltersModal
        current={baseCurrent}
        isEnterprise={false}
        starsMode={true}
        onApply={() => {}}
        onCancel={() => {}}
      />
    );
    const output = lastFrame() || '';
    // Visibility options are not rendered as choices in stars mode — only an
    // explanatory disabled-state note remains.
    expect(output).not.toContain('Public');
    expect(output).not.toContain('Private');
    expect(output).toContain('Archive');
    expect(output).toContain('Fork');
    expect(output).toContain('Unarchived');
    expect(output).toContain('Forks only');
    expect(output).toContain('unavailable in starred mode');
    unmount();
  });

  it('calls onCancel when Escape is pressed', () => {
    const onCancel = vi.fn();
    mockUseInput.mockImplementation((cb: any) => cb('', { escape: true }));
    const { unmount } = render(
      <ViewFiltersModal
        current={baseCurrent}
        isEnterprise={false}
        starsMode={false}
        onApply={() => {}}
        onCancel={onCancel}
      />
    );
    expect(onCancel).toHaveBeenCalled();
    unmount();
  });

  it('calls onCancel when C is pressed', () => {
    const onCancel = vi.fn();
    mockUseInput.mockImplementation((cb: any) => cb('c', {}));
    const { unmount } = render(
      <ViewFiltersModal
        current={baseCurrent}
        isEnterprise={false}
        starsMode={false}
        onApply={() => {}}
        onCancel={onCancel}
      />
    );
    expect(onCancel).toHaveBeenCalled();
    unmount();
  });

  it('applies the current selection unchanged when Y is pressed without navigation', () => {
    const onApply = vi.fn();
    mockUseInput.mockImplementation((cb: any) => cb('y', {}));
    const { unmount } = render(
      <ViewFiltersModal
        current={{ visibility: 'public', archive: 'unarchived', fork: 'forks' }}
        isEnterprise={false}
        starsMode={false}
        onApply={onApply}
        onCancel={() => {}}
      />
    );
    expect(onApply).toHaveBeenCalledWith({ visibility: 'public', archive: 'unarchived', fork: 'forks' });
    unmount();
  });

  it('changes the focused group value live with Right arrow and applies with Enter', () => {
    const onApply = vi.fn();
    let cbRef: any;
    mockUseInput.mockImplementation((cb: any) => {
      cbRef = cb;
    });
    const renderModal = () => (
      <ViewFiltersModal
        current={baseCurrent}
        isEnterprise={false}
        starsMode={false}
        onApply={onApply}
        onCancel={() => {}}
      />
    );
    const { rerender, unmount } = render(renderModal());

    // Visibility group is focused first on 'all'. Right moves the value live to 'public'.
    cbRef('', { rightArrow: true });
    rerender(renderModal());
    // Enter applies whatever is highlighted — no separate commit step.
    cbRef('', { return: true });
    expect(onApply).toHaveBeenCalledWith({ visibility: 'public', archive: 'all', fork: 'all' });
    unmount();
  });

  it('←→ moves the value live across multiple presses and Left steps back', () => {
    const onApply = vi.fn();
    let cbRef: any;
    mockUseInput.mockImplementation((cb: any) => {
      cbRef = cb;
    });
    const renderModal = () => (
      <ViewFiltersModal
        current={baseCurrent}
        isEnterprise={false}
        starsMode={false}
        onApply={onApply}
        onCancel={() => {}}
      />
    );
    const { rerender, unmount } = render(renderModal());

    // all → public → private
    cbRef('', { rightArrow: true });
    rerender(renderModal());
    cbRef('', { rightArrow: true });
    rerender(renderModal());
    // Right at the end is a no-op (already on last option); Left steps back to public.
    cbRef('', { rightArrow: true });
    rerender(renderModal());
    cbRef('', { leftArrow: true });
    rerender(renderModal());
    cbRef('', { return: true });
    expect(onApply).toHaveBeenCalledWith({ visibility: 'public', archive: 'all', fork: 'all' });
    unmount();
  });

  it('preserves the parent visibility value when applied in stars mode', () => {
    // Regression for SWR-379: when the visibility group is hidden in stars
    // mode, the modal must still echo the parent's current.visibility back
    // through onApply unchanged. Seeding it to 'all' would let the parent
    // diff-detect a spurious change and overwrite the saved pref.
    const onApply = vi.fn();
    mockUseInput.mockImplementation((cb: any) => cb('y', {}));
    const { unmount } = render(
      <ViewFiltersModal
        current={{ visibility: 'public', archive: 'unarchived', fork: 'all' }}
        isEnterprise={false}
        starsMode={true}
        onApply={onApply}
        onCancel={() => {}}
      />
    );
    expect(onApply).toHaveBeenCalledWith({ visibility: 'public', archive: 'unarchived', fork: 'all' });
    unmount();
  });

  it('changes fork value after navigating Down→Down then Right and applying', () => {
    const onApply = vi.fn();
    let cbRef: any;
    mockUseInput.mockImplementation((cb: any) => {
      cbRef = cb;
    });
    const renderModal = () => (
      <ViewFiltersModal current={baseCurrent} isEnterprise={false} starsMode={false} onApply={onApply} onCancel={() => {}} />
    );
    const { rerender, unmount } = render(renderModal());

    // Down → Archive group
    cbRef('', { downArrow: true });
    rerender(renderModal());
    // Down → Fork group
    cbRef('', { downArrow: true });
    rerender(renderModal());
    // Right → move Fork value live from 'all' to 'forks'
    cbRef('', { rightArrow: true });
    rerender(renderModal());
    // Enter → apply
    cbRef('', { return: true });
    expect(onApply).toHaveBeenCalledWith({ visibility: 'all', archive: 'all', fork: 'forks' });
    unmount();
  });

  it('Enter on the Cancel button cancels', () => {
    const onCancel = vi.fn();
    let cbRef: any;
    mockUseInput.mockImplementation((cb: any) => {
      cbRef = cb;
    });
    const renderModal = () => (
      <ViewFiltersModal
        current={baseCurrent}
        isEnterprise={false}
        starsMode={false}
        onApply={() => {}}
        onCancel={onCancel}
      />
    );
    const { rerender, unmount } = render(renderModal());

    // Down ×3 reaches Apply (3 groups → Apply), then Down → Cancel.
    for (let i = 0; i < 3; i += 1) {
      cbRef('', { downArrow: true });
      rerender(renderModal());
    }
    cbRef('', { downArrow: true });
    rerender(renderModal());
    cbRef('', { return: true });
    expect(onCancel).toHaveBeenCalled();
    unmount();
  });

  it('Enter on the Apply button applies the selection', () => {
    const onApply = vi.fn();
    let cbRef: any;
    mockUseInput.mockImplementation((cb: any) => {
      cbRef = cb;
    });
    const renderModal = () => (
      <ViewFiltersModal
        current={baseCurrent}
        isEnterprise={false}
        starsMode={false}
        onApply={onApply}
        onCancel={() => {}}
      />
    );
    const { rerender, unmount } = render(renderModal());

    // Down ×3 reaches the Apply button (3 groups → Apply).
    for (let i = 0; i < 3; i += 1) {
      cbRef('', { downArrow: true });
      rerender(renderModal());
    }
    cbRef('', { return: true });
    expect(onApply).toHaveBeenCalledWith({ visibility: 'all', archive: 'all', fork: 'all' });
    unmount();
  });

  it('advances focus with Tab through the groups to Apply, where Enter triggers onApply', () => {
    // Tab moves focus group → group → Apply (no within-group option stepping;
    // ←→ handles values). 3 groups means 3 Tabs reach Apply. Tab does not
    // change any value, so onApply receives the seeded current selection.
    const onApply = vi.fn();
    let cbRef: any;
    mockUseInput.mockImplementation((cb: any) => {
      cbRef = cb;
    });
    const renderModal = () => (
      <ViewFiltersModal
        current={baseCurrent}
        isEnterprise={false}
        starsMode={false}
        onApply={onApply}
        onCancel={() => {}}
      />
    );
    const { rerender, unmount } = render(renderModal());

    for (let i = 0; i < 3; i += 1) {
      cbRef('', { tab: true });
      rerender(renderModal());
    }

    // Focus is now on Apply. Enter fires onApply with the (untouched) selection.
    cbRef('', { return: true });
    expect(onApply).toHaveBeenCalledWith({ visibility: 'all', archive: 'all', fork: 'all' });
    unmount();
  });
});
