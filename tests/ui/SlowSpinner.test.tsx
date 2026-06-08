import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import SlowSpinner, { SLOW_SPINNER_WIDTH, slowSpinnerFrames } from '../../src/ui/components/common/SlowSpinner';

describe('SlowSpinner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders initial spinner frame', () => {
    const { lastFrame, unmount } = render(<SlowSpinner />);
    
    const output = lastFrame() || '';
    expect(output).toBe('.');
    unmount();
  });

  it('cycles through spinner frames over time', async () => {
    const { lastFrame, unmount, rerender } = render(<SlowSpinner />);
    
    expect(lastFrame()).toBe('.');
    
    await vi.advanceTimersByTimeAsync(500);
    rerender(<SlowSpinner />);
    expect(lastFrame()).toBe('..');

    await vi.advanceTimersByTimeAsync(500);
    rerender(<SlowSpinner />);
    expect(lastFrame()).toBe('...');
    
    unmount();
  });

  it('loops back to first frame after last frame', async () => {
    const { lastFrame, unmount } = render(<SlowSpinner />);
    
    await vi.advanceTimersByTimeAsync(500 * 3);
    
    expect(lastFrame()).toBe('.');
    
    unmount();
  });

  it('keeps the animation in a fixed width container', () => {
    expect(SLOW_SPINNER_WIDTH).toBe(3);
    expect(slowSpinnerFrames.map(frame => frame.length)).toEqual([1, 2, 3]);
    expect(slowSpinnerFrames.every(frame => frame.length <= SLOW_SPINNER_WIDTH)).toBe(true);
  });

  it('updates every 500ms', async () => {
    const { lastFrame, unmount, rerender } = render(<SlowSpinner />);
    
    const initialFrame = lastFrame();
    
    // Advance less than 500ms - should not change
    vi.advanceTimersByTime(499);
    rerender(<SlowSpinner />);
    expect(lastFrame()).toBe(initialFrame);
    
    await vi.advanceTimersByTimeAsync(1);
    rerender(<SlowSpinner />);
    
    expect(lastFrame()).toBe('..');
    
    unmount();
  });

  it('honours custom intervals', async () => {
    const { lastFrame, unmount, rerender } = render(<SlowSpinner interval={2000} />);

    expect(lastFrame()).toBe('.');

    vi.advanceTimersByTime(1999);
    rerender(<SlowSpinner interval={2000} />);
    expect(lastFrame()).toBe('.');

    await vi.advanceTimersByTimeAsync(1);
    rerender(<SlowSpinner interval={2000} />);
    expect(lastFrame()).toBe('..');

    unmount();
  });

  it('cleans up interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    
    const { unmount } = render(<SlowSpinner />);
    
    unmount();
    
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
