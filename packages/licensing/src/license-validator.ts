/**
 * License Validator
 *
 * Validates user subscription tier and fetches tier limits with caching.
 *
 * @packageDocumentation
 */

import { injectable, inject, postConstruct, optional } from 'inversify';
import { DisposableCollection, Disposable } from '@theia/core';
import type { TierLimits, SubscriptionTier, AuthState } from '@sanyam/types';
import { DEFAULT_FREE_TIER_LIMITS } from '@sanyam/types';

/**
 * DI token for LicenseValidator.
 */
export const LicenseValidator = Symbol('LicenseValidator');

/**
 * DI token for AuthStateProvider (optional, for cache invalidation).
 */
export const AuthStateProvider = Symbol('AuthStateProvider');

/**
 * Auth state provider interface (minimal subset for licensing).
 */
export interface AuthStateProvider {
  readonly onAuthStateChange: {
    (handler: (state: AuthState) => void): Disposable;
  };
  getAccessToken(): Promise<string | null>;
}

/**
 * Tier limits fetch function type.
 */
export type TierLimitsFetcher = (tier: SubscriptionTier) => Promise<TierLimits | null>;

/**
 * License validation result.
 */
export interface LicenseValidationResult {
  /** Whether the license is valid */
  readonly valid: boolean;

  /** User's current tier */
  readonly tier: SubscriptionTier;

  /** Current tier limits */
  readonly limits: TierLimits;

  /** Error message if invalid */
  readonly error?: string;
}

/**
 * Cache configuration.
 */
export interface LicenseCacheConfig {
  /** Cache TTL in milliseconds. Default: 15 minutes */
  readonly cacheTtlMs: number;
}

/**
 * Default cache configuration.
 */
export const DEFAULT_LICENSE_CACHE_CONFIG: LicenseCacheConfig = {
  cacheTtlMs: 15 * 60 * 1000, // 15 minutes
};

/**
 * Interface for license validation.
 */
export interface LicenseValidator extends Disposable {
  /**
   * Current user tier.
   */
  readonly currentTier: SubscriptionTier;

  /**
   * Current tier limits.
   */
  readonly currentLimits: TierLimits;

  /**
   * Whether the validator has been initialized.
   */
  readonly isInitialized: boolean;

  /**
   * Initialize the validator (fetch initial limits).
   *
   * @param accessToken - User's access token
   */
  initialize(accessToken?: string): Promise<void>;

  /**
   * Validate user license and get tier limits.
   *
   * @param accessToken - User's access token
   * @returns Validation result
   */
  validate(accessToken: string): Promise<LicenseValidationResult>;

  /**
   * Check if user tier meets required tier.
   *
   * @param requiredTier - Required tier
   * @returns True if user has access
   */
  hasTier(requiredTier: SubscriptionTier): boolean;

  /**
   * Refresh cached tier limits.
   *
   * @param accessToken - User's access token
   */
  refresh(accessToken: string): Promise<void>;

  /**
   * Invalidate cache (force re-fetch on next access).
   */
  invalidateCache(): void;
}

/**
 * Tier hierarchy for comparisons.
 */
const TIER_HIERARCHY: SubscriptionTier[] = ['free', 'pro', 'enterprise'];

/**
 * Default implementation of LicenseValidator.
 */
@injectable()
export class LicenseValidatorImpl implements LicenseValidator {
  private readonly disposables = new DisposableCollection();
  private readonly config: LicenseCacheConfig;
  private cachedLimits: TierLimits | null = null;
  private cachedTier: SubscriptionTier = 'free';
  private cacheExpiresAt = 0;
  private _isInitialized = false;

  @inject(AuthStateProvider) @optional()
  private readonly authStateProvider?: AuthStateProvider;

  // Tier limits fetcher - can be injected or set
  private tierLimitsFetcher?: TierLimitsFetcher;

  constructor(config: LicenseCacheConfig = DEFAULT_LICENSE_CACHE_CONFIG) {
    this.config = config;
  }

  @postConstruct()
  protected init(): void {
    // Subscribe to auth state changes for cache invalidation
    if (this.authStateProvider) {
      this.disposables.push(
        this.authStateProvider.onAuthStateChange((state) => {
          if (state.event === 'SIGNED_IN' || state.event === 'TOKEN_REFRESHED') {
            this.invalidateCache();
            // Re-validate with new token
            this.authStateProvider?.getAccessToken().then((token) => {
              if (token) {
                this.validate(token).catch(() => {});
              }
            });
          } else if (state.event === 'SIGNED_OUT') {
            this.invalidateCache();
            this.cachedTier = 'free';
            this.cachedLimits = DEFAULT_FREE_TIER_LIMITS;
          }
        })
      );
    }
  }

