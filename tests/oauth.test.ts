import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startOAuthFlow, pollForAccessToken, requestDeviceCode, openGitHubAuthorizationPage } from '../src/oauth';
import type { DeviceCodeResponse, OAuthResult } from '../src/oauth';

// Mock logger
vi.mock('../src/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock github module
vi.mock('../src/github', () => ({
  makeClient: vi.fn(),
  getViewerLogin: vi.fn()
}));

// Mock open module
vi.mock('open', () => ({
  default: vi.fn()
}));

// Mock fetch for API calls
global.fetch = vi.fn() as any;

describe('OAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('requestDeviceCode', () => {
    it('successfully requests device code', async () => {
      const mockResponse: DeviceCodeResponse = {
        device_code: 'test-device-code',
        user_code: 'TEST-CODE',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await requestDeviceCode();

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://github.com/login/device/code',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('throws error when device code request fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      });

      await expect(requestDeviceCode()).rejects.toThrow('HTTP error 401');
    });

    it('throws error on network failure', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(requestDeviceCode()).rejects.toThrow('Network error');
    });
  });

  describe('pollForAccessToken', () => {
    const mockDeviceCode: DeviceCodeResponse = {
      device_code: 'test-device-code',
      user_code: 'TEST-CODE',
      verification_uri: 'https://github.com/login/device',
      expires_in: 900,
      interval: 5
    };

    it('successfully polls and returns access token', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'bearer',
        scope: 'repo user'
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'authorization_pending' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse
        });

      const { makeClient, getViewerLogin } = await import('../src/github');
      (makeClient as any).mockReturnValue({});
      (getViewerLogin as any).mockResolvedValue('testuser');

      const resultPromise = pollForAccessToken(mockDeviceCode);
      
      // Advance timers to trigger polling
      await vi.advanceTimersByTimeAsync(5000);
      
      const result = await resultPromise;

      expect(result).toEqual({
        success: true,
        token: 'test-access-token',
        login: 'testuser'
      });
    });

    it('handles slow_down error by increasing interval', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'slow_down' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'test-access-token',
            token_type: 'bearer'
          })
        });

      const { makeClient, getViewerLogin } = await import('../src/github');
      (makeClient as any).mockReturnValue({});
      (getViewerLogin as any).mockResolvedValue('testuser');

      const resultPromise = pollForAccessToken(mockDeviceCode);
      
      // Advance timers - should wait longer due to slow_down
      await vi.advanceTimersByTimeAsync(10000);
      
      const result = await resultPromise;

      expect(result.success).toBe(true);
    });

    it('returns error when user denies access', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'access_denied' })
      });

      const result = await pollForAccessToken(mockDeviceCode);

      expect(result).toEqual({
        success: false,
        error: 'Polling failed: Authorization was denied.'
      });
    });

    it('returns error when authorization expires', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'expired_token' })
      });

      const result = await pollForAccessToken(mockDeviceCode);

      expect(result).toEqual({
        success: false,
        error: 'Polling failed: The device code has expired. Please try again.'
      });
    });

    it('handles network errors during polling', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await pollForAccessToken(mockDeviceCode);

      expect(result).toEqual({
        success: false,
        error: 'Polling failed: Network error'
      });
    });
  });

  describe('startOAuthFlow', () => {
    it('returns device code info successfully', async () => {
      const mockDeviceResponse: DeviceCodeResponse = {
        device_code: 'device-123',
        user_code: 'USER-123',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5
      };

      // Mock device code request - the function checks response.ok and response.text
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeviceResponse,
        text: async () => JSON.stringify(mockDeviceResponse)
      });

      const open = (await import('open')).default;

      const result = await startOAuthFlow();

      expect(result.success).toBe(true);
      expect(result.deviceCode).toEqual({
        user_code: 'USER-123',
        verification_uri: 'https://github.com/login/device'
      });
      expect(open).toHaveBeenCalledWith('https://github.com/login/device');
    });

    it('returns error when device code request fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });

      const result = await startOAuthFlow();

      expect(result.success).toBe(false);
      expect(result.error).toContain('OAuth flow failed');
    });
  });

  describe('openGitHubAuthorizationPage', () => {
    it('opens GitHub OAuth app settings page', async () => {
      const open = (await import('open')).default;
      
      await openGitHubAuthorizationPage();

      expect(open).toHaveBeenCalledWith('https://github.com/settings/connections/applications/Ov23li1pOAO5GZmxBF1L');
    });

    it('handles errors when opening browser', async () => {
      const open = (await import('open')).default;
      (open as any).mockRejectedValueOnce(new Error('Failed to open browser'));

      // openGitHubAuthorizationPage doesn't catch errors, so it will throw
      await expect(openGitHubAuthorizationPage()).rejects.toThrow('Failed to open browser');
    });
  });
});