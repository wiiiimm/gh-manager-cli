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

  it('changes the focused option with Right arrow and applies the new value', () => {
    const onApply = vi.fn();
    let cbRef: any;
    mockUseInput.mockImplementation((cb: any) => {
      cbRef = cb;
    });
    const { rerender, unmount } = render(
      <ViewFiltersModal
        current={baseCurrent}
        isEnterprise={false}
        starsMode={false}
        onApply={onApply}
        onCancel={() => {}}
      />
    );

    // Visibility group is focused first on the 'all' option. Move right to 'public'.
    cbRef('', { rightArrow: true });
    rerender(
      <ViewFiltersModal
        current={baseCurrent}
        isEnterprise={false}
        starsMode={false}
        onApply={onApply}
        onCancel={() => {}}
      />
    );
    // Select that option (Enter), then apply via Y.
    cbRef('', { return: true });
    rerender(
      <ViewFiltersModal
        current={baseCurrent}
        isEnterprise={false}
        starsMode={false}
        onApply={onApply}
        onCancel={() => {}}
      />
    );
    cbRef('y', {});
    expect(onApply).toHaveBeenCalledWith({ visibility: 'public', archive: 'all', fork: 'all' });
    unmount();
  });

  it('selects fork = forks after navigating Down→Down then right and applying', () => {
    const onApply = vi.fn();
    let cbRef: any;
    mockUseInput.mockImplementation((cb: any) => {
      cbRef = cb;
    });
    const { rerender, unmount } = render(
      <ViewFiltersModal
        current={baseCurrent}
        isEnterprise={false}
        starsMode={false}
        onApply={onApply}
        onCancel={() => {}}
      />
    );

    // Down → Archive group
    cbRef('', { downArrow: true });
    rerender(<ViewFiltersModal current={baseCurrent} isEnterprise={false} starsMode={false} onApply={onApply} onCancel={() => {}} />);
    // Down → Fork group
    cbRef('', { downArrow: true });
    rerender(<ViewFiltersModal current={baseCurrent} isEnterprise={false} starsMode={false} onApply={onApply} onCancel={() => {}} />);
    // Right → focus 'forks' option in Fork group
    cbRef('', { rightArrow: true });
    rerender(<ViewFiltersModal current={baseCurrent} isEnterprise={false} starsMode={false} onApply={onApply} onCancel={() => {}} />);
    // Enter → commit selection inside group
    cbRef('', { return: true });
    rerender(<ViewFiltersModal current={baseCurrent} isEnterprise={false} starsMode={false} onApply={onApply} onCancel={() => {}} />);
    // Y → apply
    cbRef('y', {});
    expect(onApply).toHaveBeenCalledWith({ visibility: 'all', archive: 'all', fork: 'forks' });
    unmount();
  });
});
