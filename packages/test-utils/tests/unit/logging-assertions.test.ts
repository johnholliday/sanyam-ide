/**
 * Unit tests for Logging Assertions
 *
 * Tests that verify warning and error logging behavior across cloud packages.
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Logging Assertions', () => {
  let originalConsole: {
    log: typeof console.log;
    warn: typeof console.warn;
    error: typeof console.error;
  };

  beforeEach(() => {
    // Save original console methods
    originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    };

    // Mock console methods
    console.log = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  describe('console.warn assertions', () => {
    it('should capture warning calls', () => {
      console.warn('This is a warning');

      expect(console.warn).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith('This is a warning');
    });

    it('should capture multiple warning calls', () => {
      console.warn('Warning 1');
      console.warn('Warning 2');
      console.warn('Warning 3');

      expect(console.warn).toHaveBeenCalledTimes(3);
    });

    it('should capture warnings with multiple arguments', () => {
      console.warn('Warning:', { context: 'test' }, 123);

      expect(console.warn).toHaveBeenCalledWith('Warning:', { context: 'test' }, 123);
    });

    it('should capture warnings containing specific substring', () => {
      console.warn('Authentication failed: invalid token');

      const calls = (console.warn as any).mock.calls;
      const hasAuthWarning = calls.some((args: unknown[]) =>
        args.some((arg) => typeof arg === 'string' && arg.includes('Authentication'))
      );

      expect(hasAuthWarning).toBe(true);
    });
  });

  describe('console.error assertions', () => {
    it('should capture error calls', () => {
      console.error('This is an error');

      expect(console.error).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('This is an error');
    });

    it('should capture Error objects', () => {
      const error = new Error('Test error');
      console.error('Error occurred:', error);

      expect(console.error).toHaveBeenCalled();
      const calls = (console.error as any).mock.calls;
      expect(calls[0]).toContainEqual(error);
    });

    it('should capture errors containing error codes', () => {
      console.error('[ERROR_CODE] Something went wrong');

      const calls = (console.error as any).mock.calls;
      const hasErrorCode = calls.some((args: unknown[]) =>
        args.some((arg) => typeof arg === 'string' && arg.includes('ERROR_CODE'))
      );

      expect(hasErrorCode).toBe(true);
    });

    it('should capture errors with stack traces', () => {
      const error = new Error('Test error with stack');
      console.error(error);

      const calls = (console.error as any).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][0]).toBeInstanceOf(Error);
      expect(calls[0][0].stack).toBeDefined();
    });
  });

  describe('Logging level checks', () => {
    it('should not log to error when using warn', () => {
      console.warn('Just a warning');

      expect(console.warn).toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    it('should not log to warn when using error', () => {
      console.error('An error occurred');

      expect(console.error).toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('should track call order across levels', () => {
      const callOrder: string[] = [];

      (console.log as any).mockImplementation(() => callOrder.push('log'));
      (console.warn as any).mockImplementation(() => callOrder.push('warn'));
      (console.error as any).mockImplementation(() => callOrder.push('error'));

      console.log('Info');
      console.warn('Warning');
      console.error('Error');
      console.log('More info');

      expect(callOrder).toEqual(['log', 'warn', 'error', 'log']);
    });
  });

  describe('Structured log assertions', () => {
    it('should capture JSON-structured logs', () => {
      const logEntry = {
        level: 'warn',
        message: 'Rate limit approaching',
        userId: 'user-123',
        remaining: 5,
      };

      console.warn(JSON.stringify(logEntry));

      const calls = (console.warn as any).mock.calls;
      const loggedJson = calls[0][0];
      const parsed = JSON.parse(loggedJson);

      expect(parsed.level).toBe('warn');
      expect(parsed.userId).toBe('user-123');
    });

    it('should capture logs with correlation ID', () => {
      const correlationId = 'req-abc-123';
      console.warn(`[${correlationId}] Slow operation detected`);

      const calls = (console.warn as any).mock.calls;
      const hasCorrelationId = calls.some((args: unknown[]) =>
        args.some((arg) => typeof arg === 'string' && arg.includes(correlationId))
      );

      expect(hasCorrelationId).toBe(true);
    });

    it('should capture logs with timestamps', () => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] Operation completed`);

      const calls = (console.log as any).mock.calls;
      expect(calls[0][0]).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Error categorization', () => {
    it('should identify authentication errors', () => {
      console.error('Authentication error: token expired');
      console.error('Login failed: invalid credentials');

      const calls = (console.error as any).mock.calls;
      const authErrors = calls.filter((args: unknown[]) =>
        args.some(
          (arg) =>
            typeof arg === 'string' &&
            (arg.includes('Authentication') || arg.includes('Login'))
        )
      );

      expect(authErrors.length).toBe(2);
    });

    it('should identify network errors', () => {
      console.error('Network error: connection refused');
      console.error('ECONNRESET: socket hang up');

      const calls = (console.error as any).mock.calls;
      const networkErrors = calls.filter((args: unknown[]) =>
        args.some(
          (arg) =>
            typeof arg === 'string' &&
            (arg.includes('Network') || arg.includes('ECONN'))
        )
      );

      expect(networkErrors.length).toBe(2);
    });

    it('should identify validation errors', () => {
      console.warn('Validation error: email format invalid');
      console.warn('Schema validation failed for field: name');

      const calls = (console.warn as any).mock.calls;
      const validationWarnings = calls.filter((args: unknown[]) =>
        args.some(
          (arg) =>
            typeof arg === 'string' &&
            (arg.includes('Validation') || arg.includes('validation'))
        )
      );

      expect(validationWarnings.length).toBe(2);
    });
  });

  describe('Log filtering helpers', () => {
    it('should filter logs by level', () => {
      console.log('Info message');
      console.warn('Warning message');
      console.error('Error message');

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it('should filter logs by content pattern', () => {
      console.warn('User action: created document');
      console.warn('User action: deleted document');
      console.warn('System: cleanup completed');

      const calls = (console.warn as any).mock.calls;
      const userActions = calls.filter((args: unknown[]) =>
        args.some((arg) => typeof arg === 'string' && arg.startsWith('User action:'))
      );

      expect(userActions.length).toBe(2);
    });

    it('should filter logs by object property', () => {
      console.warn({ type: 'security', message: 'Failed login attempt' });
      console.warn({ type: 'performance', message: 'Slow query detected' });
      console.warn({ type: 'security', message: 'Suspicious activity' });

      const calls = (console.warn as any).mock.calls;
      const securityLogs = calls.filter((args: unknown[]) =>
        args.some((arg) => typeof arg === 'object' && arg !== null && (arg as any).type === 'security')
      );

      expect(securityLogs.length).toBe(2);
    });
  });

  describe('Assert no errors/warnings', () => {
    it('should verify no errors were logged', () => {
      // Perform operation that should not log errors
      const result = 1 + 1;
      expect(result).toBe(2);

      // Verify no errors were logged
      expect(console.error).not.toHaveBeenCalled();
    });

    it('should verify no warnings were logged', () => {
      // Perform operation that should not log warnings
      const items = [1, 2, 3];
      expect(items.length).toBe(3);

      // Verify no warnings were logged
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('should verify clean operation (no errors or warnings)', () => {
      // Simulate clean operation
      const operation = () => ({ success: true });
      const result = operation();

      expect(result.success).toBe(true);
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});
