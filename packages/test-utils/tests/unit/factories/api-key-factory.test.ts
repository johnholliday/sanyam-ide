/**
 * Unit tests for API key factory functions
 */

import { describe, it, expect } from 'vitest';
import {
  buildCreateApiKeyRequest,
  buildApiKey,
} from '../../../src/factories/api-key-factory.js';

describe('buildCreateApiKeyRequest', () => {
  it('should create request with defaults', () => {
    const request = buildCreateApiKeyRequest();

    expect(request.name).toBe('Test API Key');
    expect(request.scopes).toEqual(['read:documents']);
    expect(request.expires_at).toBeUndefined();
  });

  it('should allow overriding name', () => {
    const request = buildCreateApiKeyRequest({ name: 'CI/CD Key' });

    expect(request.name).toBe('CI/CD Key');
    expect(request.scopes).toEqual(['read:documents']);
  });

  it('should allow overriding scopes', () => {
    const request = buildCreateApiKeyRequest({
      scopes: ['read:documents', 'write:documents'],
    });

    expect(request.scopes).toEqual(['read:documents', 'write:documents']);
  });

  it('should allow setting expiration', () => {
    const expiresAt = '2025-12-31T23:59:59Z';
    const request = buildCreateApiKeyRequest({ expires_at: expiresAt });

    expect(request.expires_at).toBe(expiresAt);
  });

  it('should allow overriding all fields', () => {
    const request = buildCreateApiKeyRequest({
      name: 'Production Key',
      scopes: ['read:documents', 'write:documents', 'admin:*'],
      expires_at: '2026-01-01T00:00:00Z',
    });

    expect(request.name).toBe('Production Key');
    expect(request.scopes).toEqual(['read:documents', 'write:documents', 'admin:*']);
    expect(request.expires_at).toBe('2026-01-01T00:00:00Z');
  });

  it('should allow empty scopes array', () => {
    const request = buildCreateApiKeyRequest({ scopes: [] });

    expect(request.scopes).toEqual([]);
  });
});

describe('buildApiKey', () => {
  it('should create API key with defaults', () => {
    const key = buildApiKey();

    expect(key.id).toBeDefined();
    expect(key.user_id).toBeDefined();
    expect(key.name).toBe('Test API Key');
    expect(key.key_prefix).toBe('sk_test_');
    expect(key.key_hash).toBeDefined();
    expect(key.scopes).toEqual(['read:documents']);
    expect(key.created_at).toBeDefined();
    expect(key.expires_at).toBeNull();
    expect(key.revoked_at).toBeNull();
    expect(key.last_used_at).toBeNull();
  });

  it('should generate unique IDs', () => {
    const key1 = buildApiKey();
    const key2 = buildApiKey();

    expect(key1.id).not.toBe(key2.id);
    expect(key1.user_id).not.toBe(key2.user_id);
  });

  it('should allow overriding id', () => {
    const key = buildApiKey({ id: 'custom-key-id' });

    expect(key.id).toBe('custom-key-id');
  });

  it('should allow overriding user_id', () => {
    const key = buildApiKey({ user_id: 'specific-user-id' });

    expect(key.user_id).toBe('specific-user-id');
  });

  it('should allow overriding name', () => {
    const key = buildApiKey({ name: 'Production API Key' });

    expect(key.name).toBe('Production API Key');
  });

  it('should allow overriding key_prefix', () => {
    const key = buildApiKey({ key_prefix: 'sk_live_' });

    expect(key.key_prefix).toBe('sk_live_');
  });

  it('should allow overriding key_hash', () => {
    const key = buildApiKey({ key_hash: 'custom-hash-value' });

    expect(key.key_hash).toBe('custom-hash-value');
  });

  it('should allow overriding scopes', () => {
    const key = buildApiKey({ scopes: ['admin:*', 'write:documents'] });

    expect(key.scopes).toEqual(['admin:*', 'write:documents']);
  });

  it('should allow setting expires_at', () => {
    const expiresAt = '2025-12-31T23:59:59Z';
    const key = buildApiKey({ expires_at: expiresAt });

    expect(key.expires_at).toBe(expiresAt);
  });

  it('should allow setting revoked_at', () => {
    const revokedAt = '2024-06-15T10:30:00Z';
    const key = buildApiKey({ revoked_at: revokedAt });

    expect(key.revoked_at).toBe(revokedAt);
  });

  it('should allow setting last_used_at', () => {
    const lastUsedAt = '2024-06-14T08:00:00Z';
    const key = buildApiKey({ last_used_at: lastUsedAt });

    expect(key.last_used_at).toBe(lastUsedAt);
  });

  it('should allow overriding created_at', () => {
    const createdAt = '2024-01-01T00:00:00Z';
    const key = buildApiKey({ created_at: createdAt });

    expect(key.created_at).toBe(createdAt);
  });

  it('should set created_at to current time by default', () => {
    const before = new Date().toISOString();
    const key = buildApiKey();
    const after = new Date().toISOString();

    expect(key.created_at >= before).toBe(true);
    expect(key.created_at <= after).toBe(true);
  });

  it('should allow overriding all fields', () => {
    const key = buildApiKey({
      id: 'key-123',
      user_id: 'user-456',
      name: 'Full Override Key',
      key_prefix: 'sk_prod_',
      key_hash: 'sha256_custom',
      scopes: ['read:*', 'write:*'],
      created_at: '2024-01-01T00:00:00Z',
      expires_at: '2025-01-01T00:00:00Z',
      revoked_at: null,
      last_used_at: '2024-06-01T12:00:00Z',
    });

    expect(key.id).toBe('key-123');
    expect(key.user_id).toBe('user-456');
    expect(key.name).toBe('Full Override Key');
    expect(key.key_prefix).toBe('sk_prod_');
    expect(key.key_hash).toBe('sha256_custom');
    expect(key.scopes).toEqual(['read:*', 'write:*']);
    expect(key.created_at).toBe('2024-01-01T00:00:00Z');
    expect(key.expires_at).toBe('2025-01-01T00:00:00Z');
    expect(key.revoked_at).toBeNull();
    expect(key.last_used_at).toBe('2024-06-01T12:00:00Z');
  });
});
