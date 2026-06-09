import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import SortModal from '../../src/ui/components/modals/SortModal';

// Mock useInput so we can drive the keyboard handler directly (avoids stdin.ref).
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return { ...actual, useInput: vi.fn() };
});

describe('SortModal', () => {
  let mockUseInput: any;

  beforeEach(async () => {
    const ink = await import('ink');
    mockUseInput = (ink as any).useInput;
    mockUseInput.mockReset();
  });

  it('renders all five sort options, including Forks, and the F hint', () => {
    mockUseInput.mockImplementation(() => {});
    const { lastFrame, unmount } = render(
      <SortModal currentSort="updated" onSelect={() => {}} onCancel={() => {}} />,
    );
    const out = lastFrame() || '';
    expect(out).toContain('Last Updated');
    expect(out).toContain('Last Pushed');
    expect(out).toContain('Name');
    expect(out).toContain('Stars');
    expect(out).toContain('Forks');
    expect(out).toContain('U/P/N/S/F'); // footer hint advertises the F shortcut
    unmount();
  });

  it('selects forks when F is pressed', () => {
    let handler: any;
    mockUseInput.mockImplementation((cb: any) => { handler = cb; });
    const onSelect = vi.fn();
    const { unmount } = render(
      <SortModal currentSort="updated" onSelect={onSelect} onCancel={() => {}} />,
    );
    handler('f', {});
    expect(onSelect).toHaveBeenCalledWith('forks');
    unmount();
  });

  it('marks forks as the current sort when selected', () => {
    mockUseInput.mockImplementation(() => {});
    const { lastFrame, unmount } = render(
      <SortModal currentSort="forks" onSelect={() => {}} onCancel={() => {}} />,
    );
    const out = lastFrame() || '';
    expect(out).toContain('Forks');
    expect(out).toContain('✓'); // current-sort checkmark
    unmount();
  });

  it('still maps the existing shortcuts (S → stars) — no regression', () => {
    let handler: any;
    mockUseInput.mockImplementation((cb: any) => { handler = cb; });
    const onSelect = vi.fn();
    const { unmount } = render(
      <SortModal currentSort="updated" onSelect={onSelect} onCancel={() => {}} />,
    );
    handler('s', {});
    expect(onSelect).toHaveBeenCalledWith('stars');
    unmount();
  });
});
