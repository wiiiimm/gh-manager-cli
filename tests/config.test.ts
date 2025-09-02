import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  getConfigPath,
  readConfig,
  writeConfig,
  getTokenFromEnv,
  getStoredToken,
  storeToken,
  clearStoredToken,
  getUIPrefs,
  storeUIPrefs
} from '../src/config';

// Mock fs and envPaths
vi.mock('fs');
vi.mock('env-paths', () => {
  return {
    default: vi.fn(() => ({
      config: '/mock/config/dir'
    }))
  };
});

describe('config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getConfigPath', () => {
    it('returns the correct config file path', () => {
      const configPath = getConfigPath();
      expect(configPath).toBe(path.join('/mock/config/dir', 'config.json'));
    });
  });

  describe('readConfig', () => {
    it('returns parsed config when file exists', () => {
      const mockConfig = { token: 'test-token', ui: { sortKey: 'name' } };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

      const config = readConfig();
      expect(config).toEqual(mockConfig);
      expect(fs.readFileSync).toHaveBeenCalledWith(
        path.join('/mock/config/dir', 'config.json'),
        'utf8'
      );
    });

    it('returns empty object when file does not exist', () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File not found');
      });

      const config = readConfig();
      expect(config).toEqual({});
    });

    it('returns empty object when file contains invalid JSON', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json');

      const config = readConfig();
      expect(config).toEqual({});
    });
  });

  describe('writeConfig', () => {
    it('creates config directory and writes config file', () => {
      const mockConfig = { token: 'test-token', ui: { sortKey: 'stars' } };
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      writeConfig(mockConfig);

      expect(fs.mkdirSync).toHaveBeenCalledWith('/mock/config/dir', { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/mock/config/dir', 'config.json'),
        JSON.stringify(mockConfig, null, 2),
        'utf8'
      );
      expect(fs.chmodSync).toHaveBeenCalledWith(
        path.join('/mock/config/dir', 'config.json'),
        0o600
      );

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('does not set permissions on Windows', () => {
      const mockConfig = { token: 'test-token' };
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      writeConfig(mockConfig);

      expect(fs.chmodSync).not.toHaveBeenCalled();

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('ignores chmod errors silently', () => {
      const mockConfig = { token: 'test-token' };
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      
      vi.mocked(fs.chmodSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Should not throw
      expect(() => writeConfig(mockConfig)).not.toThrow();

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('getTokenFromEnv', () => {
    it('returns GITHUB_TOKEN if set', () => {
      process.env.GITHUB_TOKEN = 'github-token';
      process.env.GH_TOKEN = 'gh-token';

      expect(getTokenFromEnv()).toBe('github-token');
    });

    it('returns GH_TOKEN if GITHUB_TOKEN is not set', () => {
      process.env.GH_TOKEN = 'gh-token';

      expect(getTokenFromEnv()).toBe('gh-token');
    });

    it('returns undefined if no token environment variables are set', () => {
      expect(getTokenFromEnv()).toBeUndefined();
    });
  });

  describe('getStoredToken', () => {
    it('returns token from config file', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ token: 'stored-token' }));

      expect(getStoredToken()).toBe('stored-token');
    });

    it('returns undefined when no token in config', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ ui: {} }));

      expect(getStoredToken()).toBeUndefined();
    });

    it('returns undefined when config file does not exist', () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(getStoredToken()).toBeUndefined();
    });
  });

  describe('storeToken', () => {
    it('stores token and preserves existing config', () => {
      const existingConfig = { ui: { sortKey: 'name' } };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingConfig));

      storeToken('new-token');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify({ ...existingConfig, token: 'new-token', tokenVersion: 1, tokenSource: 'pat' }, null, 2),
        'utf8'
      );
    });

    it('stores token when no existing config', () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File not found');
      });

      storeToken('new-token');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify({ token: 'new-token', tokenVersion: 1, tokenSource: 'pat' }, null, 2),
        'utf8'
      );
    });
  });

  describe('clearStoredToken', () => {
    it('removes token but preserves other settings', () => {
      const existingConfig = {
        token: 'old-token',
        tokenVersion: 1,
        ui: { sortKey: 'stars', density: 1 }
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingConfig));

      clearStoredToken();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify({ ui: { sortKey: 'stars', density: 1 } }, null, 2),
        'utf8'
      );
    });

    it('handles missing config gracefully', () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File not found');
      });

      clearStoredToken();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify({}, null, 2),
        'utf8'
      );
    });
  });

  describe('getUIPrefs', () => {
    it('returns UI preferences from config', () => {
      const mockConfig = {
        token: 'token',
        ui: {
          sortKey: 'updated',
          sortDir: 'desc',
          density: 2,
          forkTracking: true
        }
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

      const prefs = getUIPrefs();
      expect(prefs).toEqual(mockConfig.ui);
    });

    it('returns empty object when no UI prefs in config', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ token: 'token' }));

      const prefs = getUIPrefs();
      expect(prefs).toEqual({});
    });

    it('returns empty object when config file does not exist', () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File not found');
      });

      const prefs = getUIPrefs();
      expect(prefs).toEqual({});
    });
  });

  describe('storeUIPrefs', () => {
    it('merges new prefs with existing UI prefs', () => {
      const existingConfig = {
        token: 'token',
        ui: {
          sortKey: 'name',
          sortDir: 'asc',
          density: 1
        }
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingConfig));

      storeUIPrefs({ sortDir: 'desc', forkTracking: true });

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify({
          token: 'token',
          ui: {
            sortKey: 'name',
            sortDir: 'desc',
            density: 1,
            forkTracking: true
          }
        }, null, 2),
        'utf8'
      );
    });

    it('creates UI prefs when none exist', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ token: 'token' }));

      storeUIPrefs({ sortKey: 'stars', density: 2 });

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify({
          token: 'token',
          ui: {
            sortKey: 'stars',
            density: 2
          }
        }, null, 2),
        'utf8'
      );
    });

    it('handles owner context correctly', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

      storeUIPrefs({
        ownerContext: { type: 'organization', login: 'myorg', name: 'My Org' }
      });

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify({
          ui: {
            ownerContext: { type: 'organization', login: 'myorg', name: 'My Org' }
          }
        }, null, 2),
        'utf8'
      );
    });
  });
});