import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import type { Key } from 'ink';
import BulkCodeModal from '../../src/ui/components/modals/BulkCodeModal';
import BulkDeleteCodeModal from '../../src/ui/components/modals/BulkDeleteCodeModal';
import BulkTransferCodeModal from '../../src/ui/components/modals/BulkTransferCodeModal';

type InkInputHandler = (input: string, key: Partial<Key>) => void;

vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return { ...actual, useInput: vi.fn() };
});

// Capture latest TextInput props so tests can drive onChange / onSubmit
const h = vi.hoisted(() => ({
  textInputProps: null as { onChange?: (v: string) => void; onSubmit?: () => void } | null,
}));
vi.mock('ink-text-input', () => ({
  default: (props: { onChange?: (v: string) => void; onSubmit?: () => void }) => {
    h.textInputProps = props;
    return null;
  },
}));

describe('BulkCodeModal (generic)', () => {
  let mockUseInput: Mock;

  beforeEach(async () => {
    h.textInputProps = null;
    const ink = await import('ink');
    mockUseInput = (ink as unknown as { useInput: Mock }).useInput;
    mockUseInput.mockReset();
  });

  it('renders title and body', () => {
    mockUseInput.mockImplementation(() => {});
    const { lastFrame, unmount } = render(
      <BulkCodeModal
        count={3}
        title="Confirm Bulk Delete"
        borderColor="red"
        body={<Text>You are about to delete 3 repositories.</Text>}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const out = lastFrame() || '';
    expect(out).toContain('Confirm Bulk Delete');
    expect(out).toContain('delete 3 repositories');
    expect(out).toContain('Verification code');
    unmount();
  });

  it('calls onCancel on Esc', () => {
    const onCancel = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <BulkCodeModal
        count={2}
        title="Test"
        borderColor="red"
        body={<Text>body</Text>}
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );

    inputCallback('', { escape: true });
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('calls onConfirm when the correct code is typed (Math.random → 0 → AAAA)', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    const { unmount } = render(
      <BulkCodeModal
        count={2}
        title="Test"
        borderColor="red"
        body={<Text>body</Text>}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    // When Math.random → 0, chars[0] = 'A', so code = 'AAAA'
    h.textInputProps?.onChange?.('AAAA');
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    randomSpy.mockRestore();
    unmount();
  });

  it('does not call onConfirm for an incorrect code', () => {
    const onConfirm = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0); // code = 'AAAA'

    const { unmount } = render(
      <BulkCodeModal
        count={2}
        title="Test"
        borderColor="red"
        body={<Text>body</Text>}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );

    h.textInputProps?.onChange?.('ZZZZ'); // wrong
    expect(onConfirm).not.toHaveBeenCalled();

    randomSpy.mockRestore();
    unmount();
  });

  it('shows an error message after an incorrect code', async () => {
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0); // code = 'AAAA'

    const { lastFrame, unmount } = render(
      <BulkCodeModal
        count={2}
        title="Test"
        borderColor="red"
        body={<Text>body</Text>}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    h.textInputProps?.onChange?.('ZZZZ'); // wrong
    await new Promise(r => setTimeout(r, 0)); // flush error state

    const out = lastFrame() || '';
    expect(out).toContain('Code does not match');

    randomSpy.mockRestore();
    unmount();
  });
});

describe('BulkDeleteCodeModal (wrapper)', () => {
  let mockUseInput: Mock;

  beforeEach(async () => {
    h.textInputProps = null;
    const ink = await import('ink');
    mockUseInput = (ink as unknown as { useInput: Mock }).useInput;
    mockUseInput.mockReset();
  });

  it('renders delete-specific title and body', () => {
    mockUseInput.mockImplementation(() => {});
    const { lastFrame, unmount } = render(
      <BulkDeleteCodeModal count={5} onConfirm={() => {}} onCancel={() => {}} />,
    );
    const out = lastFrame() || '';
    expect(out).toContain('Confirm Bulk Delete');
    expect(out).toContain('permanently delete');
    expect(out).toContain('5');
    unmount();
  });

  it('uses singular "repository" for count=1', () => {
    mockUseInput.mockImplementation(() => {});
    const { lastFrame, unmount } = render(
      <BulkDeleteCodeModal count={1} onConfirm={() => {}} onCancel={() => {}} />,
    );
    const out = lastFrame() || '';
    expect(out).toContain('repository');
    expect(out).not.toContain('repositories');
    unmount();
  });

  it('cancels on Esc', () => {
    const onCancel = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <BulkDeleteCodeModal count={3} onConfirm={() => {}} onCancel={onCancel} />,
    );

    inputCallback('', { escape: true });
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('confirms on correct code', () => {
    const onConfirm = vi.fn();
    mockUseInput.mockImplementation(() => {});
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0); // code = 'AAAA'

    const { unmount } = render(
      <BulkDeleteCodeModal count={3} onConfirm={onConfirm} onCancel={() => {}} />,
    );

    h.textInputProps?.onChange?.('AAAA');
    expect(onConfirm).toHaveBeenCalledTimes(1);

    randomSpy.mockRestore();
    unmount();
  });
});

describe('BulkTransferCodeModal (wrapper)', () => {
  let mockUseInput: Mock;

  beforeEach(async () => {
    h.textInputProps = null;
    const ink = await import('ink');
    mockUseInput = (ink as unknown as { useInput: Mock }).useInput;
    mockUseInput.mockReset();
  });

  it('renders transfer-specific title and destination owner', () => {
    mockUseInput.mockImplementation(() => {});
    const { lastFrame, unmount } = render(
      <BulkTransferCodeModal
        count={4}
        destination="new-org"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const out = lastFrame() || '';
    expect(out).toContain('Confirm Bulk Transfer');
    expect(out).toContain('transfer');
    expect(out).toContain('new-org');
    expect(out).toContain('4');
    unmount();
  });

  it('cancels on Esc', () => {
    const onCancel = vi.fn();
    let inputCallback!: InkInputHandler;
    mockUseInput.mockImplementation((cb: InkInputHandler) => { inputCallback = cb; });

    const { unmount } = render(
      <BulkTransferCodeModal
        count={2}
        destination="new-org"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );

    inputCallback('', { escape: true });
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('confirms on correct code (Math.random → 0 → AAAA)', () => {
    const onConfirm = vi.fn();
    mockUseInput.mockImplementation(() => {});
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0); // code = 'AAAA'

    const { unmount } = render(
      <BulkTransferCodeModal
        count={2}
        destination="new-org"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );

    h.textInputProps?.onChange?.('AAAA');
    expect(onConfirm).toHaveBeenCalledTimes(1);

    randomSpy.mockRestore();
    unmount();
  });

  it('does not confirm on incorrect code and shows error', async () => {
    const onConfirm = vi.fn();
    mockUseInput.mockImplementation(() => {});
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0); // code = 'AAAA'

    const { lastFrame, unmount } = render(
      <BulkTransferCodeModal
        count={2}
        destination="new-org"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );

    h.textInputProps?.onChange?.('ZZZZ');
    await new Promise(r => setTimeout(r, 0)); // flush error state
    expect(onConfirm).not.toHaveBeenCalled();
    const out = lastFrame() || '';
    expect(out).toContain('Code does not match');

    randomSpy.mockRestore();
    unmount();
  });
});
