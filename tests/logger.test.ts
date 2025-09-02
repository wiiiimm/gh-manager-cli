import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import Logger, { LogLevel } from '../src/logger';

vi.mock('fs');
vi.mock('env-paths', () => ({
  default: vi.fn(() => ({ log: '/mock/log/dir' }))
}));

describe('Logger', () => {
  const mockLogDir = '/mock/log/dir';
  const mockLogFile = path.join(mockLogDir, 'gh-manager-cli.log');
  let writeStreamMock: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    writeStreamMock = {
      write: vi.fn(),
      end: vi.fn()
    };
    
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    (fs.mkdirSync as any).mockImplementation(() => {});
    (fs.existsSync as any).mockReturnValue(false);
    (fs.createWriteStream as any).mockReturnValue(writeStreamMock);
    (fs.statSync as any).mockReturnValue({ size: 0 });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('singleton instance', () => {
    it('returns the singleton instance', () => {
      const instance = Logger.getInstance();
      expect(instance).toBeDefined();
      expect(typeof instance.info).toBe('function');
    });
  });

  describe('Logger class', () => {
    it('creates instance with default config', () => {
      const instance = new (Logger as any)();
      expect(instance).toBeDefined();
    });

    it('creates instance with custom config', () => {
      const instance = new (Logger as any)({
        logLevel: LogLevel.DEBUG,
        logToFile: false,
        logToConsole: true,
        maxFileSize: 1024,
        maxFiles: 3,
        logDir: '/custom/log/dir'
      });
      expect(instance).toBeDefined();
    });

    it('uses debug mode when GH_MANAGER_DEBUG is set', () => {
      process.env.GH_MANAGER_DEBUG = '1';
      const instance = new (Logger as any)();
      expect(instance).toBeDefined();
      delete process.env.GH_MANAGER_DEBUG;
    });

    it('throws when log directory creation fails', () => {
      (fs.mkdirSync as any).mockImplementationOnce(() => {
        throw new Error('Cannot create directory');
      });
      
      expect(() => new (Logger as any)()).toThrow('Cannot create directory');
      
      // Reset for subsequent calls
      (fs.mkdirSync as any).mockImplementation(() => {});
    });

    it('handles log file creation failure', () => {
      (fs.createWriteStream as any).mockImplementation(() => {
        throw new Error('Cannot create file');
      });
      const instance = new (Logger as any)();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to initialise log file:', expect.any(Error));
    });
  });

  describe('logging methods', () => {
    let testLogger: any;

    beforeEach(() => {
      testLogger = new (Logger as any)({
        logLevel: LogLevel.DEBUG,
        logToFile: true,
        logToConsole: true
      });
    });

    it('logs debug messages', () => {
      testLogger.debug('Debug message');
      expect(writeStreamMock.write).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('logs info messages', () => {
      testLogger.info('Info message');
      expect(writeStreamMock.write).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('logs warn messages', () => {
      testLogger.warn('Warn message');
      expect(writeStreamMock.write).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('logs error messages', () => {
      testLogger.error('Error message');
      expect(writeStreamMock.write).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('logs fatal messages', () => {
      testLogger.fatal('Fatal message');
      expect(writeStreamMock.write).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('logs messages with context object', () => {
      testLogger.info('Message', { key: 'value' });
      expect(writeStreamMock.write).toHaveBeenCalled();
      const call = writeStreamMock.write.mock.calls[0][0];
      expect(call).toContain('Message');
      expect(call).toContain('"key": "value"');
    });

    it('logs messages with non-object context', () => {
      testLogger.info('Message', 'string context');
      expect(writeStreamMock.write).toHaveBeenCalled();
      const call = writeStreamMock.write.mock.calls[0][0];
      expect(call).toContain('Message');
      expect(call).toContain('string context');
    });

    it('handles context serialization errors', () => {
      const circularObj: any = { a: 1 };
      circularObj.self = circularObj;
      testLogger.info('Message', circularObj);
      expect(writeStreamMock.write).toHaveBeenCalled();
      const call = writeStreamMock.write.mock.calls[0][0];
      expect(call).toContain('[Unable to serialise context]');
    });

    it('respects log level threshold', () => {
      const infoLogger = new (Logger as any)({
        logLevel: LogLevel.INFO,
        logToFile: true,
        logToConsole: true
      });
      infoLogger.debug('Debug message');
      expect(writeStreamMock.write).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('only logs to file when console is disabled', () => {
      const fileOnlyLogger = new (Logger as any)({
        logLevel: LogLevel.DEBUG,
        logToFile: true,
        logToConsole: false
      });
      fileOnlyLogger.info('Message');
      expect(writeStreamMock.write).toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('only logs to console when file is disabled', () => {
      const consoleOnlyLogger = new (Logger as any)({
        logLevel: LogLevel.DEBUG,
        logToFile: false,
        logToConsole: true
      });
      consoleOnlyLogger.info('Message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('log rotation', () => {
    let testLogger: any;

    beforeEach(() => {
      testLogger = new (Logger as any)({
        logLevel: LogLevel.DEBUG,
        logToFile: true,
        logToConsole: false,
        maxFileSize: 100,
        maxFiles: 3
      });
    });

    it('rotates log files when size limit is reached during init', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.statSync as any).mockReturnValue({ size: 150 });
      (fs.unlinkSync as any).mockImplementation(() => {});
      (fs.renameSync as any).mockImplementation(() => {});
      
      const rotateLogger = new (Logger as any)({
        maxFileSize: 100,
        logToFile: true
      });
      
      expect(fs.renameSync).toHaveBeenCalled();
    });

    it('rotates log files when size limit is reached during logging', () => {
      // Mock file size to be over limit after write
      (fs.statSync as any).mockReturnValue({ size: 150 });
      (fs.existsSync as any).mockReturnValue(true);
      (fs.unlinkSync as any).mockImplementation(() => {});
      (fs.renameSync as any).mockImplementation(() => {});
      
      testLogger.info('Message that causes rotation');
      
      expect(writeStreamMock.end).toHaveBeenCalled();
      expect(fs.renameSync).toHaveBeenCalled();
    });

    it('handles rotation errors gracefully', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.statSync as any).mockReturnValue({ size: 150 });
      (fs.renameSync as any).mockImplementation(() => {
        throw new Error('Cannot rename file');
      });
      
      const rotateLogger = new (Logger as any)({
        maxFileSize: 100,
        logToFile: true
      });
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to rotate log files:', expect.any(Error));
    });

    it('deletes old files when rotating with multiple files', () => {
      // Set up mocks for maxFiles = 3 scenario
      let callCount = 0;
      (fs.existsSync as any).mockImplementation((file: string) => {
        callCount++;
        // First call checks if main log exists (in initLogFile)
        if (callCount === 1) return true;
        // During rotation, check for files
        if (file.endsWith('.2')) return true; // .2 exists and will be deleted
        if (file.endsWith('.1')) return true; // .1 exists
        if (!file.includes('.')) return true; // main file exists
        return false;
      });
      (fs.statSync as any).mockReturnValue({ size: 150 });
      (fs.unlinkSync as any).mockImplementation(() => {});
      (fs.renameSync as any).mockImplementation(() => {});
      
      const rotateLogger = new (Logger as any)({
        maxFileSize: 100,
        maxFiles: 3, // Allow up to 3 files
        logToFile: true
      });
      
      // With maxFiles=3, it should delete .2 when rotating .1 -> .2
      expect(fs.unlinkSync).toHaveBeenCalled();
    });
  });

  describe('utility methods', () => {
    let testLogger: any;

    beforeEach(() => {
      testLogger = new (Logger as any)({
        logToFile: true
      });
    });

    it('returns log file path', () => {
      const logPath = testLogger.getLogFilePath();
      expect(logPath).toBe(mockLogFile);
    });

    it('returns empty path when file logging is disabled', () => {
      const noFileLogger = new (Logger as any)({
        logToFile: false
      });
      const logPath = noFileLogger.getLogFilePath();
      expect(logPath).toBe('');
    });

    it('returns list of log files', () => {
      (fs.existsSync as any).mockImplementation((file: string) => {
        return file === mockLogFile || file === `${mockLogFile}.1`;
      });
      
      const files = testLogger.getLogFiles();
      expect(files).toHaveLength(2);
      expect(files).toContain(mockLogFile);
      expect(files).toContain(`${mockLogFile}.1`);
    });

    it('returns empty array when file logging is disabled', () => {
      const noFileLogger = new (Logger as any)({
        logToFile: false
      });
      const files = noFileLogger.getLogFiles();
      expect(files).toEqual([]);
    });

    it('closes write stream', () => {
      testLogger.close();
      expect(writeStreamMock.end).toHaveBeenCalled();
    });

    it('handles close when no stream exists', () => {
      const noFileLogger = new (Logger as any)({
        logToFile: false
      });
      expect(() => noFileLogger.close()).not.toThrow();
    });
  });

  describe('formatting', () => {
    let testLogger: any;

    beforeEach(() => {
      testLogger = new (Logger as any)({
        logLevel: LogLevel.DEBUG,
        logToFile: true,
        logToConsole: false
      });
    });

    it('formats timestamp correctly', () => {
      const timestamp = testLogger.formatTimestamp();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/);
    });

    it('gets correct level names', () => {
      expect(testLogger.getLevelName(LogLevel.DEBUG)).toBe('DEBUG');
      expect(testLogger.getLevelName(LogLevel.INFO)).toBe('INFO');
      expect(testLogger.getLevelName(LogLevel.WARN)).toBe('WARN');
      expect(testLogger.getLevelName(LogLevel.ERROR)).toBe('ERROR');
      expect(testLogger.getLevelName(LogLevel.FATAL)).toBe('FATAL');
      expect(testLogger.getLevelName(999)).toBe('UNKNOWN');
    });

    it('formats messages with proper structure', () => {
      const formatted = testLogger.formatMessage(LogLevel.INFO, 'Test message');
      expect(formatted).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\] \[INFO \s*\] Test message$/);
    });
  });

  describe('getInstance', () => {
    it('returns singleton instance', () => {
      const instance1 = Logger.getInstance();
      const instance2 = Logger.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('ignores config on subsequent calls', () => {
      const instance1 = Logger.getInstance({ logLevel: LogLevel.DEBUG });
      const instance2 = Logger.getInstance({ logLevel: LogLevel.ERROR });
      expect(instance1).toBe(instance2);
    });
  });
});