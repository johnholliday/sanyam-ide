/**
 * Stub file for TypeScript compilation.
 *
 * This file provides type information for the @app/grammar-manifests import.
 * At runtime, webpack resolves this import to the actual application-specific
 * grammar-manifests module via alias configuration.
 *
 * DO NOT import this file directly - import from '@app/grammar-manifests' instead.
 */

import type { GrammarManifest } from '@sanyam/types';

/**
 * Map of language IDs to grammar manifests.
 * Provided by each application via webpack alias.
 */
export const grammarManifests: Record<string, GrammarManifest> = {};
