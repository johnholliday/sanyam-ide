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
  // Port types (FR-023, FR-024, FR-025)
  type PortPosition,
  type PortStyle,
  type PortConfig,
  type ConnectionRule,
  // Property classification types (FR-011)
  type FieldClassification,
  type PropertyOverride,
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
  // Grammar operation types
  type JSONSchema,
  type OperationDialogField,
  type OperationLicensing,
  type OperationExecution,
  type OperationEndpoint,
  type OperationContexts,
  type OperationInput,
  type GrammarOperation,
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

// ═══════════════════════════════════════════════════════════════════════════════
// Grammar Operation Handler Types
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Operation context types
  type OperationUser,
  type OperationContext,
  // Operation result types
  type OperationResult,
  // Progress types
  type ProgressCallback,
  // Handler types
  type OperationHandler,
  type OperationHandlers,
  // Async job types
  type JobStatus,
  type JobInfo,
  type JobResult,
} from './grammar-operation-handler.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Document Reference Types
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Reference types
  type FileUriReference,
  type InlineContentReference,
  type DocumentReference,
  // Type guards
  isFileUriReference,
  isInlineContentReference,
  // API request types
  type OperationRequestBase,
  type OperationRequestShorthand,
  type OperationRequest,
  // Utilities
  normalizeOperationRequest,
} from './document-reference.js';

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

// ═══════════════════════════════════════════════════════════════════════════════
// Widget Factory IDs
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Symbol-based factory IDs for decoupled widget lookup
  DIAGRAM_WIDGET_FACTORY_ID,
  COMPOSITE_EDITOR_WIDGET_FACTORY_ID,
  FORM_WIDGET_FACTORY_ID,
  // String-based factory IDs for WidgetFactory registration
  DIAGRAM_WIDGET_FACTORY_ID_STRING,
  COMPOSITE_EDITOR_WIDGET_FACTORY_ID_STRING,
  FORM_WIDGET_FACTORY_ID_STRING,
} from './widget-ids.js';

// ═══════════════════════════════════════════════════════════════════════════════
// GLSP Service Types (RPC Interface)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Service constants
  SanyamGlspServicePath,
  SanyamGlspService,
  // Geometry types
  type GlspPoint,
  type GlspDimension,
  // Response types
  type LoadModelResponse,
  type SaveModelResponse,
  type GlspTextEdit,
  type ExecuteOperationResponse,
  type LayoutResponse,
  type ToolPaletteResponse,
  type GlspToolPaletteGroup,
  type GlspToolPaletteItem,
  type ContextMenuResponse,
  type GlspContextMenuItem,
  type ValidationResponse,
  type GlspValidationMarker,
  // Properties panel types (FR-009 to FR-013)
  type GlspPropertyType,
  type GlspPropertyDescriptor,
  type GetPropertiesRequest,
  type GetPropertiesResponse,
  type UpdatePropertyRequest,
  type UpdatePropertyResponse,
  // Operation types
  type DiagramOperation,
  type CreateNodeOperation,
  type DeleteElementOperation,
  type ChangeBoundsOperation,
  type CreateEdgeOperation,
  type ReconnectEdgeOperation,
  type EditLabelOperation,
  // Layout types
  type LayoutOptions,
  type DiagramLayout,
  type ViewportState,
  // Service interface
  type SanyamGlspServiceInterface,
  // Language info (for dynamic diagram type registration)
  type DiagramLanguageInfo,
} from './glsp-service.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Properties Service Types (FR-009 to FR-013)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Property types (internal service types - use Glsp* types for RPC)
  type PropertyType,
  type PropertyValidation,
  type PropertyDescriptor,
  // Result types (internal)
  type PropertiesResult,
  type PropertyUpdateResult,
  // Service interface (internal)
  type PropertiesService,
  // Classification utilities
  classifyFieldValue,
  classifyField,
  // UI constants
  PROPERTIES_PANEL_ID,
  PROPERTIES_PANEL_VIEW_CONTAINER_ID,
  PropertiesPanelCommands,
  // Port utilities
  DEFAULT_PORT_STYLE,
  DEFAULT_PORT_OFFSET,
  PORT_SIZE,
  PortCssClasses,
  portAllowsEdgeType,
  ruleMatches,
  findMatchingRules,
  isConnectionValid,
  getEdgeTypeForConnection,
  calculatePortPosition,
} from './properties-service.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Cloud Storage, Authentication & Licensing Types (Feature 007)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Tier limits
  type SubscriptionTier,
  type TierLimits,
  DEFAULT_FREE_TIER_LIMITS,
} from './tier-limits.js';

export {
  // Feature registration
  type FeatureRegistration,
  FeatureContribution,
  type FeatureContribution as FeatureContributionInterface,
} from './feature-registration.js';

export {
  // Cloud documents
  type CloudDocument,
  type CreateDocumentRequest,
  type UpdateDocumentRequest,
  type DocumentVersion,
  type SharePermission,
  type DocumentShare,
  type CreateShareRequest,
  SANYAM_URI_SCHEME,
  ASSETS_PATH_SEGMENT,
} from './cloud-document.js';

export {
  // API keys
  type ApiScope,
  ALL_API_SCOPES,
  type ApiKey,
  type CreateApiKeyRequest,
  type CreateApiKeyResponse,
  API_KEY_PREFIX,
} from './api-key.js';

export {
  // User profiles
  type UserProfile,
  type AuthSession,
  type AuthStateEvent,
  type AuthState,
} from './user-profile.js';

export {
  // API errors
  type ApiErrorCode,
  type ApiError,
  type ErrorResponse,
  type TierLimitDetails,
  type PayloadTooLargeDetails,
  type OptimisticLockDetails,
  type RateLimitDetails,
  type ValidationErrorDetails,
  type FeatureNotAvailableDetails,
  createErrorResponse,
} from './api-errors.js';

export {
  // Pagination
  type PaginationDirection,
  type PaginationParams,
  type PaginationMeta,
  type PaginatedResponse,
  DEFAULT_PAGINATION_LIMIT,
  MAX_PAGINATION_LIMIT,
  CURSOR_DELIMITER,
  encodeCursor,
  decodeCursor,
} from './pagination.js';
