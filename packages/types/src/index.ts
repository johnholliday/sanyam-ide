/**
 * @sanyam/types - Shared Type Definitions
 *
 * This package provides type definitions for the SANYAM platform.
 *
 * @packageDocumentation
 */

export {
  // Primitive types
  type NodeShape,
  type InputType,
  type ActionType,
  type Size,
  // Template configuration
  type TemplateInput,
  // Diagram configuration
  type DiagramNodeConfig,
  type NodeTypeConfig,
  type EdgeTypeConfig,
  type ToolAction,
  type ToolPaletteItem,
  type ToolPaletteGroup,
  type ToolPaletteConfig,
  type DiagramTypeConfig,
  // Documentation types
  type KeyFeature,
  type CoreConcept,
  // Root type configuration
  type PackageFileConfig,
  type RootTypeConfig,
  // Grammar manifest
  type GrammarManifest,
  // Type guards
  isGrammarManifest,
  // Validation
  type ValidationResult,
  validateManifest
} from './grammar-manifest.js';

export {
  // Grammar manifest contribution (Theia integration)
  GrammarManifestContribution,
  type GrammarManifestContribution as GrammarManifestContributionInterface
} from './grammar-manifest-contribution.js';

// Re-export GrammarManifest for the map type
import type { GrammarManifest } from './grammar-manifest.js';

/**
 * Map of language IDs to grammar manifests.
 * Used by applications to provide grammar manifests to the product extension via webpack alias.
 */
export type GrammarManifestMap = Record<string, GrammarManifest>;

export {
  // Application metadata for frontend config
  type ApplicationLink,
  type ApplicationMetadata
} from './application-metadata.js';

// ═══════════════════════════════════════════════════════════════════════════════
// LSP/GLSP Language Contribution Types
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Language contribution (unified server contract)
  LanguageContribution,
  type LanguageContribution as LanguageContributionInterface,
  type GrammarPackageJson,
  type RegisteredLanguage,
} from './language-contribution.js';

export {
  // LSP providers
  type MaybePromise,
  type LspContext,
  type WorkspaceContext,
  type SemanticTokensLegend,
  type LspFeatureProviders,
  type LspFeatureName,
  DEFAULT_SEMANTIC_TOKEN_TYPES,
  DEFAULT_SEMANTIC_TOKEN_MODIFIERS,
} from './lsp-providers.js';

export {
  // GLSP providers and types
  type GModelRoot,
  type GModelElement,
  type GNode,
  type GEdge,
  type GLabel,
  type GPort,
  type Point,
  type Dimension,
  type ModelMetadata,
  type GlspContextConfig,
  type GlspContext,
  type ConversionContext,
  type ConversionResult,
  type PaletteItem,
  type PaletteAction,
  type GlspDiagnostic,
  type LayoutData,
  type ContextMenuItem,
  type GlspFeatureProviders,
  type GlspFeatureName,
} from './glsp-providers.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Model API Types
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Change types
  type ChangeType,
  type NodeChangeType,
  type NodeChange,
  type ModelChangeEvent,
  // Subscription types
  type SubscriptionOptions,
  type SubscriptionHandle,
  // Response types
  type ModelApiErrorCode,
  type ModelApiError,
  type ModelApiResponse,
  type AstModelData,
  type ModelQuery,
  type GetModelOptions,
  // Converter types
  type ConvertOptions,
  type ConvertResult,
} from './model-api.js';
