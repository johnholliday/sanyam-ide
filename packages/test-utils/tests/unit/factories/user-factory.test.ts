/**
 * Unit tests for test user factory functions
 *
 * Note: createTestUser and cleanupTestUser require real Supabase,
 * so we test the module exports and type contracts here.
 * Full integration tests live in the integration test suite.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TestUser } from '../../../src/setup/test-user.js';

describe('TestUser interface', () => {
  it('should have required readonly properties', () => {
    const user: TestUser = {
      id: 'user-123',
      email: 'test@example.com',
      accessToken: 'token-abc',
      refreshToken: 'refresh-xyz',
      tier: 'free',
    };

    expect(user.id).toBe('user-123');
    expect(user.email).toBe('test@example.com');
    expect(user.accessToken).toBe('token-abc');
    expect(user.refreshToken).toBe('refresh-xyz');
    expect(user.tier).toBe('free');
  });

  it('should accept all valid subscription tiers', () => {
    const freeUser: TestUser = {
      id: '1',
      email: 'free@test.com',
      accessToken: 'a',
      refreshToken: 'r',
      tier: 'free',
    };
    expect(freeUser.tier).toBe('free');

    const proUser: TestUser = {
      id: '2',
      email: 'pro@test.com',
      accessToken: 'b',
      refreshToken: 's',
      tier: 'pro',
    };
    expect(proUser.tier).toBe('pro');

    const enterpriseUser: TestUser = {
      id: '3',
      email: 'enterprise@test.com',
      accessToken: 'c',
      refreshToken: 't',
      tier: 'enterprise',
    };
    expect(enterpriseUser.tier).toBe('enterprise');
  });
});

describe('createTestUser', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should throw when SUPABASE_URL is not set', async () => {
    delete process.env['SUPABASE_URL'];
    delete process.env['SUPABASE_SERVICE_ROLE_KEY'];

    const { createTestUser } = await import('../../../src/setup/test-user.js');

    await expect(createTestUser()).rejects.toThrow(/SUPABASE_URL.*must be set/);
  });

  it('should throw when SUPABASE_SERVICE_ROLE_KEY is not set', async () => {
    process.env['SUPABASE_URL'] = 'http://localhost:54321';
    delete process.env['SUPABASE_SERVICE_ROLE_KEY'];

    // Re-import to pick up env changes
    vi.resetModules();
    const { createTestUser } = await import('../../../src/setup/test-user.js');

    await expect(createTestUser()).rejects.toThrow(/SUPABASE.*SERVICE_ROLE_KEY.*must be set/);
  });
});

describe('cleanupTestUser', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should throw when environment not configured', async () => {
    delete process.env['SUPABASE_URL'];
    delete process.env['SUPABASE_SERVICE_ROLE_KEY'];

    vi.resetModules();
    const { cleanupTestUser } = await import('../../../src/setup/test-user.js');

    const mockUser: TestUser = {
      id: 'test-id',
      email: 'test@test.com',
      accessToken: 'token',
      refreshToken: 'refresh',
      tier: 'free',
    };

    await expect(cleanupTestUser(mockUser)).rejects.toThrow(/SUPABASE.*must be set/);
  });
});

describe('getActiveTestUserCount', () => {
  it('should be exported and return a number', async () => {
    const { getActiveTestUserCount } = await import('../../../src/setup/test-user.js');

    expect(typeof getActiveTestUserCount).toBe('function');
    expect(typeof getActiveTestUserCount()).toBe('number');
  });
});

describe('cleanupAllTestUsers', () => {
  it('should be exported', async () => {
    const { cleanupAllTestUsers } = await import('../../../src/setup/test-user.js');

    expect(typeof cleanupAllTestUsers).toBe('function');
  });
});
