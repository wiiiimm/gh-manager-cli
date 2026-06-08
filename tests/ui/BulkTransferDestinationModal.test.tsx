import React from 'react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render } from 'ink-testing-library';
import type { Key } from 'ink';
import BulkTransferDestinationModal from '../../src/ui/components/modals/BulkTransferDestinationModal';
import type { OrganizationNode } from '../../src/types';

type InkInputHandler = (input: string, key: Partial<Key>) => void;

vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return { ...actual, useInput: vi.fn() };
});

// Capture the latest TextInput props so tests can drive onChange/onSubmit directly.
const h = vi.hoisted(() => ({
  textInputProps: null as { onChange?: (v: string) => void; onSubmit?: () => void } | null,
}));
vi.mock('ink-text-input', () => ({
  default: (props: { onChange?: (v: string) => void; onSubmit?: () => void }) => {
    h.textInputProps = props;
    return null;
  },
}));

const mockOrgs: OrganizationNode[] = [
  { id: 'o1', login: 'acme', name: 'Acme Inc', avatarUrl: '' },
  { id: 'o2', login: 'globex', name: 'Globex', avatarUrl: '' },
];

describe('BulkTransferDestinationModal', () => {
  let mockUseInput: Mock;

  beforeEach(async () => {
    h.textInputProps = null;
    const ink = await import('ink');
    mockUseInput = (ink as unknown as { useInput: Mock }).useInput;
    mockUseInput.mockReset();
  });

  it('renders the destination prompt with repo count and the picker list', async () => {
    mockUseInput.mockImplementation(() => {});

    const { lastFrame, unmount } = render(
      <BulkTransferDestinationModal
        count={3}
        currentOwner="myorg"
        viewerLogin="myuser"
        loadOrganizations={async () => mockOrgs}
        onChoose={() => {}}
        onCancel={() => {}}
      />,
    );

    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));

    const out = lastFrame() || '';
    expect(out).toContain('Bulk Transfer Repositories');
    expect(out).toContain('3');
    expect(out).toContain('Choose destination owner');
    expect(out).toContain('myuser');
    expect(out).toContain('Acme Inc');
    unmount();
  });

  it('uses singular "repository" for count=1', async () => {
    mockUseInput.mockImplementation(() => {});

    const { lastFrame, unmount } = render(
      <BulkTransferDestinationModal
        count={1}
        currentOwner="myorg"
        viewerLogin="myuser"
        loadOrganizations={async () => mockOrgs}
        onChoose={() => {}}
        onCancel={() => {}}
      />,
    );

    await new Promise(r => setTimeout(r, 0));

    const out = lastFrame() || '';
    expect(out).toContain('repository');
    expect(out).not.toContain('repositories');
    unmount();
  });

  it('calls onCancel on Esc from the picker', async () => {
    const onCancel = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <BulkTransferDestinationModal
        count={2}
        currentOwner="myorg"
        viewerLogin="myuser"
        loadOrganizations={async () => mockOrgs}
        onChoose={() => {}}
        onCancel={onCancel}
      />,
    );

    await new Promise(r => setTimeout(r, 0));
    inputCallback('', { escape: true });
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('calls onChoose with the selected org login on Enter', async () => {
    const onChoose = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <BulkTransferDestinationModal
        count={2}
        currentOwner="myorg"
        viewerLogin="myuser"
        loadOrganizations={async () => mockOrgs}
        onChoose={onChoose}
        onCancel={() => {}}
      />,
    );

    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));
    // cursor 0 = personal (myuser)
    inputCallback('', { return: true });

    expect(onChoose).toHaveBeenCalledWith('myuser');
    unmount();
  });

  it('calls onChoose with a manually entered destination', async () => {
    const onChoose = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <BulkTransferDestinationModal
        count={1}
        currentOwner="oldorg"
        viewerLogin="myuser"
        loadOrganizations={async () => []}
        onChoose={onChoose}
        onCancel={() => {}}
      />,
    );

    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));
    // No orgs returned: list = [personal, manual]. Press M to jump to manual.
    inputCallback('m', {});
    await new Promise(r => setTimeout(r, 0));

    h.textInputProps?.onChange?.('new-target');
    await new Promise(r => setTimeout(r, 0));
    h.textInputProps?.onSubmit?.();

    expect(onChoose).toHaveBeenCalledWith('new-target');
    unmount();
  });

  it('does not call onChoose when manual destination equals currentOwner (case-insensitive)', async () => {
    const onChoose = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { lastFrame, unmount } = render(
      <BulkTransferDestinationModal
        count={2}
        currentOwner="MyOrg"
        viewerLogin="myuser"
        loadOrganizations={async () => []}
        onChoose={onChoose}
        onCancel={() => {}}
      />,
    );

    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));
    inputCallback('m', {});
    await new Promise(r => setTimeout(r, 0));

    h.textInputProps?.onChange?.('myorg');
    await new Promise(r => setTimeout(r, 0));
    h.textInputProps?.onSubmit?.();
    await new Promise(r => setTimeout(r, 0));

    expect(onChoose).not.toHaveBeenCalled();
    expect(lastFrame() || '').toContain('must differ');
    unmount();
  });

  it('falls back to manual entry when the org loader fails', async () => {
    const onChoose = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { lastFrame, unmount } = render(
      <BulkTransferDestinationModal
        count={2}
        currentOwner="myuser"
        viewerLogin="myuser"
        loadOrganizations={async () => { throw new Error('fetch failed'); }}
        onChoose={onChoose}
        onCancel={() => {}}
      />,
    );

    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));

    const out = lastFrame() || '';
    expect(out).toContain("Couldn't load organisations");
    expect(out).toContain('Destination owner');

    h.textInputProps?.onChange?.('safe-org');
    await new Promise(r => setTimeout(r, 0));
    h.textInputProps?.onSubmit?.();
    expect(onChoose).toHaveBeenCalledWith('safe-org');
    unmount();
  });

  it('does not call onChoose twice when Enter fires in the same tick as submit (in-flight guard)', async () => {
    const onChoose = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <BulkTransferDestinationModal
        count={2}
        currentOwner="myorg"
        viewerLogin="myuser"
        loadOrganizations={async () => mockOrgs}
        onChoose={onChoose}
        onCancel={() => {}}
      />,
    );

    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));

    inputCallback('', { return: true });
    // Second Enter in the same tick — the submittingRef guard inside the bulk modal
    // must swallow it before the host has a chance to handle a follow-up.
    inputCallback('', { return: true });

    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith('myuser');
    unmount();
  });

  // Unit test of the sanitisation regex itself, independent of component state.
  it('sanitisation regex strips invalid chars and leading hyphens', () => {
    const sanitise = (v: string) => v.replace(/[^a-zA-Z0-9-]/g, '').replace(/^-+/, '');
    expect(sanitise('new org_2.0')).toBe('neworg20');
    expect(sanitise('--new-org')).toBe('new-org');
    expect(sanitise('valid-owner-123')).toBe('valid-owner-123');
    expect(sanitise('  spaces  ')).toBe('spaces');
  });
});
