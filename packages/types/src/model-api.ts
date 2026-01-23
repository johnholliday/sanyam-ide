/**
 * Model API Types (T123)
 *
 * Type definitions for the Model API, supporting programmatic access
 * to AST models with change notifications.
 *
 * @packageDocumentation
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Change Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Type of change event.
 */
export type ChangeType = 'update' | 'saved' | 'closed' | 'initial';

/**
 * Type of node change within an update.
 */
export type NodeChangeType = 'added' | 'modified' | 'removed';

/**
 * Details about a single node change.
 */
export interface NodeChange {
  /** Type of change */
  type: NodeChangeType;
  /** ID of the changed node */
  nodeId: string;
  /** Type of the node (AST $type) */
  nodeType: string;
  /** The node data (for 'added' changes) */
  node?: unknown;
  /** Changed property name (for 'modified' changes) */
  property?: string;
  /** Previous value (for 'modified' changes) */
  oldValue?: unknown;
  /** New value (for 'modified' changes) */
  newValue?: unknown;
}

/**
 * Event sent to subscribers when a model changes.
 */
export interface ModelChangeEvent {
  /** Type of change event */
  type: ChangeType;
  /** URI of the changed document */
  uri: string;
  /** Document version after change */
  version: number;
  /** Timestamp of the change */
  timestamp: number;
  /** List of individual changes */
  changes?: NodeChange[];
  /** Full model content (if includeContent was true) */
  content?: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Subscription Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Options for creating a subscription.
 */
export interface SubscriptionOptions {
  /** Whether to include full model content in notifications */
  includeContent?: boolean;
  /** Debounce time in milliseconds (0 = immediate) */
  debounceMs?: number;
  /** Filter changes to specific node types */
  nodeTypes?: string[];
  /** Send initial notification immediately after subscribing */
  immediate?: boolean;
  /** Client identifier for cleanup on disconnect */
  clientId?: string;
}

/**
 * Handle returned from subscribe(), used to manage the subscription.
 */
export interface SubscriptionHandle {
  /** Unique subscription identifier */
  id: string;
  /** URI of the subscribed document */
  uri: string;
  /** Options used when creating the subscription */
  options: SubscriptionOptions;
  /** Whether the subscription is still active */
  readonly isActive: boolean;
  /** Dispose the subscription */
  dispose(): void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Model API Response Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Error codes for Model API operations.
 */
export type ModelApiErrorCode =
  | 'DOCUMENT_NOT_FOUND'
  | 'NODE_NOT_FOUND'
  | 'INVALID_URI'
  | 'INVALID_QUERY'
  | 'PARSE_ERROR'
  | 'INTERNAL_ERROR';

/**
 * Error information for failed operations.
 */
export interface ModelApiError {
  /** Error code */
  code: ModelApiErrorCode;
  /** Human-readable message */
  message: string;
  /** Additional details */
  details?: unknown;
}

/**
 * Generic response wrapper for Model API operations.
 */
export type ModelApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ModelApiError };

/**
 * Data returned from getModel().
 */
export interface AstModelData {
  /** Document URI */
  uri: string;
  /** Document version */
  version: number;
  /** Language ID */
  languageId: string;
  /** Root AST node (serialized) */
  root: unknown;
  /** Whether the document has parse errors */
  hasErrors?: boolean;
  /** Diagnostics (if requested) */
  diagnostics?: unknown[];
}

/**
 * Query options for partial model retrieval.
 */
export interface ModelQuery {
  /** Find node by ID */
  nodeId?: string;
  /** Find nodes by type */
  nodeType?: string;
  /** Find node by path (e.g., 'elements[0].name') */
  path?: string;
}

/**
 * Options for getModel().
 */
export interface GetModelOptions {
  /** Include diagnostics in response */
  includeDiagnostics?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Model Converter Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Options for AST to JSON conversion.
 */
export interface ConvertOptions {
  /** Maximum depth to traverse (prevents infinite recursion) */
  maxDepth?: number;
  /** Properties to exclude from output */
  excludeProperties?: string[];
  /** Properties to include (whitelist mode) */
  includeProperties?: string[];
  /** Whether to include $id for cross-references */
  includeIds?: boolean;
  /** Whether to handle circular references */
  handleCircular?: boolean;
}

/**
 * Result of AST conversion.
 */
export interface ConvertResult {
  /** Converted JSON data */
  data: unknown;
  /** Whether circular references were detected */
  hasCircular: boolean;
  /** IDs of nodes that were referenced circularly */
  circularRefs?: string[];
}
