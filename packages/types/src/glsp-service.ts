/**
 * SanyamGlspService Contract
 *
 * This file defines the RPC service interface for GLSP operations.
 * The interface is defined in @sanyam/types to prevent symbol mismatches
 * between frontend and backend packages.
 *
 * @module @sanyam/types/glsp-service
 * @packageDocumentation
 */

import type { GModelRoot } from './glsp-providers.js';

// ============================================================================
// Service Constants
// ============================================================================

/**
 * Service path for Theia JSON-RPC connection.
 * Used by both backend (JsonRpcConnectionHandler) and frontend (WebSocketConnectionProvider).
 */
export const SanyamGlspServicePath = '/services/sanyam-glsp';

/**
 * DI symbol for SanyamGlspService.
 * MUST be defined in shared types package to avoid symbol resolution issues.
 */
export const SanyamGlspService = Symbol('SanyamGlspService');

// ============================================================================
// Geometry Types (T004)
// ============================================================================

/**
 * Point in 2D space for diagram positioning.
 */
export interface GlspPoint {
    x: number;
    y: number;
}

/**
 * Dimension for element sizing.
 */
export interface GlspDimension {
    width: number;
    height: number;
}

// ============================================================================
// Response Types (T002)
// ============================================================================

/**
 * Response from loadModel() operation.
 * Contains the GModel representation of the document.
 */
export interface LoadModelResponse {
    /** Whether the operation succeeded */
    success: boolean;
    /** The graph model root (present on success) */
    gModel?: GModelRoot;
    /** Layout metadata for positioning */
    metadata?: {
        positions: Record<string, GlspPoint>;
        sizes: Record<string, GlspDimension>;
        routingPoints?: Record<string, GlspPoint[]>;
        /** Source ranges for outline↔diagram mapping (element ID → LSP range) */
        sourceRanges?: Record<string, { start: { line: number; character: number }; end: { line: number; character: number } }>;
        /** UUID registry exact-match index: fingerprintKey → UUID */
        idMap?: Record<string, string>;
        /** UUID registry fingerprints: UUID → StructuralFingerprint */
        fingerprints?: Record<string, unknown>;
    };
    /** Error message (present on failure) */
    error?: string;
}

/**
 * Response from saveModel() operation.
 */
export interface SaveModelResponse {
    /** Whether the operation succeeded */
    success: boolean;
    /** Error message (present on failure) */
    error?: string;
}

/**
 * Text edit to apply to the source document.
 */
export interface GlspTextEdit {
    range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    newText: string;
}

/**
 * Response from executeOperation() operation.
 */
export interface ExecuteOperationResponse {
    /** Whether the operation succeeded */
    success: boolean;
    /** Error message (present on failure) */
    error?: string;
    /** Text edits applied to the source document */
    edits?: GlspTextEdit[];
    /** Updated model after the operation */
    updatedModel?: GModelRoot;
}

/**
 * Response from requestLayout() operation.
 */
export interface LayoutResponse {
    /** Computed positions by element ID */
    positions: Record<string, GlspPoint>;
    /** Computed sizes by element ID */
    sizes: Record<string, GlspDimension>;
    /** Computed routing points by edge ID */
    routingPoints: Record<string, GlspPoint[]>;
    /** Bounding box of the entire diagram */
    bounds: { width: number; height: number };
    /** Error message (present on failure) */
    error?: string;
}

/**
 * Response from getToolPalette() operation.
 */
export interface ToolPaletteResponse {
    /** Tool palette groups */
    groups: GlspToolPaletteGroup[];
    /** Error message (present on failure) */
    error?: string;
}

/**
 * Tool palette group containing related tools.
 */
export interface GlspToolPaletteGroup {
    /** Unique identifier */
    id: string;
    /** Display label */
    label: string;
    /** Icon identifier */
    icon?: string;
    /** Tools in this group */
    items: GlspToolPaletteItem[];
}

/**
 * Individual tool in the palette.
 */
export interface GlspToolPaletteItem {
    /** Unique identifier */
    id: string;
    /** Display label */
    label: string;
    /** Icon identifier */
    icon?: string;
    /** Sort key for ordering */
    sortString?: string;
    /** Actions triggered when selected */
    actions: unknown[];
}

/**
 * Response from getContextMenu() operation.
 */
