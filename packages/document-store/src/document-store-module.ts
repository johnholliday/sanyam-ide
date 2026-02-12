/**
 * Document Store DI Module
 *
 * Inversify container module for @sanyam/document-store services.
 *
 * @packageDocumentation
 */

import { ContainerModule } from 'inversify';
import {
  SupabaseClientFactory,
  SupabaseClientFactoryImpl,
} from './supabase-client-factory.js';
import {
  CloudDocumentStore,
  CloudDocumentStoreImpl,
} from './cloud-document-store.js';
import {
  SanyamUriScheme,
  SanyamUriSchemeImpl,
  DocumentStoreForUri,
} from './sanyam-uri-scheme.js';
import {
  DocumentCache,
  DocumentCacheImpl,
} from './document-cache.js';
import {
  LocalOnlyDocumentStore,
  LocalOnlyDocumentStoreImpl,
} from './local-only-document-store.js';
import {
  AutoSaveService,
  AutoSaveServiceImpl,
} from './auto-save-service.js';

/**
 * Check if cloud services are configured.
 */
function isCloudConfigured(): boolean {
  return !!(process.env['SUPABASE_URL'] && process.env['SUPABASE_ANON_KEY']);
}

/**
 * Create DI bindings for document-store services.
 *
 * @returns Container module
 */
export function createDocumentStoreModule(): ContainerModule {
  return new ContainerModule((bind) => {
    // Supabase client factory (always available for config checking)
    bind(SupabaseClientFactory).to(SupabaseClientFactoryImpl).inSingletonScope();

    // Local-only document store fallback (always available)
    bind(LocalOnlyDocumentStore).to(LocalOnlyDocumentStoreImpl).inSingletonScope();

    if (isCloudConfigured()) {
      // Cloud document store (when configured)
      bind(CloudDocumentStore).to(CloudDocumentStoreImpl).inSingletonScope();

      // Bind CloudDocumentStore as DocumentStoreForUri for URI handler
      bind(DocumentStoreForUri).toService(CloudDocumentStore);
    } else {
      // When cloud is not configured, bind LocalOnlyDocumentStore as DocumentStoreForUri
      bind(DocumentStoreForUri).toService(LocalOnlyDocumentStore);
    }

    // Sanyam URI scheme handler
    bind(SanyamUriScheme).to(SanyamUriSchemeImpl).inSingletonScope();

    // Document cache
    bind(DocumentCache).to(DocumentCacheImpl).inSingletonScope();

    // Auto-save service
    bind(AutoSaveService).to(AutoSaveServiceImpl).inSingletonScope();
  });
}
