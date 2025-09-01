import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import FilterInput from '../../src/ui/components/repo/FilterInput';

// Mock TextInput since it has stdin issues
vi.mock('ink-text-input', async () => {
  const React = await import('react');
  const { Text } = await import('ink');
  
  return {
    default: vi.fn(({ value, placeholder, onChange, onSubmit }: any) => {
      // Store callbacks for testing
      if (global.mockTextInputCallbacks) {
        global.mockTextInputCallbacks.onChange = onChange;
        global.mockTextInputCallbacks.onSubmit = onSubmit;
      }
      
      return React.createElement(
        Text,
        {},
        value || placeholder
      );
    })
  };
});

// Add global type for our mock callbacks
declare global {
  var mockTextInputCallbacks: {
    onChange?: (value: string) => void;
    onSubmit?: () => void;
  };
}

describe('FilterInput', () => {
  beforeEach(() => {
    // Reset mock callbacks
    global.mockTextInputCallbacks = {};
    vi.clearAllMocks();
  });

  it('renders filter input with label', () => {
    const { lastFrame, unmount } = render(
      <FilterInput
        filter=""
        onChange={() => {}}
        onSubmit={() => {}}
        searchActive={false}
        searchLoading={false}
      />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Filter:');
    unmount();
  });

  it('displays current filter value', () => {
    const { lastFrame, unmount } = render(
      <FilterInput
        filter="typescript"
        onChange={() => {}}
        onSubmit={() => {}}
        searchActive={false}
        searchLoading={false}
      />
    );

    const output = lastFrame() || '';
    expect(output).toContain('typescript');
    unmount();
  });

  it('shows placeholder when filter is empty', () => {
    const { lastFrame, unmount } = render(
      <FilterInput
        filter=""
        onChange={() => {}}
        onSubmit={() => {}}
        searchActive={false}
        searchLoading={false}
      />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Type to search (3+ chars for server search)...');
    unmount();
  });

  it('calls onChange when TextInput changes', () => {
    const onChange = vi.fn();
    const addDebugMessage = vi.fn();
    
    render(
      <FilterInput
        filter=""
        onChange={onChange}
        onSubmit={() => {}}
        searchActive={false}
        searchLoading={false}
        addDebugMessage={addDebugMessage}
      />
    );

    // Simulate onChange through our mock
    if (global.mockTextInputCallbacks.onChange) {
      global.mockTextInputCallbacks.onChange('react');
    }
    
    expect(onChange).toHaveBeenCalledWith('react');
    expect(addDebugMessage).toHaveBeenCalledWith('[onChange] val="react"');
  });

  it('calls onSubmit when TextInput submits', () => {
    const onSubmit = vi.fn();
    
    render(
      <FilterInput
        filter="test"
        onChange={() => {}}
        onSubmit={onSubmit}
        searchActive={false}
        searchLoading={false}
      />
    );

    // Simulate onSubmit through our mock
    if (global.mockTextInputCallbacks.onSubmit) {
      global.mockTextInputCallbacks.onSubmit();
    }
    
    expect(onSubmit).toHaveBeenCalled();
  });

  it('works without addDebugMessage prop', () => {
    const onChange = vi.fn();
    
    render(
      <FilterInput
        filter=""
        onChange={onChange}
        onSubmit={() => {}}
        searchActive={false}
        searchLoading={false}
      />
    );

    // Should not throw when changing without addDebugMessage
    expect(() => {
      if (global.mockTextInputCallbacks.onChange) {
        global.mockTextInputCallbacks.onChange('test');
      }
    }).not.toThrow();
    
    expect(onChange).toHaveBeenCalledWith('test');
  });
});