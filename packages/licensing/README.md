# @sanyam/licensing

Feature gating and subscription tier management for Sanyam IDE.

## Purpose

This package provides licensing and feature gating capabilities:
- Subscription tier management (Free, Pro, Enterprise)
- Feature availability checks based on user tier
- Numeric limit enforcement (document count, storage quota)
- Dynamic feature registration for extensibility

## Installation

```bash
pnpm add @sanyam/licensing
```

## Usage

### FeatureGate

Check feature availability and tier limits:

```typescript
import { FeatureGate } from '@sanyam/licensing';

// Check if feature is available
if (await featureGate.isFeatureEnabled('document_sharing')) {
  // Show sharing UI
}

// Get tier limits for enforcement
const limits = await featureGate.getTierLimits();
if (documentCount >= limits.max_documents) {
  showUpgradePrompt();
}
```

### LicenseValidator

Cached tier information with automatic invalidation:

```typescript
import { LicenseValidator } from '@sanyam/licensing';

// Get current user's tier (cached for 15 minutes)
const tier = await validator.getCurrentTier();

// Force refresh (for support/debugging)
await validator.invalidateCache();
```

### FeatureContribution

Register package-specific gated features:

```typescript
import { FeatureContribution, FeatureRegistration } from '@sanyam/licensing';

@injectable()
class MyFeatureContribution implements FeatureContribution {
  getFeatures(): FeatureRegistration[] {
    return [
      { featureId: 'my_feature', requiredTier: 'pro' }
    ];
  }
}
```

## API Reference

### Interfaces

- `TierLimits` - Complete tier configuration from database
- `FeatureRegistration` - Feature declaration with required tier
- `FeatureContribution` - Extensibility interface for packages

### Services

- `FeatureGate` - Feature availability and limit checking
- `LicenseValidator` - Cached tier fetching with invalidation

### Commands

- `Sanyam: Refresh License` - Manual cache invalidation

## Tier Feature Matrix

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Cloud Storage | 5 docs, 10MB | 100 docs, 1GB | Unlimited |
| Document Sharing | No | Yes | Yes |
| Version History | No | Yes | Yes |
| Real-Time Collaboration | No | Yes | Yes |
| API Keys | No | Yes | Yes |
| Azure AD SSO | No | No | Yes |

## Database Integration

Tier limits are stored in the `tier_limits` table and can be modified without code deployment:

```sql
-- Adjust free tier document limit
UPDATE tier_limits
SET max_documents = 10
WHERE tier = 'free';
```

## License

MIT
