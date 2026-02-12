/**
 * @sanyam/document-store
 *
 * Cloud document storage service for Sanyam IDE using Supabase.
 *
 * @packageDocumentation
 */

// Supabase client factory
export {
  SupabaseClientFactory,
  SupabaseClientFactoryImpl,
  type SupabaseClientFactory as SupabaseClientFactoryType,
  type SupabaseConfig,
} from './supabase-client-factory.js';

// Cloud document store
export {
  CloudDocumentStore,
  CloudDocumentStoreImpl,
  type CloudDocumentStore as CloudDocumentStoreType,
  type DocumentStoreResult,
  type TierCheckResult,
} from './cloud-document-store.js';

// Sanyam URI scheme
export {
  SanyamUriScheme,
  SanyamUriSchemeImpl,
  DocumentStoreForUri,
  createSanyamUriScheme,
  type SanyamUriScheme as SanyamUriSchemeType,
  type ParsedSanyamUri,
  type UriResolutionResult,
  type DocumentStoreForUri as DocumentStoreForUriType,
} from './sanyam-uri-scheme.js';

// Document cache
export {
  DocumentCache,
  DocumentCacheImpl,
  createDocumentCache,
  DEFAULT_CACHE_CONFIG,
  type DocumentCache as DocumentCacheType,
  type DocumentCacheConfig,
} from './document-cache.js';

// Local-only document store (offline fallback)
export {
  LocalOnlyDocumentStore,
  LocalOnlyDocumentStoreImpl,
  isLocalOnlyStore,
  type LocalOnlyDocumentStoreType,
  type LocalDocumentMetadata,
} from './local-only-document-store.js';

// Auto-save service
export {
  AutoSaveService,
  AutoSaveServiceImpl,
  DEFAULT_AUTO_SAVE_CONFIG,
  type AutoSaveServiceType,
  type AutoSaveConfig,
  type AutoSaveStatus,
  type DocumentAutoSaveState,
} from './auto-save-service.js';

// DI module
export { createDocumentStoreModule } from './document-store-module.js';

// Re-export commonly used types from @sanyam/types
export type {
  CloudDocument,
  DocumentVersion,
  DocumentShare,
  CreateDocumentRequest,
  UpdateDocumentRequest,
  CreateShareRequest,
  SharePermission,
  TierLimits,
  SubscriptionTier,
} from '@sanyam/types';

// Re-export URI constants
export { SANYAM_URI_SCHEME, ASSETS_PATH_SEGMENT } from '@sanyam/types';