export interface ContextMenuResponse {
    /** Menu items */
    items: GlspContextMenuItem[];
    /** Error message (present on failure) */
    error?: string;
}

/**
 * Context menu item.
 */
export interface GlspContextMenuItem {
    /** Unique identifier */
    id: string;
    /** Display label */
    label: string;
    /** Icon identifier */
    icon?: string;
    /** Whether the item is enabled */
    enabled: boolean;
    /** Child menu items (for submenus) */
    children?: GlspContextMenuItem[];
}

/**
 * Response from validate() operation.
 */
export interface ValidationResponse {
    /** Validation markers */
    markers: GlspValidationMarker[];
    /** Whether the model is valid (no errors) */
    isValid: boolean;
    /** Count of error-level markers */
    errorCount: number;
    /** Count of warning-level markers */
    warningCount: number;
}

/**
 * Validation marker for a diagram element.
 */
export interface GlspValidationMarker {
    /** ID of the affected element */
    elementId: string;
    /** Severity level */
    severity: 'error' | 'warning' | 'info';
    /** Human-readable message */
    message: string;
    /** Source of the marker (e.g., validator name) */
    source?: string;
}

// ============================================================================
// Properties Panel Types (FR-009 to FR-013)
// ============================================================================

/**
 * Type of a property value for form control selection.
 */
export type GlspPropertyType = 'string' | 'number' | 'boolean' | 'enum' | 'reference' | 'array' | 'object';

/**
 * Descriptor for a property displayed in the properties panel.
 */
export interface GlspPropertyDescriptor {
    /** Property name (AST field name) */
    name: string;
    /** Display label for the property */
    label: string;
    /** Value type determines form control */
    type: GlspPropertyType;
    /** Current value */
    value: unknown;
    /** For enum type: available options */
    options?: string[];
    /** For reference type: valid target types */
    referenceTypes?: string[];
    /** Whether property is read-only */
    readOnly?: boolean;
    /** Help text / description */
    description?: string;
    /** For array/object types: descriptors for nested fields (template for array elements, fields for objects) */
    children?: GlspPropertyDescriptor[];
    /** For array type: AST $type of array elements (only set when all elements share the same type) */
    elementType?: string;
}

/**
 * Request to get properties for selected elements.
 */
export interface GetPropertiesRequest {
    /** Document URI */
    uri: string;
    /** Element IDs to inspect */
    elementIds: string[];
}

/**
 * Response from getProperties() operation.
 */
export interface GetPropertiesResponse {
    /** Whether the operation succeeded */
    success: boolean;
    /** Element ID(s) being inspected */
    elementIds: string[];
    /** Available properties (common to all selected if multi-select) */
    properties: GlspPropertyDescriptor[];
    /** Type label for display (e.g., "Entity" or "3 Entities") */
    typeLabel: string;
    /** Whether multiple elements are selected */
    isMultiSelect: boolean;
    /** Error message if operation failed */
    error?: string;
}

/**
 * Request to update a property value.
 */
export interface UpdatePropertyRequest {
    /** Document URI */
    uri: string;
    /** Element ID(s) to update */
    elementIds: string[];
    /** Property name to update */
    property: string;
    /** New value */
    value: unknown;
}

/**
 * Response from updateProperty() operation.
 */
export interface UpdatePropertyResponse {
    /** Whether update succeeded */
    success: boolean;
    /** Error message if failed */
    error?: string;
    /** Text edits applied (for sync) */
    edits?: GlspTextEdit[];
    /** Updated property descriptors (for refresh) */
    properties?: GlspPropertyDescriptor[];
}

// ============================================================================
// Operation Types (T003)
// ============================================================================

/**
 * Union type for all diagram operations.
 * These operations are triggered by user interactions with the diagram.
 */
export type DiagramOperation =
    | CreateNodeOperation
    | DeleteElementOperation
    | ChangeBoundsOperation
    | CreateEdgeOperation
    | ReconnectEdgeOperation
    | EditLabelOperation;

/**
 * Operation to create a new node.
 */
export interface CreateNodeOperation {
    kind: 'createNode';
    /** GLSP type ID for the new element */
    elementTypeId: string;
    /** Position for the new node */
    location?: GlspPoint;
    /** ID of the container element (for nested nodes) */
    containerId?: string;
    /** Additional arguments */
    args?: Record<string, unknown>;
}

/**
 * Operation to delete elements.
 */