  get currentTier(): SubscriptionTier {
    return this.cachedTier;
  }

  get currentLimits(): TierLimits {
    return this.cachedLimits ?? DEFAULT_FREE_TIER_LIMITS;
  }

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  async initialize(accessToken?: string): Promise<void> {
    if (this._isInitialized) {
      return;
    }

    if (accessToken) {
      await this.validate(accessToken);
    } else {
      // Initialize with free tier defaults
      this.cachedTier = 'free';
      this.cachedLimits = DEFAULT_FREE_TIER_LIMITS;
    }

    this._isInitialized = true;
  }

  async validate(accessToken: string): Promise<LicenseValidationResult> {
    // Check cache first
    if (this.cachedLimits && Date.now() < this.cacheExpiresAt) {
      return {
        valid: true,
        tier: this.cachedTier,
        limits: this.cachedLimits,
      };
    }

    // Fetch fresh limits
    try {
      const limits = await this.fetchLimits(accessToken);

      if (limits) {
        this.cachedLimits = limits;
        this.cachedTier = limits.tier;
        this.cacheExpiresAt = Date.now() + this.config.cacheTtlMs;

        return {
          valid: true,
          tier: limits.tier,
          limits,
        };
      }

      // Fallback to free tier
      this.cachedTier = 'free';
      this.cachedLimits = DEFAULT_FREE_TIER_LIMITS;
      this.cacheExpiresAt = Date.now() + this.config.cacheTtlMs;

      return {
        valid: true,
        tier: 'free',
        limits: DEFAULT_FREE_TIER_LIMITS,
      };
    } catch (error) {
      return {
        valid: false,
        tier: 'free',
        limits: DEFAULT_FREE_TIER_LIMITS,
        error: String(error),
      };
    }
  }

  hasTier(requiredTier: SubscriptionTier): boolean {
    const userIndex = TIER_HIERARCHY.indexOf(this.cachedTier);
    const requiredIndex = TIER_HIERARCHY.indexOf(requiredTier);

    if (userIndex === -1 || requiredIndex === -1) {
      return false;
    }

    return userIndex >= requiredIndex;
  }

  async refresh(accessToken: string): Promise<void> {
    this.invalidateCache();
    await this.validate(accessToken);
  }

  invalidateCache(): void {
    this.cacheExpiresAt = 0;
  }

  dispose(): void {
    this.disposables.dispose();
  }

  /**
   * Set custom tier limits fetcher.
   */
  setTierLimitsFetcher(fetcher: TierLimitsFetcher): void {
    this.tierLimitsFetcher = fetcher;
  }

  /**
   * Fetch tier limits from API.
   */
  private async fetchLimits(accessToken: string): Promise<TierLimits | null> {
    // Use custom fetcher if provided
    if (this.tierLimitsFetcher) {
      // Get user tier first
      const tier = await this.fetchUserTier(accessToken);
      return this.tierLimitsFetcher(tier);
    }

    // Default: fetch via API
    try {
      // Get user profile to determine tier
      const profileResponse = await fetch('/api/v1/profile', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!profileResponse.ok) {
        return null;
      }

      const profile = await profileResponse.json();
      const tier: SubscriptionTier = profile.tier ?? 'free';

      // Get tier limits
      const limitsResponse = await fetch(`/api/v1/tier-limits/${tier}`);

      if (!limitsResponse.ok) {
        return null;
      }

      return await limitsResponse.json() as TierLimits;
    } catch {
      return null;
    }
  }

  /**
   * Fetch user tier from profile.
   */
  private async fetchUserTier(accessToken: string): Promise<SubscriptionTier> {
    try {
      const response = await fetch('/api/v1/profile', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return 'free';
      }

      const profile = await response.json();
      return profile.tier ?? 'free';
    } catch {
      return 'free';
    }
  }
}

/**
 * Create a license validator instance.
 *
 * @param config - Optional cache configuration
 * @returns LicenseValidator instance
 */
export function createLicenseValidator(config?: Partial<LicenseCacheConfig>): LicenseValidator {
  return new LicenseValidatorImpl({ ...DEFAULT_LICENSE_CACHE_CONFIG, ...config });
}
