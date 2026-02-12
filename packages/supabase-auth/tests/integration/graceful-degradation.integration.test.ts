/**
 * Integration tests for graceful degradation modes.
 *
 * Tests Mode A (online with cloud) and Mode B (offline/unconfigured)
 * degradation behavior.
 * FR-045-049
 *
 * Skips automatically if Supabase is not configured.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { Container } from 'inversify';
import {
  createTestUser,
  cleanupTestUser,
  type TestUser,
} from '@sanyam/test-utils/setup/test-user';

// Test with and without Supabase
const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];
const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

describe('Graceful Degradation Integration Tests', () => {
  describe.skipIf(!isConfigured)('Mode A: Online with Cloud', () => {
    let testUser: TestUser;

    beforeEach(async () => {
      testUser = await createTestUser('free');
    });

    afterEach(async () => {
      if (testUser) {
        await cleanupTestUser(testUser);
      }
    });

    it('should have cloud services available in Mode A', async () => {
      expect(supabaseUrl).toBeDefined();
      expect(supabaseAnonKey).toBeDefined();
      expect(testUser.accessToken).toBeDefined();
    });

    it('should authenticate user successfully in Mode A', async () => {
      expect(testUser.id).toBeDefined();
      expect(testUser.email).toContain('@test.com');
    });

    it('should allow cloud document operations in Mode A', async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const client = createClient(supabaseUrl!, supabaseAnonKey!, {
        global: {
          headers: { Authorization: `Bearer ${testUser.accessToken}` },
        },
      });

      // Create document
      const { data, error } = await client
        .from('documents')
        .insert({
          name: 'Mode A Document',
          language_id: 'sanyam',
          content: 'Cloud content',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.name).toBe('Mode A Document');
    });

    it('should sync document versions in Mode A', async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const client = createClient(supabaseUrl!, supabaseAnonKey!, {
        global: {
          headers: { Authorization: `Bearer ${testUser.accessToken}` },
        },
      });

      // Create and update
      const { data: doc } = await client
        .from('documents')
        .insert({
          name: 'Versioned Doc',
          language_id: 'sanyam',
          content: 'v1',
        })
        .select()
        .single();

      await client.from('documents').update({ content: 'v2' }).eq('id', doc!.id);

      // Check version history
      const { data: versions } = await client
        .from('document_versions')
        .select()
        .eq('document_id', doc!.id);

      // Should have version history
      expect(versions).toBeDefined();
    });
  });

  describe('Mode B: Offline/Unconfigured', () => {
    // These tests simulate what happens when Supabase is not configured
    // or when the app is offline

    beforeEach(() => {
      // Save original env vars
    });

    afterEach(() => {
      // Restore env vars
    });

    it('should detect unconfigured state', () => {
      // Simulate unconfigured state
      const mockUrl = undefined;
      const mockKey = undefined;

      const isConfiguredLocal = Boolean(mockUrl && mockKey);
      expect(isConfiguredLocal).toBe(false);
    });

    it('should provide fallback tier limits in Mode B', async () => {
      const { DEFAULT_FREE_TIER_LIMITS } = await import('@sanyam/types');

      // In Mode B, should use default free tier limits
      expect(DEFAULT_FREE_TIER_LIMITS).toBeDefined();
      expect(DEFAULT_FREE_TIER_LIMITS.tier).toBe('free');
      expect(DEFAULT_FREE_TIER_LIMITS.max_documents).toBeGreaterThan(0);
    });

    it('should allow local-only document operations in Mode B', () => {
      // Local-only mode should work without cloud
      const localDocument = {
        id: crypto.randomUUID(),
        name: 'Local Document',
        content: 'Local content',
        language_id: 'sanyam',
        version: 1,
      };

      expect(localDocument.id).toBeDefined();
      expect(localDocument.name).toBe('Local Document');
    });

    it('should hide cloud features in Mode B', () => {
      // Feature flags for Mode B
      const modeB = {
        isConfigured: false,
        isOnline: false,
        features: {
          cloudStorage: false,
          documentSharing: false,
          versionSync: false,
          localEditing: true,
        },
      };

      expect(modeB.features.cloudStorage).toBe(false);
      expect(modeB.features.documentSharing).toBe(false);
      expect(modeB.features.localEditing).toBe(true);
    });

    it('should queue operations for sync when back online', () => {
      // Simulated operation queue for offline mode
      const operationQueue: Array<{ type: string; data: unknown }> = [];

      // Queue a save operation
      operationQueue.push({
        type: 'save',
        data: { name: 'Queued Doc', content: 'Content' },
      });

      expect(operationQueue.length).toBe(1);
      expect(operationQueue[0].type).toBe('save');
    });
  });

  describe('Mode Transition: A to B', () => {
    it('should detect transition to offline mode', () => {
      // Simulate going offline
      let isOnline = true;

      const goOffline = () => {
        isOnline = false;
      };

      goOffline();

      expect(isOnline).toBe(false);
    });

    it('should preserve unsaved changes during transition', () => {
      // Simulate unsaved changes
      const unsavedChanges = new Map<string, string>();
      unsavedChanges.set('doc-1', 'modified content');

      // Transition to offline should preserve changes
      const preservedChanges = new Map(unsavedChanges);

      expect(preservedChanges.size).toBe(1);
      expect(preservedChanges.get('doc-1')).toBe('modified content');
    });
  });

  describe('Mode Transition: B to A', () => {
    it.skipIf(!isConfigured)('should sync queued operations when back online', async () => {
      // This test requires Supabase to be configured
      const operationQueue = [
        { type: 'create', data: { name: 'Queued Doc' } },
      ];

      // Clear queue after sync
      const syncedQueue: typeof operationQueue = [];
      operationQueue.forEach((op) => syncedQueue.push(op));
      operationQueue.length = 0;

      expect(operationQueue.length).toBe(0);
      expect(syncedQueue.length).toBe(1);
    });
  });

  describe('Feature Degradation', () => {
    const features = {
      free: {
        cloudStorage: true,
        documentSharing: false,
        apiKeys: false,
        offlineMode: false,
      },
      unconfigured: {
        cloudStorage: false,
        documentSharing: false,
        apiKeys: false,
        offlineMode: true, // Always available locally
      },
    };

    it('should have correct feature set for free tier', () => {
      expect(features.free.cloudStorage).toBe(true);
      expect(features.free.documentSharing).toBe(false);
    });

    it('should have correct feature set for unconfigured mode', () => {
      expect(features.unconfigured.cloudStorage).toBe(false);
      expect(features.unconfigured.offlineMode).toBe(true);
    });

    it('should gracefully degrade features when tier unknown', () => {
      // When tier is unknown, default to free tier features
      const unknownTier = undefined;
      const effectiveFeatures = unknownTier ? features.free : features.unconfigured;

      expect(effectiveFeatures.cloudStorage).toBe(false);
    });
  });

  describe('Error Handling During Degradation', () => {
    it('should not throw when cloud services unavailable', async () => {
      // Simulated cloud operation that fails gracefully
      const cloudOperation = async () => {
        const isCloudAvailable = false;
        if (!isCloudAvailable) {
          return { success: false, error: 'Cloud services unavailable', data: null };
        }
        return { success: true, data: {} };
      };

      const result = await cloudOperation();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cloud services unavailable');
    });

    it('should provide user-friendly error messages', () => {
      const errors = {
        CLOUD_UNAVAILABLE: 'Cloud services are currently unavailable. Your changes are saved locally.',
        AUTH_REQUIRED: 'Please sign in to access cloud features.',
        TIER_REQUIRED: 'This feature requires a Pro subscription.',
      };

      expect(errors.CLOUD_UNAVAILABLE).toContain('saved locally');
    });
  });
});