export interface DeleteElementOperation {
    kind: 'deleteElement';
    /** IDs of elements to delete */
    elementIds: string[];
}

/**
 * Operation to change element positions/sizes.
 */
export interface ChangeBoundsOperation {
    kind: 'changeBounds';
    /** New bounds for each affected element */
    newBounds: Array<{
        elementId: string;
        newPosition?: GlspPoint;
        newSize?: GlspDimension;
    }>;
}

/**
 * Operation to create an edge between nodes.
 */
export interface CreateEdgeOperation {
    kind: 'createEdge';
    /** GLSP type ID for the edge */
    elementTypeId: string;
    /** ID of the source element */
    sourceElementId: string;
    /** ID of the target element */
    targetElementId: string;
    /** Additional arguments */
    args?: Record<string, unknown>;
}

/**
 * Operation to reconnect an existing edge.
 */
export interface ReconnectEdgeOperation {
    kind: 'reconnectEdge';
    /** ID of the edge to reconnect */
    edgeId: string;
    /** New source element ID (if changing source) */
    sourceElementId?: string;
    /** New target element ID (if changing target) */
    targetElementId?: string;
}

/**
 * Operation to edit a label's text.
 */
export interface EditLabelOperation {
    kind: 'editLabel';
    /** ID of the label element */
    labelId: string;
    /** New text for the label */
    text: string;
}

// ============================================================================
// Layout Types (T004)
// ============================================================================

/**
 * Options for layout computation.
 */
export interface LayoutOptions {
    /** Layout algorithm to use */
    algorithm?: 'layered' | 'force' | 'radial' | 'stress' | 'tree' | 'grid';
    /** Direction for layered layout */
    direction?: 'DOWN' | 'UP' | 'LEFT' | 'RIGHT';
    /** Spacing between elements */
    spacing?: number;
    /** Preserve existing positions for nodes that have them */
    preserveExisting?: boolean;
}

/**
 * Persisted diagram layout data (T004).
 * Stored in user profile storage, keyed by file URI.
 */
export interface DiagramLayout {
    /** Schema version for migration */
    version: 1;
    /** File URI this layout is for */
    fileUri: string;
    /** Timestamp of last save */
    timestamp: number;
    /** Node positions by element ID */
    positions: Record<string, GlspPoint>;
    /** Node sizes by element ID */
    sizes: Record<string, GlspDimension>;
    /** Edge routing points by element ID */
    routingPoints?: Record<string, GlspPoint[]>;
    /** Viewport state */
    viewport?: ViewportState;
}

/**
 * Viewport state for layout persistence.
 */
export interface ViewportState {
    /** Scroll position */
    scroll: GlspPoint;
    /** Zoom level */
    zoom: number;
}

// ============================================================================
// Service Interface (T001)
// ============================================================================

/**
 * RPC service interface for GLSP diagram operations.
 *
 * This interface is implemented by SanyamGlspBackendServiceImpl in the backend
 * and proxied by SanyamLanguageClientProvider in the frontend.
 *
 * All methods return Promises for async RPC compatibility.
 *
 * @example Backend registration:
 * ```typescript
 * bind(ConnectionHandler).toDynamicValue(ctx =>
 *     new JsonRpcConnectionHandler(SanyamGlspServicePath, () =>
 *         ctx.container.get(SanyamGlspService)
 *     )
 * ).inSingletonScope();
 * ```
 *
 * @example Frontend proxy:
 * ```typescript
 * bind(SanyamGlspService).toDynamicValue(ctx => {
 *     const provider = ctx.container.get(WebSocketConnectionProvider);
 *     return provider.createProxy<SanyamGlspService>(SanyamGlspServicePath);
 * }).inSingletonScope();
 * ```
 */
export interface SanyamGlspService {
    /**
     * Load the diagram model for a file.
     * Converts AST to GModel and returns with layout metadata.
     *
     * @param uri - File URI (file://)
     * @param savedIdMap - Optional saved UUID registry idMap for persistence
     * @param savedFingerprints - Optional saved UUID registry fingerprints
     * @returns GModel root with positions, sizes, sourceRanges, and UUID registry
     */
    loadModel(uri: string, savedIdMap?: Record<string, string>, savedFingerprints?: Record<string, unknown>): Promise<LoadModelResponse>;

