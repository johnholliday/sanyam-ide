/**
 * Subscription Service (T124, T127, T128, T129)
 *
 * Manages client subscriptions for Model API change notifications.
 * Features:
 * - Document-based subscription management
 * - Change notification with debouncing (500ms target per SC-009)
 * - Node type filtering
 * - Client disconnect cleanup
 * - Content inclusion option
 *
 * @packageDocumentation
 */

import type {
  SubscriptionOptions,
  SubscriptionHandle,
  ModelChangeEvent,
  ChangeType,
  NodeChange,
} from '@sanyam/types';

/**
 * Default debounce time in milliseconds (SC-009 target).
 */
const DEFAULT_DEBOUNCE_MS = 100;

/**
 * Maximum debounce time to ensure timely delivery.
 */
const MAX_DEBOUNCE_MS = 500;

/**
 * Callback function for change notifications.
 */
export type ChangeCallback = (event: ModelChangeEvent) => void;

/**
 * Internal subscription record.
 */
interface Subscription {
  id: string;
  uri: string;
  callback: ChangeCallback;
  options: SubscriptionOptions;
  clientId?: string;
  isActive: boolean;
  pendingChanges: NodeChange[];
  pendingVersion?: number;
  debounceTimer?: ReturnType<typeof setTimeout>;
  lastNotified?: number;
}

/**
 * Content provider function to get full model content.
 */
export type ContentProvider = (uri: string) => unknown | Promise<unknown>;

/**
 * Service configuration.
 */
export interface SubscriptionServiceConfig {
  /** Default debounce time in ms */
  defaultDebounceMs?: number;
  /** Maximum debounce time in ms */
  maxDebounceMs?: number;
  /** Content provider for includeContent option */
  contentProvider?: ContentProvider;
  /** Logger function */
  logger?: (message: string) => void;
}

/**
 * Service for managing Model API subscriptions.
 */
export class SubscriptionService {
  private subscriptions = new Map<string, Subscription>();
  private subscriptionsByUri = new Map<string, Set<string>>();
  private subscriptionsByClient = new Map<string, Set<string>>();
  private idCounter = 0;
  private config: Required<SubscriptionServiceConfig>;

  constructor(config?: SubscriptionServiceConfig) {
    this.config = {
      defaultDebounceMs: config?.defaultDebounceMs ?? DEFAULT_DEBOUNCE_MS,
      maxDebounceMs: config?.maxDebounceMs ?? MAX_DEBOUNCE_MS,
      contentProvider: config?.contentProvider ?? (() => undefined),
      logger: config?.logger ?? (() => {}),
    };
  }

  /**
   * Subscribe to changes for a document.
   *
   * @param uri - Document URI to subscribe to
   * @param callback - Function to call when changes occur
   * @param options - Subscription options
   * @returns Handle to manage the subscription
   */
  async subscribe(
    uri: string,
    callback: ChangeCallback,
    options: SubscriptionOptions = {}
  ): Promise<SubscriptionHandle> {
    // Validate URI
    if (!this.isValidUri(uri)) {
      throw new Error('Invalid URI format');
    }

    const id = this.generateId();
    const subscription: Subscription = {
      id,
      uri,
      callback,
      options: {
        debounceMs: this.clampDebounce(options.debounceMs),
        ...options,
      },
      clientId: options.clientId,
      isActive: true,
      pendingChanges: [],
    };

    // Store subscription
    this.subscriptions.set(id, subscription);

    // Index by URI
    if (!this.subscriptionsByUri.has(uri)) {
      this.subscriptionsByUri.set(uri, new Set());
    }
    this.subscriptionsByUri.get(uri)!.add(id);

    // Index by client if provided
    if (options.clientId) {
      if (!this.subscriptionsByClient.has(options.clientId)) {
        this.subscriptionsByClient.set(options.clientId, new Set());
      }
      this.subscriptionsByClient.get(options.clientId)!.add(id);
    }

    this.config.logger(`Created subscription ${id} for ${uri}`);

    // Create handle
    const handle: SubscriptionHandle = {
      id,
      uri,
      options,
      get isActive() {
        return subscription.isActive;
      },
      dispose: () => {
        this.unsubscribeById(id);
      },
    };

    // Send immediate notification if requested
    if (options.immediate) {
      const content = options.includeContent
        ? await this.config.contentProvider(uri)
        : undefined;

      this.deliverNotification(subscription, {
        type: 'initial',
        uri,
        version: 1,
        timestamp: Date.now(),
        changes: [],
        content,
      });
    }

    return handle;
  }

  /**
   * Unsubscribe using a handle.
   */
  async unsubscribe(handle: SubscriptionHandle): Promise<void> {
    await this.unsubscribeById(handle.id);
  }

  /**
   * Unsubscribe by subscription ID.
   */
  async unsubscribeById(id: string): Promise<void> {
    const subscription = this.subscriptions.get(id);
    if (!subscription) {
      return; // Already unsubscribed
    }

    // Mark inactive
    subscription.isActive = false;

    // Clear pending timer
    if (subscription.debounceTimer) {
      clearTimeout(subscription.debounceTimer);
    }

    // Remove from indexes
    this.subscriptionsByUri.get(subscription.uri)?.delete(id);
    if (subscription.clientId) {
      this.subscriptionsByClient.get(subscription.clientId)?.delete(id);
    }

    // Remove subscription
    this.subscriptions.delete(id);

    this.config.logger(`Removed subscription ${id}`);
  }

