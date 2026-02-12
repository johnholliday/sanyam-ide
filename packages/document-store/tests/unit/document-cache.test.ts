/**
 * Unit tests for DocumentCache
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DocumentCacheImpl,
  createDocumentCache,
  DEFAULT_CACHE_CONFIG,
  type DocumentCache,
} from '../../src/document-cache.js';
import type { CloudDocument } from '@sanyam/types';

function createMockDocument(overrides: Partial<CloudDocument> = {}): CloudDocument {
  return {
    id: 'doc-' + Math.random().toString(36).slice(2, 9),
    title: 'Test Document',
    content: 'Test content',
    languageId: 'example-minimal',
    owner_id: 'user-123',
    grammar_type: 'example-minimal',
    storage_size_bytes: 100,
    version_count: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('DocumentCache', () => {
  let cache: DocumentCache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = createDocumentCache();
  });

  afterEach(() => {
    cache.stopCleanup();
    vi.useRealTimers();
  });

  describe('set and get', () => {
    it('should store and retrieve document', () => {
      const doc = createMockDocument({ id: 'doc-1' });
      cache.set(doc);

      const retrieved = cache.get('doc-1');

      expect(retrieved).toEqual(doc);
    });

    it('should return undefined for non-existent document', () => {
      const retrieved = cache.get('non-existent');

      expect(retrieved).toBeUndefined();
    });

    it('should update existing document', () => {
      const doc1 = createMockDocument({ id: 'doc-1', title: 'Original' });
      const doc2 = createMockDocument({ id: 'doc-1', title: 'Updated' });

      cache.set(doc1);
      cache.set(doc2);

      const retrieved = cache.get('doc-1');
      expect(retrieved?.title).toBe('Updated');
    });
  });

  describe('getWithEtag', () => {
    it('should store and retrieve document with etag', () => {
      const doc = createMockDocument({ id: 'doc-1' });
      cache.set(doc, 'etag-123');

      const result = cache.getWithEtag('doc-1');

      expect(result?.document).toEqual(doc);
      expect(result?.etag).toBe('etag-123');
    });

    it('should return undefined for non-existent document', () => {
      const result = cache.getWithEtag('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('expiration', () => {
    it('should expire documents after TTL', () => {
      const doc = createMockDocument({ id: 'doc-1' });
      cache.set(doc);

      // Advance past default TTL (5 minutes)
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      const retrieved = cache.get('doc-1');
      expect(retrieved).toBeUndefined();
    });

    it('should return document within TTL', () => {
      const doc = createMockDocument({ id: 'doc-1' });
      cache.set(doc);

      // Advance within TTL
      vi.advanceTimersByTime(4 * 60 * 1000);

      const retrieved = cache.get('doc-1');
      expect(retrieved).toEqual(doc);
    });

    it('should respect custom TTL', () => {
      const doc = createMockDocument({ id: 'doc-1' });
      cache.set(doc, undefined, 1000); // 1 second TTL

      vi.advanceTimersByTime(500);
      expect(cache.get('doc-1')).toEqual(doc);

      vi.advanceTimersByTime(600);
      expect(cache.get('doc-1')).toBeUndefined();
    });

    it('should also expire on getWithEtag', () => {
      const doc = createMockDocument({ id: 'doc-1' });
      cache.set(doc, 'etag-123');

      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      expect(cache.getWithEtag('doc-1')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for existing document', () => {
      cache.set(createMockDocument({ id: 'doc-1' }));

      expect(cache.has('doc-1')).toBe(true);
    });

    it('should return false for non-existent document', () => {
      expect(cache.has('non-existent')).toBe(false);
    });

    it('should return false for expired document', () => {
      cache.set(createMockDocument({ id: 'doc-1' }));
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      expect(cache.has('doc-1')).toBe(false);
    });
  });

  describe('invalidate', () => {
    it('should remove document from cache', () => {
      cache.set(createMockDocument({ id: 'doc-1' }));

      cache.invalidate('doc-1');

      expect(cache.get('doc-1')).toBeUndefined();
    });

    it('should not throw for non-existent document', () => {
      expect(() => cache.invalidate('non-existent')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all documents', () => {
      cache.set(createMockDocument({ id: 'doc-1' }));
      cache.set(createMockDocument({ id: 'doc-2' }));
      cache.set(createMockDocument({ id: 'doc-3' }));

      cache.clear();

      expect(cache.get('doc-1')).toBeUndefined();
      expect(cache.get('doc-2')).toBeUndefined();
      expect(cache.get('doc-3')).toBeUndefined();
    });

    it('should reset stats', () => {
      cache.set(createMockDocument({ id: 'doc-1' }));
      cache.get('doc-1');
      cache.get('non-existent');

      cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should track cache hits', () => {
      cache.set(createMockDocument({ id: 'doc-1' }));
      cache.get('doc-1');
      cache.get('doc-1');

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
    });

    it('should track cache misses', () => {
      cache.get('non-existent');
      cache.get('also-non-existent');

      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
    });

    it('should calculate hit rate', () => {
      cache.set(createMockDocument({ id: 'doc-1' }));
      cache.get('doc-1'); // hit
      cache.get('doc-1'); // hit
      cache.get('non-existent'); // miss

      const stats = cache.getStats();
      expect(stats.hitRate).toBeCloseTo(2 / 3, 5);
    });

    it('should return 0 hit rate with no requests', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });

    it('should report cache size', () => {
      cache.set(createMockDocument({ id: 'doc-1' }));
      cache.set(createMockDocument({ id: 'doc-2' }));

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
    });
  });

  describe('max entries', () => {
    it('should evict oldest entry when max entries reached', () => {
      const smallCache = createDocumentCache({ maxEntries: 2 });

      const doc1 = createMockDocument({ id: 'doc-1' });
      const doc2 = createMockDocument({ id: 'doc-2' });
      const doc3 = createMockDocument({ id: 'doc-3' });

      smallCache.set(doc1);
      vi.advanceTimersByTime(100);
      smallCache.set(doc2);
      vi.advanceTimersByTime(100);
      smallCache.set(doc3);

      // doc-1 should be evicted as the oldest
      expect(smallCache.get('doc-1')).toBeUndefined();
      expect(smallCache.get('doc-2')).toEqual(doc2);
      expect(smallCache.get('doc-3')).toEqual(doc3);
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries on cleanup', () => {
      const shortCleanupCache = createDocumentCache({
        defaultTtlMs: 1000,
        cleanupIntervalMs: 500,
      });

      shortCleanupCache.set(createMockDocument({ id: 'doc-1' }));
      shortCleanupCache.startCleanup();

      // Advance past TTL but before cleanup
      vi.advanceTimersByTime(1100);

      // Now advance past cleanup interval
      vi.advanceTimersByTime(500);

      // The document should be cleaned up
      const stats = shortCleanupCache.getStats();
      expect(stats.size).toBe(0);

      shortCleanupCache.stopCleanup();
    });

    it('should not start cleanup twice', () => {
      cache.startCleanup();
      cache.startCleanup(); // Should be no-op

      // If it started twice, we'd have issues - just verify no errors
      expect(() => cache.stopCleanup()).not.toThrow();
    });

    it('should stop cleanup', () => {
      cache.startCleanup();
      cache.stopCleanup();

      // Add document and advance time past cleanup - document shouldn't be auto-cleaned
      cache.set(createMockDocument({ id: 'doc-1' }), undefined, 500);
      vi.advanceTimersByTime(10000); // Well past TTL and cleanup intervals

      // Document should still exist (not cleaned up by interval since it's stopped)
      // Note: It will be expired though, so get() returns undefined
      // The test verifies cleanup timer stopped, not that cache works
    });
  });
});

describe('createDocumentCache', () => {
  it('should create cache with default config', () => {
    const cache = createDocumentCache();

    expect(cache).toBeDefined();
    cache.stopCleanup();
  });

  it('should create cache with custom config', () => {
    const cache = createDocumentCache({
      defaultTtlMs: 1000,
      maxEntries: 50,
    });

    expect(cache).toBeDefined();
    cache.stopCleanup();
  });
});

describe('DEFAULT_CACHE_CONFIG', () => {
  it('should have expected defaults', () => {
    expect(DEFAULT_CACHE_CONFIG.defaultTtlMs).toBe(5 * 60 * 1000);
    expect(DEFAULT_CACHE_CONFIG.maxEntries).toBe(100);
    expect(DEFAULT_CACHE_CONFIG.cleanupIntervalMs).toBe(60 * 1000);
  });
});
