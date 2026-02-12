/**
 * Document Cache
 *
 * In-memory cache for cloud documents with configurable TTL.
 *
 * @packageDocumentation
 */

import { injectable } from 'inversify';
import type { CloudDocument } from '@sanyam/types';

/**
 * DI token for DocumentCache.
 */
export const DocumentCache = Symbol('DocumentCache');

/**
 * Cache entry with expiration.
 */
interface CacheEntry<T> {
  readonly data: T;
  readonly expiresAt: number;
  readonly etag?: string;
}

/**
 * Cache configuration.
 */
export interface DocumentCacheConfig {
  /** Default TTL in milliseconds. Default: 5 minutes */
  readonly defaultTtlMs: number;

  /** Maximum cache entries. Default: 100 */
  readonly maxEntries: number;

  /** Cleanup interval in milliseconds. Default: 1 minute */
  readonly cleanupIntervalMs: number;
}

/**
 * Default cache configuration.
 */
export const DEFAULT_CACHE_CONFIG: DocumentCacheConfig = {
  defaultTtlMs: 5 * 60 * 1000, // 5 minutes
  maxEntries: 100,
  cleanupIntervalMs: 60 * 1000, // 1 minute
};

/**
 * Interface for document cache.
 */
export interface DocumentCache {
  /**
   * Get a document from cache.
   *
   * @param documentId - Document ID
   * @returns Cached document or undefined
   */
  get(documentId: string): CloudDocument | undefined;

  /**
   * Get a document with its ETag.
   *
   * @param documentId - Document ID
   * @returns Cached document and ETag or undefined
   */
  getWithEtag(documentId: string): { document: CloudDocument; etag?: string } | undefined;

  /**
   * Store a document in cache.
   *
   * @param document - Document to cache
   * @param etag - Optional ETag for conditional requests
   * @param ttlMs - Optional TTL override
   */
  set(document: CloudDocument, etag?: string, ttlMs?: number): void;

  /**
   * Remove a document from cache.
   *
   * @param documentId - Document ID
   */
  invalidate(documentId: string): void;

  /**
   * Clear all cached documents.
   */
  clear(): void;

  /**
   * Check if a document is in cache and not expired.
   *
   * @param documentId - Document ID
   * @returns True if cached and valid
   */
  has(documentId: string): boolean;

  /**
   * Get cache statistics.
   */
  getStats(): {
    readonly size: number;
    readonly hits: number;
    readonly misses: number;
    readonly hitRate: number;
  };

  /**
   * Start automatic cleanup (call once on init).
   */
  startCleanup(): void;

  /**
   * Stop automatic cleanup.
   */
  stopCleanup(): void;
}

/**
 * Default implementation of DocumentCache.
 */
@injectable()
export class DocumentCacheImpl implements DocumentCache {
  private readonly cache = new Map<string, CacheEntry<CloudDocument>>();
  private readonly config: DocumentCacheConfig;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private hits = 0;
  private misses = 0;

  constructor(config: DocumentCacheConfig = DEFAULT_CACHE_CONFIG) {
    this.config = config;
  }

  get(documentId: string): CloudDocument | undefined {
    const entry = this.cache.get(documentId);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(documentId);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return entry.data;
  }

  getWithEtag(documentId: string): { document: CloudDocument; etag?: string } | undefined {
    const entry = this.cache.get(documentId);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(documentId);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return { document: entry.data, etag: entry.etag };
  }

  set(document: CloudDocument, etag?: string, ttlMs?: number): void {
    // Enforce max entries
    if (this.cache.size >= this.config.maxEntries) {
      this.evictOldest();
    }

    const expiresAt = Date.now() + (ttlMs ?? this.config.defaultTtlMs);
    this.cache.set(document.id, { data: document, expiresAt, etag });
  }

  invalidate(documentId: string): void {
    this.cache.delete(documentId);
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  has(documentId: string): boolean {
    const entry = this.cache.get(documentId);
    if (!entry) {
      return false;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(documentId);
      return false;
    }
    return true;
  }

  getStats(): {
    readonly size: number;
    readonly hits: number;
    readonly misses: number;
    readonly hitRate: number;
  } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  startCleanup(): void {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);
  }

  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Remove expired entries.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [id, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(id);
      }
    }
  }

  /**
   * Evict oldest entry when cache is full.
   */
  private evictOldest(): void {
    let oldestId: string | null = null;
    let oldestExpires = Infinity;

    for (const [id, entry] of this.cache.entries()) {
      if (entry.expiresAt < oldestExpires) {
        oldestExpires = entry.expiresAt;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.cache.delete(oldestId);
    }
  }
}

/**
 * Create a document cache instance.
 *
 * @param config - Optional cache configuration
 * @returns DocumentCache instance
 */
export function createDocumentCache(config?: Partial<DocumentCacheConfig>): DocumentCache {
  return new DocumentCacheImpl({ ...DEFAULT_CACHE_CONFIG, ...config });
}
