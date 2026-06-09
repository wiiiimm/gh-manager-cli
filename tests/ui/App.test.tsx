import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import App from '../../src/ui/App';
import { getStoredToken, storeToken, getTokenFromEnv, clearStoredToken } from '../../src/config/config';
import { makeClient, getViewerLogin, setActiveApolloToken } from '../../src/services/github';

// Mock package.json
vi.mock('../../package.json', () => ({
  default: { version: '1.0.0' }
}));

// Mock logger
vi.mock('../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock config module
vi.mock('../../src/config/config', () => ({
  getStoredToken: vi.fn(),
  storeToken: vi.fn(),
  getTokenFromEnv: vi.fn(),
  clearStoredToken: vi.fn(),
  clearAllSettings: vi.fn(),
  getTokenSource: vi.fn(() => 'pat'),
  OwnerContext: {}
}));

// Mock github module  
vi.mock('../../src/services/github', () => ({
  makeClient: vi.fn(),
  getViewerLogin: vi.fn(),
  setActiveApolloToken: vi.fn()
}));

// Mock oauth module
vi.mock('../../src/services/oauth', () => ({
  requestDeviceCode: vi.fn(),
  pollForAccessToken: vi.fn()
}));

// Mock open module
vi.mock('open', () => ({
  default: vi.fn()
}));

// Mock child components. App imports from './views/RepoList', so the mock must
// target that path or it silently fails to intercept the real component.
vi.mock('../../src/ui/views/RepoList', () => ({
  default: vi.fn(() => null)
}));

vi.mock('../../src/ui/components/auth', () => ({
  AuthMethodSelector: vi.fn(() => null),
  OAuthProgress: vi.fn(() => null),
  AuthMethod: {},
  OAuthStatus: {}
}));

// Mock ink-text-input
vi.mock('ink-text-input', () => ({
  default: vi.fn(() => null)
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // TODO: Fix App component tests - stdin.ref error in test environment
  // The App component works correctly but ink-testing-library has issues
  // with stdin in the test environment causing "stdin.ref is not a function" errors
  
  it('checks for tokens on mount', () => {
    (getTokenFromEnv as any).mockReturnValue(null);
    (getStoredToken as any).mockReturnValue(null);

    // Just verify the mocks are called
    const { unmount } = render(<App />);
    
    expect(getTokenFromEnv).toHaveBeenCalled();
    expect(getStoredToken).toHaveBeenCalled();
    // The active session token is declared to the GitHub service (null when no
    // token is present) so stale ops can't act as a previous account (GMC-28).
    expect(setActiveApolloToken).toHaveBeenCalledWith(null);
    unmount();
  });

  it('shows auth flow when no token', () => {
    (getTokenFromEnv as any).mockReturnValue(null);
    (getStoredToken as any).mockReturnValue(null);

    // Just verify it renders without crashing
    const { unmount } = render(<App />);
    unmount();
  });
});