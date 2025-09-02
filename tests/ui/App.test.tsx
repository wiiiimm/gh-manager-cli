import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import App from '../../src/ui/App';
import { getStoredToken, storeToken, getTokenFromEnv, clearStoredToken } from '../../src/config';
import { makeClient, getViewerLogin } from '../../src/github';
import { requestDeviceCode, pollForAccessToken } from '../../src/oauth';

// Mock package.json
vi.mock('../../package.json', () => ({
  default: { version: '1.0.0' }
}));

// Mock logger
vi.mock('../../src/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock config module
vi.mock('../../src/config', () => ({
  getStoredToken: vi.fn(),
  storeToken: vi.fn(),
  getTokenFromEnv: vi.fn(),
  clearStoredToken: vi.fn(),
  getTokenSource: vi.fn(() => 'pat'),
  OwnerContext: {}
}));

// Mock github module  
vi.mock('../../src/github', () => ({
  makeClient: vi.fn(),
  getViewerLogin: vi.fn()
}));

// Mock oauth module
vi.mock('../../src/oauth', () => ({
  requestDeviceCode: vi.fn(),
  pollForAccessToken: vi.fn()
}));

// Mock open module
vi.mock('open', () => ({
  default: vi.fn()
}));

// Mock child components
vi.mock('../../src/ui/RepoList', () => ({
  default: vi.fn(() => null)
}));

vi.mock('../../src/ui/components/auth', () => ({
  AuthMethodSelector: vi.fn(({ onSelect }: any) => {
    // Store callback for testing
    (global as any).__authMethodSelectCallback = onSelect;
    return null;
  }),
  OAuthProgress: vi.fn(() => null),
  AuthMethod: {},
  OAuthStatus: {}
}));

// Mock ink-text-input
vi.mock('ink-text-input', () => ({
  default: vi.fn(({ value, onChange, onSubmit }: any) => {
    // Store callbacks for testing
    (global as any).__textInputCallbacks = { value, onChange, onSubmit };
    return null;
  })
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Reset global test callbacks
    (global as any).__authMethodSelectCallback = undefined;
    (global as any).__textInputCallbacks = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('initial authentication flow', () => {
    it('checks for environment token on mount', () => {
      (getTokenFromEnv as any).mockReturnValue(null);
      (getStoredToken as any).mockReturnValue(null);

      const { unmount } = render(<App />);
      
      expect(getTokenFromEnv).toHaveBeenCalled();
      expect(getStoredToken).toHaveBeenCalled();
      unmount();
    });

    it('uses environment token if available', async () => {
      (getTokenFromEnv as any).mockReturnValue('env-token-123');
      (getStoredToken as any).mockReturnValue(null);
      (makeClient as any).mockReturnValue({});
      (getViewerLogin as any).mockResolvedValue('testuser');

      const { lastFrame, unmount } = render(<App />);
      
      // Should show validating state
      expect(lastFrame()).toContain('Validating token...');
      
      // Wait for validation
      await vi.runAllTimersAsync();
      
      expect(makeClient).toHaveBeenCalledWith('env-token-123');
      expect(getViewerLogin).toHaveBeenCalled();
      unmount();
    });

    it('uses stored token if no environment token', async () => {
      (getTokenFromEnv as any).mockReturnValue(null);
      (getStoredToken as any).mockReturnValue('stored-token-456');
      (makeClient as any).mockReturnValue({});
      (getViewerLogin as any).mockResolvedValue('testuser');

      const { unmount } = render(<App />);
      
      await vi.runAllTimersAsync();
      
      expect(makeClient).toHaveBeenCalledWith('stored-token-456');
      unmount();
    });

    it('shows auth method selection when no token available', () => {
      (getTokenFromEnv as any).mockReturnValue(null);
      (getStoredToken as any).mockReturnValue(null);

      const { unmount } = render(<App />);
      
      // Just check it doesn't crash
      unmount();
    });
  });

  describe('error handling', () => {
    it('handles network errors', async () => {
      (getTokenFromEnv as any).mockReturnValue('token');
      (getStoredToken as any).mockReturnValue(null);
      (makeClient as any).mockReturnValue({});
      (getViewerLogin as any).mockRejectedValue(new Error('Network timeout'));

      const { lastFrame, unmount } = render(<App />);
      
      await vi.runAllTimersAsync();

      expect(clearStoredToken).toHaveBeenCalled();
      const output = lastFrame();
      expect(output).toContain('Network error');
      unmount();
    });

    it('handles validation timeout', async () => {
      (getTokenFromEnv as any).mockReturnValue('token');
      (getStoredToken as any).mockReturnValue(null);
      (makeClient as any).mockReturnValue({});
      
      // Never resolve to trigger timeout
      (getViewerLogin as any).mockImplementation(() => new Promise(() => {}));

      const { lastFrame, unmount } = render(<App />);
      
      // Fast-forward past timeout (15 seconds)
      await vi.advanceTimersByTimeAsync(16000);

      const output = lastFrame();
      expect(output).toContain('Token validation timed out');
      unmount();
    });
  });

  describe('UI rendering', () => {
    it('shows version in header', () => {
      (getTokenFromEnv as any).mockReturnValue(null);
      (getStoredToken as any).mockReturnValue(null);

      const { lastFrame, unmount } = render(<App />);
      
      const output = lastFrame();
      expect(output).toContain('v1.0.0');
      expect(output).toContain('GitHub Repository Manager');
      unmount();
    });

    it('shows debug mode indicator when enabled', () => {
      (getTokenFromEnv as any).mockReturnValue(null);
      (getStoredToken as any).mockReturnValue(null);
      
      process.env.GH_MANAGER_DEBUG = '1';

      const { lastFrame, unmount } = render(<App />);
      
      const output = lastFrame();
      expect(output).toContain('debug mode');
      
      delete process.env.GH_MANAGER_DEBUG;
      unmount();
    });
  });
});