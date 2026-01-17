/**
 * Subscription Service Unit Tests (T131)
 *
 * Tests for subscription management and change notifications.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SubscriptionService,
  createSubscriptionService,
} from '../../../packages/sanyam-lsp/src/model/subscription-service.js';
import type { ModelChangeEvent, NodeChange } from '@sanyam/types';

describe('SubscriptionService', () => {
  let service: SubscriptionService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = createSubscriptionService({
      defaultDebounceMs: 100,
    });
  });

  afterEach(() => {
    service.dispose();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('subscribe', () => {
    it('should create a subscription', async () => {
      const callback = vi.fn();
      const handle = await service.subscribe('file:///test.ecml', callback);

      expect(handle.id).toBeDefined();
      expect(handle.uri).toBe('file:///test.ecml');
      expect(handle.isActive).toBe(true);
    });

    it('should generate unique IDs', async () => {
      const handle1 = await service.subscribe('file:///a.ecml', vi.fn());
      const handle2 = await service.subscribe('file:///b.ecml', vi.fn());

      expect(handle1.id).not.toBe(handle2.id);
    });

    it('should reject invalid URIs', async () => {
      await expect(
        service.subscribe('invalid-uri', vi.fn())
      ).rejects.toThrow('Invalid URI');
    });

    it('should accept untitled URIs', async () => {
      const handle = await service.subscribe('untitled:test', vi.fn());

      expect(handle).toBeDefined();
    });

    it('should send immediate notification when requested', async () => {
      const callback = vi.fn();

      await service.subscribe('file:///test.ecml', callback, {
        immediate: true,
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'initial' })
      );
    });

    it('should include content in immediate notification when requested', async () => {
      const mockContent = { $type: 'Model', elements: [] };
      const contentProvider = vi.fn().mockResolvedValue(mockContent);

      const serviceWithContent = createSubscriptionService({
        contentProvider,
      });

      const callback = vi.fn();
      await serviceWithContent.subscribe('file:///test.ecml', callback, {
        immediate: true,
        includeContent: true,
      });

      expect(contentProvider).toHaveBeenCalledWith('file:///test.ecml');
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ content: mockContent })
      );

      serviceWithContent.dispose();
    });
  });

  describe('unsubscribe', () => {
    it('should remove subscription by handle', async () => {
      const callback = vi.fn();
      const handle = await service.subscribe('file:///test.ecml', callback);

      await service.unsubscribe(handle);

      expect(handle.isActive).toBe(false);
      expect(service.getSubscriptionCount()).toBe(0);
    });

    it('should remove subscription by ID', async () => {
      const callback = vi.fn();
      const handle = await service.subscribe('file:///test.ecml', callback);

      await service.unsubscribeById(handle.id);

      expect(handle.isActive).toBe(false);
    });

    it('should handle double unsubscribe gracefully', async () => {
      const handle = await service.subscribe('file:///test.ecml', vi.fn());

      await service.unsubscribe(handle);
      await expect(service.unsubscribe(handle)).resolves.not.toThrow();
    });

    it('should handle unknown ID gracefully', async () => {
      await expect(service.unsubscribeById('unknown')).resolves.not.toThrow();
    });

    it('should stop receiving notifications after unsubscribe', async () => {
      const callback = vi.fn();
      const handle = await service.subscribe('file:///test.ecml', callback, {
        debounceMs: 0,
      });

      await service.unsubscribe(handle);

      service.notifyChange('file:///test.ecml', 'update', 2, []);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('notifyChange', () => {
    it('should notify subscribers of changes', async () => {
      const callback = vi.fn();
      await service.subscribe('file:///test.ecml', callback, { debounceMs: 0 });

      service.notifyChange('file:///test.ecml', 'update', 2, [
        { type: 'added', nodeId: 'node-1', nodeType: 'Actor' },
      ]);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'update',
          uri: 'file:///test.ecml',
          version: 2,
        })
      );
    });

    it('should not notify unrelated subscriptions', async () => {
      const callback = vi.fn();
      await service.subscribe('file:///other.ecml', callback, { debounceMs: 0 });

      service.notifyChange('file:///test.ecml', 'update', 2, []);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should notify multiple subscribers', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      await service.subscribe('file:///test.ecml', callback1, { debounceMs: 0 });
      await service.subscribe('file:///test.ecml', callback2, { debounceMs: 0 });

      service.notifyChange('file:///test.ecml', 'update', 2, []);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should include timestamp in notifications', async () => {
      const callback = vi.fn();
      await service.subscribe('file:///test.ecml', callback, { debounceMs: 0 });

      const before = Date.now();
      service.notifyChange('file:///test.ecml', 'update', 2, []);
      const after = Date.now();

      const event = callback.mock.calls[0][0] as ModelChangeEvent;
      expect(event.timestamp).toBeGreaterThanOrEqual(before);
      expect(event.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('debouncing', () => {
    it('should debounce rapid changes', async () => {
      const callback = vi.fn();
      await service.subscribe('file:///test.ecml', callback, { debounceMs: 500 });

      // Send multiple changes rapidly
      for (let i = 0; i < 5; i++) {
        service.notifyChange('file:///test.ecml', 'update', i + 1, [
          { type: 'modified', nodeId: `node-${i}`, nodeType: 'Actor' },
        ]);
      }

      // No callback yet
      expect(callback).not.toHaveBeenCalled();

      // Advance time past debounce
      vi.advanceTimersByTime(600);

      // Should receive single batched notification
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should batch changes within debounce window', async () => {
      const callback = vi.fn();
      await service.subscribe('file:///test.ecml', callback, { debounceMs: 500 });

      service.notifyChange('file:///test.ecml', 'update', 1, [
        { type: 'added', nodeId: 'node-1', nodeType: 'Actor' },
      ]);

      vi.advanceTimersByTime(100);

      service.notifyChange('file:///test.ecml', 'update', 2, [
        { type: 'added', nodeId: 'node-2', nodeType: 'Activity' },
      ]);

      vi.advanceTimersByTime(500);

      expect(callback).toHaveBeenCalledTimes(1);
      const event = callback.mock.calls[0][0] as ModelChangeEvent;
      expect(event.changes).toHaveLength(2);
      expect(event.version).toBe(2);
    });

    it('should deliver immediately with debounce 0', async () => {
      const callback = vi.fn();
      await service.subscribe('file:///test.ecml', callback, { debounceMs: 0 });

      service.notifyChange('file:///test.ecml', 'update', 1, []);

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('filtering', () => {
    it('should filter by node types', async () => {
      const callback = vi.fn();
      await service.subscribe('file:///test.ecml', callback, {
        nodeTypes: ['Actor'],
        debounceMs: 0,
      });

      service.notifyChange('file:///test.ecml', 'update', 1, [
        { type: 'added', nodeId: 'node-1', nodeType: 'Actor' },
        { type: 'added', nodeId: 'node-2', nodeType: 'Activity' },
      ]);

      expect(callback).toHaveBeenCalled();
      const event = callback.mock.calls[0][0] as ModelChangeEvent;
      expect(event.changes).toHaveLength(1);
      expect(event.changes![0].nodeType).toBe('Actor');
    });

    it('should not notify if no matching node types', async () => {
      const callback = vi.fn();
      await service.subscribe('file:///test.ecml', callback, {
        nodeTypes: ['Actor'],
        debounceMs: 0,
      });

      service.notifyChange('file:///test.ecml', 'update', 1, [
        { type: 'added', nodeId: 'node-1', nodeType: 'Activity' },
      ]);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should continue notifying other subscribers if one throws', async () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const successCallback = vi.fn();

      await service.subscribe('file:///test.ecml', errorCallback, { debounceMs: 0 });
      await service.subscribe('file:///test.ecml', successCallback, { debounceMs: 0 });

      service.notifyChange('file:///test.ecml', 'update', 1, []);

      expect(errorCallback).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalled();
    });

    it('should log errors from callbacks', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorCallback = vi.fn(() => {
        throw new Error('Test error');
      });

      await service.subscribe('file:///test.ecml', errorCallback, { debounceMs: 0 });

      service.notifyChange('file:///test.ecml', 'update', 1, []);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('client disconnect handling', () => {
    it('should clean up subscriptions on client disconnect', async () => {
      await service.subscribe('file:///a.ecml', vi.fn(), { clientId: 'client-1' });
      await service.subscribe('file:///b.ecml', vi.fn(), { clientId: 'client-1' });
      await service.subscribe('file:///c.ecml', vi.fn(), { clientId: 'client-2' });

      expect(service.getSubscriptionCount()).toBe(3);

      service.onClientDisconnect('client-1');

      expect(service.getSubscriptionCount()).toBe(1);
    });

    it('should not affect other clients', async () => {
      const callback2 = vi.fn();

      await service.subscribe('file:///test.ecml', vi.fn(), { clientId: 'client-1' });
      await service.subscribe('file:///test.ecml', callback2, { clientId: 'client-2', debounceMs: 0 });

      service.onClientDisconnect('client-1');

      service.notifyChange('file:///test.ecml', 'update', 1, []);

      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('queries', () => {
    it('should list active subscriptions', async () => {
      await service.subscribe('file:///a.ecml', vi.fn());
      await service.subscribe('file:///b.ecml', vi.fn());

      const subscriptions = service.getActiveSubscriptions();

      expect(subscriptions).toHaveLength(2);
    });

    it('should list subscriptions for URI', async () => {
      await service.subscribe('file:///a.ecml', vi.fn());
      await service.subscribe('file:///a.ecml', vi.fn());
      await service.subscribe('file:///b.ecml', vi.fn());

      const subscriptions = service.getSubscriptionsForUri('file:///a.ecml');

      expect(subscriptions).toHaveLength(2);
    });

    it('should return correct subscription count', async () => {
      expect(service.getSubscriptionCount()).toBe(0);

      await service.subscribe('file:///test.ecml', vi.fn());

      expect(service.getSubscriptionCount()).toBe(1);
    });
  });

  describe('dispose', () => {
    it('should clean up all subscriptions', async () => {
      await service.subscribe('file:///a.ecml', vi.fn());
      await service.subscribe('file:///b.ecml', vi.fn());

      service.dispose();

      expect(service.getSubscriptionCount()).toBe(0);
    });

    it('should clear pending timers', async () => {
      const callback = vi.fn();
      await service.subscribe('file:///test.ecml', callback, { debounceMs: 500 });

      service.notifyChange('file:///test.ecml', 'update', 1, []);
      service.dispose();

      vi.advanceTimersByTime(600);

      expect(callback).not.toHaveBeenCalled();
    });
  });
});

describe('createSubscriptionService', () => {
  it('should create a new service instance', () => {
    const service = createSubscriptionService();

    expect(service).toBeInstanceOf(SubscriptionService);

    service.dispose();
  });

  it('should accept custom configuration', () => {
    const logger = vi.fn();
    const service = createSubscriptionService({
      defaultDebounceMs: 200,
      logger,
    });

    expect(service).toBeDefined();

    service.dispose();
  });
});
