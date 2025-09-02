import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../src/logger';

// Mock console methods
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Logger', () => {
  describe('logging methods', () => {
    it('has info method', () => {
      expect(typeof logger.info).toBe('function');
      logger.info('Test info message');
      // Just verify it doesn't throw
    });

    it('has error method', () => {
      expect(typeof logger.error).toBe('function');
      logger.error('Test error message');
      // Just verify it doesn't throw
    });

    it('has warn method', () => {
      expect(typeof logger.warn).toBe('function');
      logger.warn('Test warning message');
      // Just verify it doesn't throw
    });

    it('has debug method', () => {
      expect(typeof logger.debug).toBe('function');
      logger.debug('Test debug message');
      // Just verify it doesn't throw
    });

    it('has fatal method', () => {
      expect(typeof logger.fatal).toBe('function');
      // Don't actually call fatal as it might exit
    });
  });

  describe('metadata handling', () => {
    it('handles metadata in log calls', () => {
      const metadata = { 
        userId: '123', 
        action: 'test'
      };
      
      // Should not throw
      expect(() => logger.info('Test with metadata', metadata)).not.toThrow();
    });

    it('handles undefined metadata', () => {
      // Should not throw
      expect(() => logger.info('Test without metadata')).not.toThrow();
    });

    it('handles circular references in metadata', () => {
      const circular: any = { a: 1 };
      circular.self = circular;
      
      // Should not throw
      expect(() => logger.info('Circular test', circular)).not.toThrow();
    });
  });

});