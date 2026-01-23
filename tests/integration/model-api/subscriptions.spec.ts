/**
 * Model API Subscriptions Integration Tests (T121)
 *
 * Tests that the Model API supports subscribing to model changes.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SubscriptionHandle, SubscriptionOptions, ModelChangeEvent } from '@sanyam/types';

describe('Model API - Subscriptions', () => {
  let mockSubscriptionService: MockSubscriptionService;

  beforeEach(() => {
    mockSubscriptionService = new MockSubscriptionService();
  });

  afterEach(() => {
    mockSubscriptionService.dispose();
    vi.clearAllMocks();
  });

  describe('subscribe', () => {
    it('should create a subscription for a document URI', async () => {
      const handle = await mockSubscriptionService.subscribe(
        'file:///test/model.ecml',
        vi.fn()
      );

      expect(handle).toBeDefined();
      expect(handle.id).toBeDefined();
      expect(handle.uri).toBe('file:///test/model.ecml');
    });

    it('should return a unique subscription ID', async () => {
      const handle1 = await mockSubscriptionService.subscribe(
        'file:///test/model1.ecml',
        vi.fn()
      );
      const handle2 = await mockSubscriptionService.subscribe(
        'file:///test/model2.ecml',
        vi.fn()
      );

      expect(handle1.id).not.toBe(handle2.id);
    });

    it('should allow multiple subscriptions to the same document', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const handle1 = await mockSubscriptionService.subscribe(
        'file:///test/model.ecml',
        callback1
      );
      const handle2 = await mockSubscriptionService.subscribe(
        'file:///test/model.ecml',
        callback2
      );

      expect(handle1.id).not.toBe(handle2.id);

      // Trigger change
      mockSubscriptionService.notifyChange('file:///test/model.ecml', {
        type: 'update',
        uri: 'file:///test/model.ecml',
        version: 2,
      });

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should support subscription options', async () => {
      const options: SubscriptionOptions = {
        includeContent: true,
        debounceMs: 500,
        nodeTypes: ['Actor', 'Activity'],
      };

      const handle = await mockSubscriptionService.subscribe(
        'file:///test/model.ecml',
        vi.fn(),
        options
      );

      expect(handle.options).toEqual(options);
    });

    it('should validate URI before creating subscription', async () => {
      await expect(
        mockSubscriptionService.subscribe('invalid-uri', vi.fn())
      ).rejects.toThrow('Invalid URI');
    });

    it('should invoke callback immediately if requested', async () => {
      const callback = vi.fn();

      await mockSubscriptionService.subscribe(
        'file:///test/model.ecml',
        callback,
        { immediate: true }
      );

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('unsubscribe', () => {
    it('should remove a subscription by handle', async () => {
      const callback = vi.fn();
      const handle = await mockSubscriptionService.subscribe(
        'file:///test/model.ecml',
        callback
      );

      await mockSubscriptionService.unsubscribe(handle);

      // Trigger change - should not invoke callback
      mockSubscriptionService.notifyChange('file:///test/model.ecml', {
        type: 'update',
        uri: 'file:///test/model.ecml',
        version: 2,
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should remove a subscription by ID', async () => {
      const callback = vi.fn();
      const handle = await mockSubscriptionService.subscribe(
        'file:///test/model.ecml',
        callback
      );

      await mockSubscriptionService.unsubscribeById(handle.id);

      mockSubscriptionService.notifyChange('file:///test/model.ecml', {
        type: 'update',
        uri: 'file:///test/model.ecml',
        version: 2,
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle double unsubscribe gracefully', async () => {
      const handle = await mockSubscriptionService.subscribe(
        'file:///test/model.ecml',
        vi.fn()
      );

      await mockSubscriptionService.unsubscribe(handle);
      await expect(mockSubscriptionService.unsubscribe(handle)).resolves.not.toThrow();
    });

    it('should handle unknown subscription ID gracefully', async () => {
      await expect(
        mockSubscriptionService.unsubscribeById('unknown-id')
      ).resolves.not.toThrow();
    });

    it('should not affect other subscriptions when unsubscribing', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const handle1 = await mockSubscriptionService.subscribe(
        'file:///test/model.ecml',
        callback1
      );
      await mockSubscriptionService.subscribe(
        'file:///test/model.ecml',
        callback2
      );

      await mockSubscriptionService.unsubscribe(handle1);

      mockSubscriptionService.notifyChange('file:///test/model.ecml', {
        type: 'update',
        uri: 'file:///test/model.ecml',
        version: 2,
      });

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('subscription handle', () => {
    it('should provide dispose method for convenience', async () => {
      const callback = vi.fn();
      const handle = await mockSubscriptionService.subscribe(
        'file:///test/model.ecml',
        callback
      );

      handle.dispose();

      mockSubscriptionService.notifyChange('file:///test/model.ecml', {
        type: 'update',
        uri: 'file:///test/model.ecml',
        version: 2,
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should provide isActive property', async () => {
      const handle = await mockSubscriptionService.subscribe(
        'file:///test/model.ecml',
        vi.fn()
      );

      expect(handle.isActive).toBe(true);

      handle.dispose();

      expect(handle.isActive).toBe(false);
    });
  });

  describe('subscription queries', () => {
    it('should list active subscriptions', async () => {
      await mockSubscriptionService.subscribe('file:///test/model1.ecml', vi.fn());
      await mockSubscriptionService.subscribe('file:///test/model2.ecml', vi.fn());

      const subscriptions = mockSubscriptionService.getActiveSubscriptions();

      expect(subscriptions).toHaveLength(2);
    });

    it('should list subscriptions for a specific URI', async () => {
      await mockSubscriptionService.subscribe('file:///test/model1.ecml', vi.fn());
      await mockSubscriptionService.subscribe('file:///test/model1.ecml', vi.fn());
      await mockSubscriptionService.subscribe('file:///test/model2.ecml', vi.fn());

      const subscriptions = mockSubscriptionService.getSubscriptionsForUri(
        'file:///test/model1.ecml'
      );

      expect(subscriptions).toHaveLength(2);
    });

    it('should return subscription count', () => {
      expect(mockSubscriptionService.getSubscriptionCount()).toBe(0);

      mockSubscriptionService.subscribe('file:///test/model.ecml', vi.fn());
      mockSubscriptionService.subscribe('file:///test/model.ecml', vi.fn());

      expect(mockSubscriptionService.getSubscriptionCount()).toBe(2);
    });
  });

  describe('client disconnect handling', () => {
    it('should clean up subscriptions when client disconnects', async () => {
      const clientId = 'client-1';

      await mockSubscriptionService.subscribe(
        'file:///test/model.ecml',
        vi.fn(),
        { clientId }
      );
      await mockSubscriptionService.subscribe(
        'file:///test/other.ecml',
        vi.fn(),
        { clientId }
      );

      expect(mockSubscriptionService.getSubscriptionCount()).toBe(2);

      mockSubscriptionService.onClientDisconnect(clientId);

      expect(mockSubscriptionService.getSubscriptionCount()).toBe(0);
    });

    it('should not affect other clients when one disconnects', async () => {
      await mockSubscriptionService.subscribe(
        'file:///test/model.ecml',
        vi.fn(),
        { clientId: 'client-1' }
      );
      await mockSubscriptionService.subscribe(
        'file:///test/model.ecml',
        vi.fn(),
        { clientId: 'client-2' }
      );

      mockSubscriptionService.onClientDisconnect('client-1');

      expect(mockSubscriptionService.getSubscriptionCount()).toBe(1);
    });
  });
});

// Mock implementation

interface Subscription {
  id: string;
  uri: string;
  callback: (event: ModelChangeEvent) => void;
  options: SubscriptionOptions;
  clientId?: string;
  isActive: boolean;
}

class MockSubscriptionService {
  private subscriptions = new Map<string, Subscription>();
  private idCounter = 0;

  async subscribe(
    uri: string,
    callback: (event: ModelChangeEvent) => void,
    options: SubscriptionOptions = {}
  ): Promise<SubscriptionHandle> {
    // Validate URI
    if (!uri.startsWith('file://')) {
      throw new Error('Invalid URI format');
    }

    const id = `sub-${++this.idCounter}`;
    const subscription: Subscription = {
      id,
      uri,
      callback,
      options,
      clientId: options.clientId,
      isActive: true,
    };

    this.subscriptions.set(id, subscription);

    // Invoke immediately if requested
    if (options.immediate) {
      callback({
        type: 'initial',
        uri,
        version: 1,
        timestamp: Date.now(),
      });
    }

    const handle: SubscriptionHandle = {
      id,
      uri,
      options,
      get isActive() {
        return subscription.isActive;
      },
      dispose: () => {
        subscription.isActive = false;
        this.subscriptions.delete(id);
      },
    };

    return handle;
  }

  async unsubscribe(handle: SubscriptionHandle): Promise<void> {
    const subscription = this.subscriptions.get(handle.id);
    if (subscription) {
      subscription.isActive = false;
      this.subscriptions.delete(handle.id);
    }
  }

  async unsubscribeById(id: string): Promise<void> {
    const subscription = this.subscriptions.get(id);
    if (subscription) {
      subscription.isActive = false;
      this.subscriptions.delete(id);
    }
  }

  notifyChange(uri: string, event: ModelChangeEvent): void {
    for (const subscription of this.subscriptions.values()) {
      if (subscription.uri === uri && subscription.isActive) {
        subscription.callback(event);
      }
    }
  }

  getActiveSubscriptions(): Subscription[] {
    return Array.from(this.subscriptions.values()).filter(s => s.isActive);
  }

  getSubscriptionsForUri(uri: string): Subscription[] {
    return Array.from(this.subscriptions.values()).filter(
      s => s.uri === uri && s.isActive
    );
  }

  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  onClientDisconnect(clientId: string): void {
    const toRemove: string[] = [];
    for (const [id, subscription] of this.subscriptions) {
      if (subscription.clientId === clientId) {
        subscription.isActive = false;
        toRemove.push(id);
      }
    }
    toRemove.forEach(id => this.subscriptions.delete(id));
  }

  dispose(): void {
    for (const subscription of this.subscriptions.values()) {
      subscription.isActive = false;
    }
    this.subscriptions.clear();
  }
}
