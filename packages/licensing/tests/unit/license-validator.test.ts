/**
 * Unit tests for LicenseValidator
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LicenseValidatorImpl,
  createLicenseValidator,
  DEFAULT_LICENSE_CACHE_CONFIG,
  type LicenseValidator,
} from '../../src/license-validator.js';
import { DEFAULT_FREE_TIER_LIMITS } from '@sanyam/types';
import type { TierLimits, SubscriptionTier } from '@sanyam/types';

const PRO_TIER_LIMITS: TierLimits = {
  tier: 'pro',
  max_documents: 100,
  max_storage_bytes: 1073741824,
  max_document_size_bytes: 10485760,
  max_api_keys: 5,
  version_retention_days: 30,
  offline_access: true,
  priority_support: false,
};

describe('LicenseValidator', () => {
  let validator: LicenseValidator;

  beforeEach(() => {
    vi.useFakeTimers();
    validator = createLicenseValidator();
  });

  afterEach(() => {
    validator.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should start with free tier', () => {
      expect(validator.currentTier).toBe('free');
    });

    it('should start with free tier limits', () => {
      expect(validator.currentLimits).toEqual(DEFAULT_FREE_TIER_LIMITS);
    });

    it('should not be initialized', () => {
      expect(validator.isInitialized).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should initialize with free tier when no token provided', async () => {
      await validator.initialize();

      expect(validator.isInitialized).toBe(true);
      expect(validator.currentTier).toBe('free');
      expect(validator.currentLimits).toEqual(DEFAULT_FREE_TIER_LIMITS);
    });

    it('should only initialize once', async () => {
      await validator.initialize();
      const firstTier = validator.currentTier;

      await validator.initialize();

      expect(validator.currentTier).toBe(firstTier);
    });
  });

  describe('hasTier', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    it('should return true for free tier when user is free', () => {
      expect(validator.hasTier('free')).toBe(true);
    });

    it('should return false for pro tier when user is free', () => {
      expect(validator.hasTier('pro')).toBe(false);
    });

    it('should return false for enterprise tier when user is free', () => {
      expect(validator.hasTier('enterprise')).toBe(false);
    });

    it('should handle unknown tiers defensively', () => {
      expect(validator.hasTier('unknown' as SubscriptionTier)).toBe(false);
    });
  });

  describe('validate with custom fetcher', () => {
    let fetcherMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetcherMock = vi.fn().mockResolvedValue(PRO_TIER_LIMITS);
      (validator as LicenseValidatorImpl).setTierLimitsFetcher(fetcherMock);

      // Mock the fetchUserTier method via fetch
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tier: 'pro' }),
      }));
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should use custom fetcher when provided', async () => {
      const result = await validator.validate('test-token');

      expect(result.valid).toBe(true);
      expect(result.tier).toBe('pro');
      expect(result.limits).toEqual(PRO_TIER_LIMITS);
      expect(fetcherMock).toHaveBeenCalledWith('pro');
    });

    it('should cache validation results', async () => {
      await validator.validate('test-token');
      await validator.validate('test-token');

      // Fetcher should only be called once due to caching
      expect(fetcherMock).toHaveBeenCalledTimes(1);
    });

    it('should return cached results within TTL', async () => {
      await validator.validate('test-token');

      // Advance time but stay within TTL
      vi.advanceTimersByTime(5 * 60 * 1000); // 5 minutes

      const result = await validator.validate('test-token');

      expect(result.tier).toBe('pro');
      expect(fetcherMock).toHaveBeenCalledTimes(1);
    });

    it('should refresh cache after TTL expires', async () => {
      await validator.validate('test-token');

      // Advance past TTL (default 15 minutes)
      vi.advanceTimersByTime(16 * 60 * 1000);

      await validator.validate('test-token');

      expect(fetcherMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidateCache', () => {
    let fetcherMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetcherMock = vi.fn().mockResolvedValue(PRO_TIER_LIMITS);
      (validator as LicenseValidatorImpl).setTierLimitsFetcher(fetcherMock);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tier: 'pro' }),
      }));
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should force re-fetch on next validate', async () => {
      await validator.validate('test-token');
      expect(fetcherMock).toHaveBeenCalledTimes(1);

      validator.invalidateCache();
      await validator.validate('test-token');

      expect(fetcherMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('refresh', () => {
    let fetcherMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetcherMock = vi.fn().mockResolvedValue(PRO_TIER_LIMITS);
      (validator as LicenseValidatorImpl).setTierLimitsFetcher(fetcherMock);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tier: 'pro' }),
      }));
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should invalidate cache and re-fetch', async () => {
      await validator.validate('test-token');
      await validator.refresh('test-token');

      expect(fetcherMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      (validator as LicenseValidatorImpl).setTierLimitsFetcher(
        vi.fn().mockRejectedValue(new Error('Network error'))
      );

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tier: 'pro' }),
      }));
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return invalid result with error on fetch failure', async () => {
      const result = await validator.validate('test-token');

      expect(result.valid).toBe(false);
      expect(result.tier).toBe('free');
      expect(result.limits).toEqual(DEFAULT_FREE_TIER_LIMITS);
      expect(result.error).toBeDefined();
    });
  });

  describe('custom cache configuration', () => {
    it('should respect custom TTL', async () => {
      const shortTtlValidator = createLicenseValidator({ cacheTtlMs: 1000 });
      const fetcherMock = vi.fn().mockResolvedValue(PRO_TIER_LIMITS);
      (shortTtlValidator as LicenseValidatorImpl).setTierLimitsFetcher(fetcherMock);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tier: 'pro' }),
      }));

      await shortTtlValidator.validate('test-token');
      vi.advanceTimersByTime(500); // Within TTL
      await shortTtlValidator.validate('test-token');

      expect(fetcherMock).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(600); // Past TTL
      await shortTtlValidator.validate('test-token');

      expect(fetcherMock).toHaveBeenCalledTimes(2);

      shortTtlValidator.dispose();
      vi.unstubAllGlobals();
    });
  });

  describe('tier hierarchy', () => {
    it('should correctly compare tiers', async () => {
      const fetcherMock = vi.fn().mockResolvedValue({
        ...PRO_TIER_LIMITS,
        tier: 'pro',
      });
      (validator as LicenseValidatorImpl).setTierLimitsFetcher(fetcherMock);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tier: 'pro' }),
      }));

      await validator.validate('test-token');

      expect(validator.hasTier('free')).toBe(true);
      expect(validator.hasTier('pro')).toBe(true);
      expect(validator.hasTier('enterprise')).toBe(false);

      vi.unstubAllGlobals();
    });
  });
});

describe('createLicenseValidator', () => {
  it('should create instance with default config', () => {
    const validator = createLicenseValidator();
    expect(validator).toBeDefined();
    expect(validator.currentTier).toBe('free');
    validator.dispose();
  });

  it('should create instance with custom config', () => {
    const validator = createLicenseValidator({ cacheTtlMs: 5000 });
    expect(validator).toBeDefined();
    validator.dispose();
  });
});
