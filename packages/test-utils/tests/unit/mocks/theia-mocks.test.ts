/**
 * Unit tests for Theia mock implementations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMockSecretStorage } from '../../../src/mocks/secret-storage.js';
import { createMockAuthenticationService } from '../../../src/mocks/authentication-service.js';
import { createMockCommandRegistry } from '../../../src/mocks/command-registry.js';
import { createLoggingMock } from '../../../src/mocks/logging-mock.js';

describe('MockSecretStorage', () => {
  it('should store and retrieve secrets', async () => {
    const storage = createMockSecretStorage();

    await storage.set('api-key', 'secret123');
    const value = await storage.get('api-key');

    expect(value).toBe('secret123');
  });

  it('should return undefined for non-existent keys', async () => {
    const storage = createMockSecretStorage();

    const value = await storage.get('nonexistent');

    expect(value).toBeUndefined();
  });

  it('should delete secrets', async () => {
    const storage = createMockSecretStorage();

    await storage.set('key', 'value');
    await storage.delete('key');
    const value = await storage.get('key');

    expect(value).toBeUndefined();
  });

  it('should expose store for test assertions', async () => {
    const storage = createMockSecretStorage();

    await storage.set('key1', 'value1');
    await storage.set('key2', 'value2');

    expect(storage.store.size).toBe(2);
    expect(storage.store.has('key1')).toBe(true);
    expect(storage.store.get('key1')).toBe('value1');
  });

  it('should overwrite existing values', async () => {
    const storage = createMockSecretStorage();

    await storage.set('key', 'old');
    await storage.set('key', 'new');
    const value = await storage.get('key');

    expect(value).toBe('new');
  });
});

describe('MockAuthenticationService', () => {
  it('should register authentication providers', () => {
    const service = createMockAuthenticationService();

    const provider = {
      id: 'test-provider',
      label: 'Test Auth',
      createSession: async () => ({
        id: 'session-1',
        accessToken: 'token',
        account: { id: 'user-1', label: 'User' },
        scopes: ['read'],
      }),
      removeSession: async () => {},
    };

    service.registerAuthenticationProvider('test-provider', provider);

    expect(service.providers.has('test-provider')).toBe(true);
    expect(service.getProvider('test-provider')).toBe(provider);
  });

  it('should return undefined for non-existent providers', () => {
    const service = createMockAuthenticationService();

    expect(service.getProvider('nonexistent')).toBeUndefined();
  });

  it('should allow registering multiple providers', () => {
    const service = createMockAuthenticationService();

    const provider1 = {
      id: 'provider1',
      label: 'Provider 1',
      createSession: async () => ({
        id: 's1',
        accessToken: 't1',
        account: { id: 'u1', label: 'U1' },
        scopes: [],
      }),
      removeSession: async () => {},
    };

    const provider2 = {
      id: 'provider2',
      label: 'Provider 2',
      createSession: async () => ({
        id: 's2',
        accessToken: 't2',
        account: { id: 'u2', label: 'U2' },
        scopes: [],
      }),
      removeSession: async () => {},
    };

    service.registerAuthenticationProvider('provider1', provider1);
    service.registerAuthenticationProvider('provider2', provider2);

    expect(service.providers.size).toBe(2);
  });
});

describe('MockCommandRegistry', () => {
  it('should register commands', () => {
    const registry = createMockCommandRegistry();

    registry.registerCommand('my.command', () => 'result');

    expect(registry.hasCommand('my.command')).toBe(true);
  });

  it('should execute registered commands', async () => {
    const registry = createMockCommandRegistry();

    registry.registerCommand('add', (a: number, b: number) => a + b);

    const result = await registry.executeCommand<number>('add', 5, 3);

    expect(result).toBe(8);
  });

  it('should throw on executing non-existent command', async () => {
    const registry = createMockCommandRegistry();

    await expect(registry.executeCommand('nonexistent')).rejects.toThrow(
      'Command not found: nonexistent'
    );
  });

  it('should handle async command handlers', async () => {
    const registry = createMockCommandRegistry();

    registry.registerCommand('async.cmd', async () => {
      await new Promise((r) => setTimeout(r, 10));
      return 'async result';
    });

    const result = await registry.executeCommand<string>('async.cmd');

    expect(result).toBe('async result');
  });

  it('should dispose commands', () => {
    const registry = createMockCommandRegistry();

    const disposable = registry.registerCommand('temp.cmd', () => {});
    expect(registry.hasCommand('temp.cmd')).toBe(true);

    disposable.dispose();
    expect(registry.hasCommand('temp.cmd')).toBe(false);
  });

  it('should expose commands map', () => {
    const registry = createMockCommandRegistry();

    registry.registerCommand('cmd1', () => 1);
    registry.registerCommand('cmd2', () => 2);

    expect(registry.commands.size).toBe(2);
    expect(registry.commands.has('cmd1')).toBe(true);
    expect(registry.commands.has('cmd2')).toBe(true);
  });
});

describe('LoggingMock', () => {
  it('should capture log calls when installed', () => {
    const mock = createLoggingMock();
    mock.install();

    try {
      console.log('Test message');
      console.error('Error message');
      console.warn('Warning message');
      console.debug('Debug message');

      expect(mock.getByLevel('info')).toHaveLength(1);
      expect(mock.getByLevel('error')).toHaveLength(1);
      expect(mock.getByLevel('warn')).toHaveLength(1);
      expect(mock.getByLevel('debug')).toHaveLength(1);
    } finally {
      mock.uninstall();
    }
  });

  it('should check for log containing substring', () => {
    const mock = createLoggingMock();
    mock.install();

    try {
      console.log('Hello world');
      console.error('Something went wrong');

      expect(mock.hasLogContaining('info', 'Hello')).toBe(true);
      expect(mock.hasLogContaining('info', 'world')).toBe(true);
      expect(mock.hasLogContaining('info', 'missing')).toBe(false);
      expect(mock.hasLogContaining('error', 'wrong')).toBe(true);
    } finally {
      mock.uninstall();
    }
  });

  it('should clear logs', () => {
    const mock = createLoggingMock();
    mock.install();

    try {
      console.log('Message 1');
      console.log('Message 2');
      expect(mock.getByLevel('info')).toHaveLength(2);

      mock.clear();
      expect(mock.getByLevel('info')).toHaveLength(0);
    } finally {
      mock.uninstall();
    }
  });

  it('should still call original console methods', () => {
    const mock = createLoggingMock();
    const originalLog = console.log;
    let called = false;

    // Temporarily replace to track calls
    console.log = (...args: unknown[]) => {
      called = true;
      originalLog(...args);
    };

    mock.install();

    try {
      // Our mock's original is the tracking function
      console.log('Test');
      expect(called).toBe(true);
    } finally {
      mock.uninstall();
      console.log = originalLog;
    }
  });

  it('should be safe to install/uninstall multiple times', () => {
    const mock = createLoggingMock();

    // Multiple installs should be idempotent
    mock.install();
    mock.install();

    console.log('Test');
    expect(mock.getByLevel('info')).toHaveLength(1);

    // Multiple uninstalls should be safe
    mock.uninstall();
    mock.uninstall();

    // Should no longer capture
    mock.clear();
    console.log('After uninstall');
    expect(mock.getByLevel('info')).toHaveLength(0);
  });

  it('should capture log arguments', () => {
    const mock = createLoggingMock();
    mock.install();

    try {
      console.log('Message', { extra: 'data' }, 123);

      const logs = mock.getByLevel('info');
      expect(logs).toHaveLength(1);
      expect(logs[0]?.message).toBe('Message');
      expect(logs[0]?.args).toEqual([{ extra: 'data' }, 123]);
    } finally {
      mock.uninstall();
    }
  });

  it('should record timestamps', () => {
    const mock = createLoggingMock();
    mock.install();

    try {
      const before = Date.now();
      console.log('Test');
      const after = Date.now();

      const logs = mock.getByLevel('info');
      expect(logs[0]?.timestamp).toBeGreaterThanOrEqual(before);
      expect(logs[0]?.timestamp).toBeLessThanOrEqual(after);
    } finally {
      mock.uninstall();
    }
  });
});
