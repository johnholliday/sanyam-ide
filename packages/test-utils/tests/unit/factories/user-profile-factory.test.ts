/**
 * Unit tests for user profile factory functions
 */

import { describe, it, expect } from 'vitest';
import { buildUserProfile } from '../../../src/factories/user-profile-factory.js';

describe('buildUserProfile', () => {
  it('should create profile with defaults', () => {
    const profile = buildUserProfile();

    expect(profile.user_id).toBeDefined();
    expect(profile.tier).toBe('free');
    expect(profile.organization_id).toBeNull();
    expect(profile.total_storage_bytes).toBe(0);
    expect(profile.created_at).toBeDefined();
    expect(profile.updated_at).toBeDefined();
  });

  it('should generate unique user IDs', () => {
    const profile1 = buildUserProfile();
    const profile2 = buildUserProfile();

    expect(profile1.user_id).not.toBe(profile2.user_id);
  });

  it('should allow overriding user_id', () => {
    const profile = buildUserProfile({ user_id: 'custom-user-id' });

    expect(profile.user_id).toBe('custom-user-id');
  });

  it('should allow overriding tier to pro', () => {
    const profile = buildUserProfile({ tier: 'pro' });

    expect(profile.tier).toBe('pro');
  });

  it('should allow overriding tier to enterprise', () => {
    const profile = buildUserProfile({ tier: 'enterprise' });

    expect(profile.tier).toBe('enterprise');
  });

  it('should allow setting organization_id', () => {
    const profile = buildUserProfile({ organization_id: 'org-123' });

    expect(profile.organization_id).toBe('org-123');
  });

  it('should allow setting total_storage_bytes', () => {
    const profile = buildUserProfile({ total_storage_bytes: 1024 * 1024 * 100 }); // 100MB

    expect(profile.total_storage_bytes).toBe(104857600);
  });

  it('should allow overriding created_at', () => {
    const createdAt = '2024-01-01T00:00:00Z';
    const profile = buildUserProfile({ created_at: createdAt });

    expect(profile.created_at).toBe(createdAt);
  });

  it('should allow overriding updated_at', () => {
    const updatedAt = '2024-06-15T12:00:00Z';
    const profile = buildUserProfile({ updated_at: updatedAt });

    expect(profile.updated_at).toBe(updatedAt);
  });

  it('should set timestamps to current time by default', () => {
    const before = new Date().toISOString();
    const profile = buildUserProfile();
    const after = new Date().toISOString();

    expect(profile.created_at >= before).toBe(true);
    expect(profile.created_at <= after).toBe(true);
    expect(profile.updated_at >= before).toBe(true);
    expect(profile.updated_at <= after).toBe(true);
  });

  it('should have created_at and updated_at equal by default', () => {
    const profile = buildUserProfile();

    expect(profile.created_at).toBe(profile.updated_at);
  });

  it('should allow overriding all fields', () => {
    const profile = buildUserProfile({
      user_id: 'user-789',
      tier: 'enterprise',
      organization_id: 'org-enterprise',
      total_storage_bytes: 500000000, // 500MB
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    });

    expect(profile.user_id).toBe('user-789');
    expect(profile.tier).toBe('enterprise');
    expect(profile.organization_id).toBe('org-enterprise');
    expect(profile.total_storage_bytes).toBe(500000000);
    expect(profile.created_at).toBe('2023-01-01T00:00:00Z');
    expect(profile.updated_at).toBe('2024-01-01T00:00:00Z');
  });

  it('should handle zero storage bytes', () => {
    const profile = buildUserProfile({ total_storage_bytes: 0 });

    expect(profile.total_storage_bytes).toBe(0);
  });

  it('should handle large storage values', () => {
    const oneTerabyte = 1024 * 1024 * 1024 * 1024;
    const profile = buildUserProfile({ total_storage_bytes: oneTerabyte });

    expect(profile.total_storage_bytes).toBe(oneTerabyte);
  });

  it('should handle profile with organization but free tier', () => {
    // Edge case: user in org but on free tier (could happen during downgrade)
    const profile = buildUserProfile({
      tier: 'free',
      organization_id: 'org-123',
    });

    expect(profile.tier).toBe('free');
    expect(profile.organization_id).toBe('org-123');
  });
});
