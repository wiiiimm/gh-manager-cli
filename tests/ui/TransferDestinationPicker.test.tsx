import React from 'react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render } from 'ink-testing-library';
import type { Key } from 'ink';
import TransferDestinationPicker from '../../src/ui/components/modals/TransferDestinationPicker';
import type { OrganizationNode } from '../../src/types';

type InkInputHandler = (input: string, key: Partial<Key>) => void;

// Stub `useInput` so we can capture the latest input callback and drive key
// events deterministically (avoids stdin.ref errors under ink-testing-library).
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return { ...actual, useInput: vi.fn() };
});

// Stub ink-text-input — the real one needs raw stdin. Capturing onChange/onSubmit
// via vi.hoisted lets the manual-mode tests "type" without a real input.
const h = vi.hoisted(() => ({
  textInputProps: null as { onChange?: (v: string) => void; onSubmit?: () => void } | null,
}));
vi.mock('ink-text-input', () => ({
  default: (props: { onChange?: (v: string) => void; onSubmit?: () => void }) => {
    h.textInputProps = props;
    return null;
  },
}));

const orgs = (): OrganizationNode[] => [
  { id: 'o1', login: 'acme', name: 'Acme Inc', avatarUrl: '' },
  { id: 'o2', login: 'globex', name: 'Globex Corp', avatarUrl: '' },
];

const flush = () => new Promise<void>(r => setTimeout(r, 0));

/** Ink 7 can take an extra tick under parallel load for the auto-manual fallback. */
async function flushUntil(predicate: () => boolean, attempts = 20): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    if (predicate()) return;
    await flush();
  }
}