  /**
   * Notify subscribers of a document change.
   *
   * @param uri - Document URI that changed
   * @param changeType - Type of change
   * @param version - New document version
   * @param changes - Individual node changes
   * @param content - Optional full content (for includeContent subscribers)
   */
  notifyChange(
    uri: string,
    changeType: ChangeType,
    version: number,
    changes: NodeChange[] = [],
    content?: unknown
  ): void {
    const subscriptionIds = this.subscriptionsByUri.get(uri);
    if (!subscriptionIds || subscriptionIds.size === 0) {
      return;
    }

    for (const id of subscriptionIds) {
      const subscription = this.subscriptions.get(id);
      if (!subscription || !subscription.isActive) {
        continue;
      }

      this.queueNotification(subscription, changeType, version, changes, content);
    }
  }

  /**
   * Queue a notification with debouncing.
   */
  private queueNotification(
    subscription: Subscription,
    changeType: ChangeType,
    version: number,
    changes: NodeChange[],
    content?: unknown
  ): void {
    // Filter changes by node types if specified
    let filteredChanges = changes;
    if (subscription.options.nodeTypes && subscription.options.nodeTypes.length > 0) {
      filteredChanges = changes.filter(
        change => subscription.options.nodeTypes!.includes(change.nodeType)
      );

      // Skip if no matching changes for update events
      if (filteredChanges.length === 0 && changeType === 'update') {
        return;
      }
    }

    // Add to pending changes
    subscription.pendingChanges.push(...filteredChanges);
    subscription.pendingVersion = version;

    const debounceMs = subscription.options.debounceMs ?? this.config.defaultDebounceMs;

    // Clear existing timer
    if (subscription.debounceTimer) {
      clearTimeout(subscription.debounceTimer);
    }

    // Deliver immediately if debounce is 0
    if (debounceMs === 0) {
      this.flushNotification(subscription, changeType, content);
      return;
    }

    // Schedule delivery
    subscription.debounceTimer = setTimeout(() => {
      this.flushNotification(subscription, changeType, content);
    }, debounceMs);
  }

  /**
   * Flush pending notifications to a subscriber.
   */
  private async flushNotification(
    subscription: Subscription,
    changeType: ChangeType,
    providedContent?: unknown
  ): Promise<void> {
    if (!subscription.isActive) {
      return;
    }

    // Get content if needed
    let content = providedContent;
    if (subscription.options.includeContent && content === undefined) {
      content = await this.config.contentProvider(subscription.uri);
    }

    const event: ModelChangeEvent = {
      type: changeType,
      uri: subscription.uri,
      version: subscription.pendingVersion ?? 1,
      timestamp: Date.now(),
      changes: subscription.pendingChanges,
      content: subscription.options.includeContent ? content : undefined,
    };

    // Clear pending state
    subscription.pendingChanges = [];
    subscription.debounceTimer = undefined;
    subscription.lastNotified = Date.now();

    this.deliverNotification(subscription, event);
  }

  /**
   * Deliver a notification to a subscriber.
   */
  private deliverNotification(subscription: Subscription, event: ModelChangeEvent): void {
    try {
      subscription.callback(event);
    } catch (error) {
      console.error('Error in subscription callback:', error);
      this.config.logger(`Error in callback for subscription ${subscription.id}: ${error}`);
    }
  }

  /**
   * Handle client disconnect - clean up all subscriptions for the client.
   */
  onClientDisconnect(clientId: string): void {
    const subscriptionIds = this.subscriptionsByClient.get(clientId);
    if (!subscriptionIds) {
      return;
    }

    this.config.logger(`Cleaning up ${subscriptionIds.size} subscriptions for client ${clientId}`);

    for (const id of subscriptionIds) {
      this.unsubscribeById(id);
    }

    this.subscriptionsByClient.delete(clientId);
  }

  /**
   * Get all active subscriptions.
   */
  getActiveSubscriptions(): SubscriptionHandle[] {
    return Array.from(this.subscriptions.values())
      .filter(s => s.isActive)
      .map(s => this.toHandle(s));
  }

  /**
   * Get subscriptions for a specific URI.
   */
  getSubscriptionsForUri(uri: string): SubscriptionHandle[] {
    const ids = this.subscriptionsByUri.get(uri);
    if (!ids) {
      return [];
    }

    return Array.from(ids)
      .map(id => this.subscriptions.get(id))
      .filter((s): s is Subscription => s !== undefined && s.isActive)
      .map(s => this.toHandle(s));
  }

  /**
   * Get subscription count.
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Dispose all subscriptions.
   */
  dispose(): void {
    for (const subscription of this.subscriptions.values()) {
      subscription.isActive = false;
      if (subscription.debounceTimer) {
        clearTimeout(subscription.debounceTimer);
      }
    }
    this.subscriptions.clear();
    this.subscriptionsByUri.clear();
    this.subscriptionsByClient.clear();
  }

  /**
   * Convert subscription to handle.
   */
  private toHandle(subscription: Subscription): SubscriptionHandle {
    return {
      id: subscription.id,
      uri: subscription.uri,
      options: subscription.options,
      get isActive() {
        return subscription.isActive;
      },
      dispose: () => {
        this.unsubscribeById(subscription.id);
      },
    };
  }

  /**
   * Generate a unique subscription ID.
   */
  private generateId(): string {
    return `sub-${++this.idCounter}`;
  }

  /**
   * Validate URI format.
   */
  private isValidUri(uri: string): boolean {
    return uri.startsWith('file://') || uri.startsWith('untitled:');
  }

  /**
   * Clamp debounce time to valid range.
   */
  private clampDebounce(ms?: number): number {
    if (ms === undefined) {
      return this.config.defaultDebounceMs;
    }
    return Math.min(Math.max(0, ms), this.config.maxDebounceMs);
  }
}

/**
 * Create a new SubscriptionService instance.
 */
export function createSubscriptionService(
  config?: SubscriptionServiceConfig
): SubscriptionService {
  return new SubscriptionService(config);
}