    /**
     * Save the current model state.
     * Persists any pending changes to the source file.
     *
     * @param uri - File URI
     */
    saveModel(uri: string): Promise<SaveModelResponse>;

    /**
     * Execute a diagram operation.
     * Converts diagram edit to text edit and applies it.
     *
     * @param uri - File URI
     * @param operation - Operation to execute
     * @returns Result with any text edits applied
     */
    executeOperation(uri: string, operation: DiagramOperation): Promise<ExecuteOperationResponse>;

    /**
     * Request automatic layout computation.
     *
     * @param uri - File URI
     * @param options - Layout algorithm options
     * @returns Computed positions and sizes
     */
    requestLayout(uri: string, options?: LayoutOptions): Promise<LayoutResponse>;

    /**
     * Get the tool palette for a file.
     * Returns available creation tools based on grammar.
     *
     * @param uri - File URI
     */
    getToolPalette(uri: string): Promise<ToolPaletteResponse>;

    /**
     * Get context menu items for selected elements.
     *
     * @param uri - File URI
     * @param selectedIds - IDs of selected elements
     * @param position - Click position (optional)
     */
    getContextMenu(
        uri: string,
        selectedIds: string[],
        position?: GlspPoint
    ): Promise<ContextMenuResponse>;

    /**
     * Validate the diagram model.
     * Returns validation markers for display.
     *
     * @param uri - File URI
     */
    validate(uri: string): Promise<ValidationResponse>;

    /**
     * Synchronize document content from frontend.
     * Called when text editor content changes.
     *
     * @param uri - File URI
     * @param content - New document content
     * @param version - Document version number
     */
    syncDocument(uri: string, content: string, version: number): Promise<void>;

    /**
     * Get list of supported operations.
     * Used for capability negotiation.
     */
    getSupportedOperations(): Promise<{ operations: string[] }>;

    /**
     * Get list of diagram-enabled languages.
     * Returns languages that have diagrammingEnabled=true in their manifest.
     *
     * @returns Array of diagram-enabled language configurations
     */
    getDiagramLanguages(): Promise<DiagramLanguageInfo[]>;

    /**
     * Get properties for selected diagram elements (FR-009, FR-010).
     *
     * Extracts editable properties from AST nodes corresponding to
     * the selected diagram elements. For multi-select, returns only
     * properties common to all selected elements.
     *
     * @param uri - File URI
     * @param elementIds - IDs of selected diagram elements
     * @returns Properties result with descriptors
     */
    getProperties(uri: string, elementIds: string[]): Promise<GetPropertiesResponse>;

    /**
     * Update a property value for selected elements (FR-012).
     *
     * Modifies the AST text to reflect the new property value.
     * For multi-select, applies the change to all selected elements.
     *
     * @param uri - File URI
     * @param elementIds - IDs of elements to update
     * @param property - Property name to update
     * @param value - New value
     * @returns Update result with any text edits
     */
    updateProperty(
        uri: string,
        elementIds: string[],
        property: string,
        value: unknown
    ): Promise<UpdatePropertyResponse>;

    /**
     * Execute a workspace command.
     *
     * Routes `sanyam.operation.{languageId}.{operationId}` commands to
     * the appropriate operation handler registered in the grammar contribution.
     *
     * @param command - Full command name (e.g., 'sanyam.operation.ecml.generate-powershell')
     * @param args - Command arguments array
     * @returns Command execution result
     */
    executeCommand(command: string, args: unknown[]): Promise<unknown>;

    /**
     * Set the collapsed state of a container node.
     *
     * Toggles the expand/collapse state and regenerates the model
     * with the updated collapsed set.
     *
     * @param uri - File URI
     * @param elementId - ID of the container element
     * @param collapsed - Whether the element should be collapsed
     * @returns Updated model response
     */
    setCollapsed(uri: string, elementId: string, collapsed: boolean): Promise<LoadModelResponse>;
}

/**
 * Information about a diagram-enabled language.
 */
export interface DiagramLanguageInfo {
    /** Language ID */
    languageId: string;
    /** Display name */
    displayName: string;
    /** File extensions this language handles (e.g., ['.spdk', '.entity']) */
    fileExtensions: string[];
    /** Icon class for the diagram type */
    iconClass?: string;
}

/**
 * Type alias for the SanyamGlspService interface.
 * Used for typing the service proxy.
 */
export type SanyamGlspServiceInterface = SanyamGlspService;
