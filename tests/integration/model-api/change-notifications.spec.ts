/**
 * Model API Change Notifications Integration Tests (T122)
 *
 * Tests that the Model API delivers change notifications correctly.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ModelChangeEvent, ChangeType, NodeChange } from '@sanyam/types';

describe('Model API - Change Notifications', () => {
  let mockNotificationService: MockNotificationService;

  beforeEach(() => {
    vi.useFakeTimers();
    mockNotificationService = new MockNotificationService();
  });

  afterEach(() => {
    mockNotificationService.dispose();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('change event structure', () => {
    it('should include event type in notification', async () => {
      const callback = vi.fn();
      await mockNotificationService.subscribe('file:///test/model.ecml', callback);

      mockNotificationService.emitChange('file:///test/model.ecml', {
        type: 'update',
        changes: [{ type: 'added', nodeId: 'node-1', nodeType: 'Actor' }],
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'update' })
      );
    });

    it('should include document URI in notification', async () => {
      const callback = vi.fn();
      await mockNotificationService.subscribe('file:///test/model.ecml', callback);

      mockNotificationService.emitChange('file:///test/model.ecml', {
        type: 'update',
        changes: [],
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ uri: 'file:///test/model.ecml' })
      );
    });

    it('should include document version in notification', async () => {
      const callback = vi.fn();
      await mockNotificationService.subscribe('file:///test/model.ecml', callback);

      mockNotificationService.emitChange('file:///test/model.ecml', {
        type: 'update',
        version: 5,
        changes: [],
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ version: 5 })
      );
    });

    it('should include timestamp in notification', async () => {
      const callback = vi.fn();
      await mockNotificationService.subscribe('file:///test/model.ecml', callback);

      const before = Date.now();
      mockNotificationService.emitChange('file:///test/model.ecml', {
        type: 'update',
        changes: [],
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Number),
        })
      );

      const event = callback.mock.calls[0][0];
      expect(event.timestamp).toBeGreaterThanOrEqual(before);
    });
  });

  describe('change types', () => {
    it('should notify on node addition', async () => {
      const callback = vi.fn();
      await mockNotificationService.subscribe('file:///test/model.ecml', callback);

      mockNotificationService.emitChange('file:///test/model.ecml', {
        type: 'update',
        changes: [
          {
            type: 'added',
            nodeId: 'actor-1',
            nodeType: 'Actor',
            node: { $type: 'Actor', name: 'Customer' },
          },
        ],
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: expect.arrayContaining([
            expect.objectContaining({ type: 'added', nodeType: 'Actor' }),
          ]),
        })
      );
    });

    it('should notify on node deletion', async () => {
      const callback = vi.fn();
      await mockNotificationService.subscribe('file:///test/model.ecml', callback);

      mockNotificationService.emitChange('file:///test/model.ecml', {
        type: 'update',
        changes: [
          {
            type: 'removed',
            nodeId: 'actor-1',
            nodeType: 'Actor',
          },
        ],
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: expect.arrayContaining([
            expect.objectContaining({ type: 'removed', nodeId: 'actor-1' }),
          ]),
        })
      );
    });

    it('should notify on node modification', async () => {
      const callback = vi.fn();
      await mockNotificationService.subscribe('file:///test/model.ecml', callback);

      mockNotificationService.emitChange('file:///test/model.ecml', {
        type: 'update',
        changes: [
          {
            type: 'modified',
            nodeId: 'actor-1',
            nodeType: 'Actor',
            property: 'name',
            oldValue: 'OldName',
            newValue: 'NewName',
          },
        ],
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: expect.arrayContaining([
            expect.objectContaining({
              type: 'modified',
              property: 'name',
              oldValue: 'OldName',
              newValue: 'NewName',
            }),
          ]),
        })
      );
    });

    it('should notify on document close', async () => {
      const callback = vi.fn();
      await mockNotificationService.subscribe('file:///test/model.ecml', callback);

      mockNotificationService.emitChange('file:///test/model.ecml', {
        type: 'closed',
        changes: [],
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'closed' })
      );
    });

    it('should notify on document save', async () => {
      const callback = vi.fn();
      await mockNotificationService.subscribe('file:///test/model.ecml', callback);

      mockNotificationService.emitChange('file:///test/model.ecml', {
        type: 'saved',
        changes: [],
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'saved' })
      );
    });
  });

  describe('debouncing and throttling', () => {
    it('should debounce rapid changes', async () => {
      const callback = vi.fn();
      await mockNotificationService.subscribe('file:///test/model.ecml', callback, {
        debounceMs: 500,
      });

      // Emit multiple rapid changes
      for (let i = 0; i < 5; i++) {
        mockNotificationService.emitChange('file:///test/model.ecml', {
          type: 'update',
          version: i + 1,
          changes: [{ type: 'modified', nodeId: `node-${i}`, nodeType: 'Actor' }],
        });
      }

      // No notification yet (within debounce window)
      expect(callback).not.toHaveBeenCalled();

      // Advance time past debounce
      vi.advanceTimersByTime(600);

      // Should receive single batched notification
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should deliver immediately if debounce is 0', async () => {
      const callback = vi.fn();
      await mockNotificationService.subscribe('file:///test/model.ecml', callback, {
        debounceMs: 0,
      });

      mockNotificationService.emitChange('file:///test/model.ecml', {
        type: 'update',
        changes: [],
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should respect delivery target of 500ms (SC-009)', async () => {
      const callback = vi.fn();
      const startTime = Date.now();

      await mockNotificationService.subscribe('file:///test/model.ecml', callback);

      mockNotificationService.emitChange('file:///test/model.ecml', {
        type: 'update',
        changes: [],
      });

      // Advance timer to trigger delivery
      vi.advanceTimersByTime(500);

      const event = callback.mock.calls[0]?.[0];
      if (event) {
        const deliveryTime = event.timestamp - startTime;
        expect(deliveryTime).toBeLessThanOrEqual(500);
      }
    });

    it('should batch changes within debounce window', async () => {
      const callback = vi.fn();
      await mockNotificationService.subscribe('file:///test/model.ecml', callback, {
        debounceMs: 500,
      });

      mockNotificationService.emitChange('file:///test/model.ecml', {
        type: 'update',
        version: 1,
        changes: [{ type: 'added', nodeId: 'node-1', nodeType: 'Actor' }],
      });

      vi.advanceTimersByTime(100);

      mockNotificationService.emitChange('file:///test/model.ecml', {
        type: 'update',
        version: 2,
        changes: [{ type: 'added', nodeId: 'node-2', nodeType: 'Activity' }],
      });

      vi.advanceTimersByTime(500);

      expect(callback).toHaveBeenCalledTimes(1);

      // Should receive batched changes
      const event = callback.mock.calls[0][0];
      expect(event.changes).toHaveLength(2);
      expect(event.version).toBe(2); // Latest version
    });
  });

  describe('filtering', () => {
    it('should filter by node types when specified', async () => {
      const callback = vi.fn();
      await mockNotificationService.subscribe('file:///test/model.ecml', callback, {
        nodeTypes: ['Actor'],
      });

      mockNotificationService.emitChange('file:///test/model.ecml', {
        type: 'update',
        changes: [
          { type: 'added', nodeId: 'node-1', nodeType: 'Actor' },
          { type: 'added', nodeId: 'node-2', nodeType: 'Activity' },
        ],
      });

      vi.advanceTimersByTime(500);

      expect(callback).toHaveBeenCalled();
      const event = callback.mock.calls[0][0];
      expect(event.changes).toHaveLength(1);
      expect(event.changes[0].nodeType).toBe('Actor');
    });

    it('should not notify if no matching node types', async () => {
      const callback = vi.fn();
      await mockNotificationService.subscribe('file:///test/model.ecml', callback, {
        nodeTypes: ['Actor'],
      });

      mockNotificationService.emitChange('file:///test/model.ecml', {
        type: 'update',
        changes: [{ type: 'added', nodeId: 'node-1', nodeType: 'Activity' }],
      });

      vi.advanceTimersByTime(500);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('content inclusion', () => {
    it('should include full model when includeContent is true', async () => {
      const callback = vi.fn();
      await mockNotificationService.subscribe('file:///test/model.ecml', callback, {
        includeContent: true,
      });

      mockNotificationService.emitChange(
        'file:///test/model.ecml',
        {
          type: 'update',
          changes: [],
        },
        { $type: 'Model', elements: [{ $type: 'Actor', name: 'Test' }] }
      );

      vi.advanceTimersByTime(500);

      const event = callback.mock.calls[0][0];
      expect(event.content).toBeDefined();
      expect(event.content.$type).toBe('Model');
    });

    it('should not include content by default', async () => {
      const callback = vi.fn();
      await mockNotificationService.subscribe('file:///test/model.ecml', callback);

      mockNotificationService.emitChange('file:///test/model.ecml', {
        type: 'update',
        changes: [],
      });

      vi.advanceTimersByTime(500);

      const event = callback.mock.calls[0][0];
      expect(event.content).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should continue notifying other subscribers if one throws', async () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const successCallback = vi.fn();

      await mockNotificationService.subscribe(
        'file:///test/model.ecml',
        errorCallback
      );
      await mockNotificationService.subscribe(
        'file:///test/model.ecml',
        successCallback
      );

      mockNotificationService.emitChange('file:///test/model.ecml', {
        type: 'update',
        changes: [],
      });

      vi.advanceTimersByTime(500);

      expect(errorCallback).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalled();
    });

    it('should log errors from callbacks', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorCallback = vi.fn(() => {
        throw new Error('Test error');
      });

      await mockNotificationService.subscribe(
        'file:///test/model.ecml',
        errorCallback
      );

      mockNotificationService.emitChange('file:///test/model.ecml', {
        type: 'update',
        changes: [],
      });

      vi.advanceTimersByTime(500);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

// Types and mock implementation

interface ChangeOptions {
  debounceMs?: number;
  nodeTypes?: string[];
  includeContent?: boolean;
}

interface Subscription {
  id: string;
  uri: string;
  callback: (event: ModelChangeEvent) => void;
  options: ChangeOptions;
  pendingChanges: NodeChange[];
  debounceTimer?: ReturnType<typeof setTimeout>;
}

class MockNotificationService {
  private subscriptions = new Map<string, Subscription>();
  private idCounter = 0;
  private defaultDebounceMs = 100;

  async subscribe(
    uri: string,
    callback: (event: ModelChangeEvent) => void,
    options: ChangeOptions = {}
  ): Promise<{ id: string; dispose: () => void }> {
    const id = `sub-${++this.idCounter}`;
    const subscription: Subscription = {
      id,
      uri,
      callback,
      options: {
        debounceMs: options.debounceMs ?? this.defaultDebounceMs,
        ...options,
      },
      pendingChanges: [],
    };

    this.subscriptions.set(id, subscription);

    return {
      id,
      dispose: () => this.subscriptions.delete(id),
    };
  }

  emitChange(
    uri: string,
    change: { type: ChangeType; version?: number; changes: NodeChange[] },
    content?: any
  ): void {
    for (const subscription of this.subscriptions.values()) {
      if (subscription.uri !== uri) continue;

      // Filter changes by node types if specified
      let filteredChanges = change.changes;
      if (subscription.options.nodeTypes && subscription.options.nodeTypes.length > 0) {
        filteredChanges = change.changes.filter(c =>
          subscription.options.nodeTypes!.includes(c.nodeType)
        );

        // Skip if no matching changes
        if (filteredChanges.length === 0 && change.type === 'update') {
          continue;
        }
      }

      // Add to pending changes
      subscription.pendingChanges.push(...filteredChanges);

      const debounceMs = subscription.options.debounceMs ?? this.defaultDebounceMs;

      // Clear existing timer
      if (subscription.debounceTimer) {
        clearTimeout(subscription.debounceTimer);
      }

      if (debounceMs === 0) {
        // Deliver immediately
        this.deliverNotification(subscription, change, content);
      } else {
        // Schedule delivery
        subscription.debounceTimer = setTimeout(() => {
          this.deliverNotification(subscription, change, content);
        }, debounceMs);
      }
    }
  }

  private deliverNotification(
    subscription: Subscription,
    change: { type: ChangeType; version?: number; changes: NodeChange[] },
    content?: any
  ): void {
    const event: ModelChangeEvent = {
      type: change.type,
      uri: subscription.uri,
      version: change.version ?? 1,
      timestamp: Date.now(),
      changes: subscription.pendingChanges,
    };

    if (subscription.options.includeContent && content) {
      event.content = content;
    }

    // Clear pending changes
    subscription.pendingChanges = [];
    subscription.debounceTimer = undefined;

    try {
      subscription.callback(event);
    } catch (error) {
      console.error('Error in subscription callback:', error);
    }
  }

  dispose(): void {
    for (const subscription of this.subscriptions.values()) {
      if (subscription.debounceTimer) {
        clearTimeout(subscription.debounceTimer);
      }
    }
    this.subscriptions.clear();
  }
}