describe('TransferDestinationPicker', () => {
  let mockUseInput: Mock;

  beforeEach(async () => {
    h.textInputProps = null;
    const ink = await import('ink');
    mockUseInput = (ink as unknown as { useInput: Mock }).useInput;
    mockUseInput.mockReset();
  });

  it('renders the personal account and visible orgs after the loader resolves', async () => {
    mockUseInput.mockImplementation(() => {});

    const { lastFrame, unmount } = render(
      <TransferDestinationPicker
        currentOwner="myuser"
        viewerLogin="myviewer"
        loadOrganizations={async () => orgs()}
        onChoose={() => {}}
        onCancel={() => {}}
      />,
    );

    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));

    const out = lastFrame() || '';
    expect(out).toContain('Choose destination owner');
    expect(out).toContain('myviewer');
    expect(out).toContain('Acme Inc');
    expect(out).toContain('Globex Corp');
    expect(out).toContain('Enter a different owner');
    unmount();
  });

  it('excludes the current owner from the picker list', async () => {
    mockUseInput.mockImplementation(() => {});

    const { lastFrame, unmount } = render(
      <TransferDestinationPicker
        currentOwner="acme"
        viewerLogin="myviewer"
        loadOrganizations={async () => orgs()}
        onChoose={() => {}}
        onCancel={() => {}}
      />,
    );

    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));

    const out = lastFrame() || '';
    expect(out).toContain('myviewer');
    expect(out).toContain('Globex');
    expect(out).not.toContain('Acme Inc');
    unmount();
  });

  it('also excludes the personal entry when it matches the current owner', async () => {
    mockUseInput.mockImplementation(() => {});

    const { lastFrame, unmount } = render(
      <TransferDestinationPicker
        currentOwner="myviewer"
        viewerLogin="MyViewer"
        loadOrganizations={async () => orgs()}
        onChoose={() => {}}
        onCancel={() => {}}
      />,
    );

    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));

    const out = lastFrame() || '';
    expect(out).toContain('Acme');
    expect(out).toContain('Globex');
    expect(out).not.toContain('(personal)');
    unmount();
  });

  it('selects the focused org on Enter and calls onChoose with its login', async () => {
    const onChoose = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <TransferDestinationPicker
        currentOwner="someone"
        viewerLogin="myviewer"
        loadOrganizations={async () => orgs()}
        onChoose={onChoose}
        onCancel={() => {}}
      />,
    );

    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));

    // Cursor starts at 0 → personal. ↓ once → acme.
    inputCallback('', { downArrow: true });
    await new Promise(r => setTimeout(r, 0));
    inputCallback('', { return: true });

    expect(onChoose).toHaveBeenCalledWith('acme');
    unmount();
  });

  it('cancels on Esc from the list view', async () => {
    const onCancel = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <TransferDestinationPicker
        currentOwner="someone"
        viewerLogin="myviewer"
        loadOrganizations={async () => orgs()}
        onChoose={() => {}}
        onCancel={onCancel}
      />,
    );

    await new Promise(r => setTimeout(r, 0));
    inputCallback('', { escape: true });

    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('switches to manual mode on M and submits the typed destination', async () => {
    const onChoose = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { lastFrame, unmount } = render(
      <TransferDestinationPicker
        currentOwner="someone"
        viewerLogin="myviewer"
        loadOrganizations={async () => orgs()}
        onChoose={onChoose}
        onCancel={() => {}}
      />,
    );

    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));

    inputCallback('m', {});
    await new Promise(r => setTimeout(r, 0));

    expect(lastFrame() || '').toContain('Destination owner');
    h.textInputProps?.onChange?.('hidden-org');
    await new Promise(r => setTimeout(r, 0)); // flush → fresh onSubmit closes over new state
    h.textInputProps?.onSubmit?.();

    expect(onChoose).toHaveBeenCalledWith('hidden-org');
    unmount();
  });

  it('blocks submission of the current owner in manual mode', async () => {
    const onChoose = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { lastFrame, unmount } = render(
      <TransferDestinationPicker
        currentOwner="myorg"
        viewerLogin="myviewer"
        loadOrganizations={async () => orgs()}
        onChoose={onChoose}
        onCancel={() => {}}
      />,
    );

    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));

    inputCallback('m', {});
    await new Promise(r => setTimeout(r, 0));

    h.textInputProps?.onChange?.('MYORG');
    await new Promise(r => setTimeout(r, 0));
    h.textInputProps?.onSubmit?.();
    await new Promise(r => setTimeout(r, 0));

    expect(onChoose).not.toHaveBeenCalled();
    expect(lastFrame() || '').toContain('must differ');
    unmount();
  });

  it('falls back to manual mode when the loader fails', async () => {
    mockUseInput.mockImplementation(() => {});

    const { lastFrame, unmount } = render(
      <TransferDestinationPicker
        currentOwner="myviewer"
        // No personal/list entries possible → manual is the only useful surface.
        viewerLogin="myviewer"
        loadOrganizations={async () => { throw new Error('GraphQL boom'); }}
        onChoose={() => {}}
        onCancel={() => {}}
      />,
    );

    await flushUntil(() => (lastFrame() || '').includes('Destination owner'));

    const out = lastFrame() || '';
    expect(out).toContain("Couldn't load organisations");
    expect(out).toContain('GraphQL boom');
    expect(out).toContain('Destination owner');
    unmount();
  });

  it('renders the manual fallback when the org list is empty and personal is excluded', async () => {
    const onChoose = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { lastFrame, unmount } = render(
      <TransferDestinationPicker
        currentOwner="myviewer"
        viewerLogin="myviewer"
        loadOrganizations={async () => []}
        onChoose={onChoose}
        onCancel={() => {}}
      />,
    );

    await flushUntil(() => (lastFrame() || '').includes('Destination owner'));

    expect(lastFrame() || '').toContain('Destination owner');

    h.textInputProps?.onChange?.('new-target');
    await new Promise(r => setTimeout(r, 0));
    h.textInputProps?.onSubmit?.();
    expect(onChoose).toHaveBeenCalledWith('new-target');
    unmount();
  });

  it('sanitises invalid characters and leading hyphens before submission', async () => {
    const onChoose = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <TransferDestinationPicker
        currentOwner="someone"
        viewerLogin="myviewer"
        loadOrganizations={async () => []}
        onChoose={onChoose}
        onCancel={() => {}}
      />,
    );

    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));

    // Already in manual mode (no orgs + personal excluded earlier test pattern).
    // For this case viewer is "myviewer" and current owner is "someone" so personal
    // remains. We still want to test manual sanitisation — switch to manual first.
    inputCallback('m', {});
    await new Promise(r => setTimeout(r, 0));

    // The picker's onChange normalises the value. After typing the messy string
    // the modal's internal `manualValue` should be 'newowner1'.
    h.textInputProps?.onChange?.('--new owner_1!');
    await new Promise(r => setTimeout(r, 0));
    h.textInputProps?.onSubmit?.();

    expect(onChoose).toHaveBeenCalledWith('newowner1');
    unmount();
  });

  it('ignores Enter/arrows/M while the org list is still loading', async () => {
    const onChoose = vi.fn();
    const onCancel = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    // Loader that never resolves — the picker stays in the loading state.
    const { lastFrame, unmount } = render(
      <TransferDestinationPicker
        currentOwner="someone"
        viewerLogin="myviewer"
        loadOrganizations={() => new Promise(() => {})}
        onChoose={onChoose}
        onCancel={onCancel}
      />,
    );

    await new Promise(r => setTimeout(r, 0));

    // List is hidden — only the spinner is shown. Pressing Enter must NOT
    // submit the (invisible) focused row.
    const out = lastFrame() || '';
    expect(out).toContain('Loading organisations');
    expect(out).not.toContain('Enter a different owner');

    inputCallback('', { return: true });
    inputCallback('', { downArrow: true });
    inputCallback('m', {});

    expect(onChoose).not.toHaveBeenCalled();

    // Esc should still cancel even during loading.
    inputCallback('', { escape: true });
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('swallows input while the host marks the picker as busy', async () => {
    const onChoose = vi.fn();
    const onCancel = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <TransferDestinationPicker
        currentOwner="someone"
        viewerLogin="myviewer"
        loadOrganizations={async () => orgs()}
        onChoose={onChoose}
        onCancel={onCancel}
        busy
      />,
    );

    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));

    inputCallback('', { return: true });
    inputCallback('', { escape: true });
    inputCallback('m', {});

    expect(onChoose).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    unmount();
  });
});
