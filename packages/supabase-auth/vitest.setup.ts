/**
 * Vitest setup file for @sanyam/supabase-auth package
 *
 * This file is automatically loaded before each test file via vitest.workspace.ts.
 * It sets up the environment for testing Inversify-based Supabase auth services.
 */

import 'reflect-metadata';

// Mock Theia imports that aren't available in test environment
vi.mock('@theia/core', () => ({
  Disposable: {
    NULL: { dispose: () => {} },
    create: (fn: () => void) => ({ dispose: fn }),
  },
  DisposableCollection: class {
    private items: Array<{ dispose: () => void }> = [];
    push(item: { dispose: () => void }) {
      this.items.push(item);
    }
    dispose() {
      this.items.forEach((item) => item.dispose());
      this.items = [];
    }
  },
  Emitter: class<T> {
    private listeners: Array<(e: T) => void> = [];
    event = (listener: (e: T) => void) => {
      this.listeners.push(listener);
      return { dispose: () => this.listeners.splice(this.listeners.indexOf(listener), 1) };
    };
    fire(event: T) {
      this.listeners.forEach((l) => l(event));
    }
    dispose() {
      this.listeners = [];
    }
  },
}));

import { vi, beforeEach, afterEach } from 'vitest';

// Reset modules between tests to ensure clean state
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
