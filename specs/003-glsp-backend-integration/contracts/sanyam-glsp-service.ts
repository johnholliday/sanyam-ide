/**
 * SanyamGlspService Contract
 *
 * This file defines the RPC service interface for GLSP operations.
 * The interface is defined in @sanyam/types to prevent symbol mismatches.
 *
 * @module @sanyam/types/glsp-service
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
// Geometry Types
// ============================================================================

export interface Point {
    x: number;
    y: number;
}

export interface Dimension {
    width: number;
    height: number;
}

// ============================================================================
// Response Types
// ============================================================================

export interface LoadModelResponse {
    success: boolean;
    gModel?: GModelRoot;
    metadata?: {
        positions: Record<string, Point>;
        sizes: Record<string, Dimension>;
        routingPoints?: Record<string, Point[]>;
    };
    error?: string;
}

export interface SaveModelResponse {
    success: boolean;
    error?: string;
}

export interface ExecuteOperationResponse {
    success: boolean;
    error?: string;
    edits?: TextEdit[];
    updatedModel?: GModelRoot;
}

export interface TextEdit {
    range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    newText: string;
}

export interface LayoutResponse {
    positions: Record<string, Point>;
    sizes: Record<string, Dimension>;
    routingPoints: Record<string, Point[]>;
    bounds: { width: number; height: number };
    error?: string;
}

export interface ToolPaletteResponse {
    groups: ToolPaletteGroup[];
    error?: string;
}

export interface ToolPaletteGroup {
    id: string;
    label: string;
    icon?: string;
    items: ToolPaletteItem[];
}

export interface ToolPaletteItem {
    id: string;
    label: string;
    icon?: string;
    sortString?: string;
    actions: unknown[];
}

export interface ContextMenuResponse {
    items: ContextMenuItem[];
    error?: string;
}

export interface ContextMenuItem {
    id: string;
    label: string;
    icon?: string;
    enabled: boolean;
    children?: ContextMenuItem[];
}

export interface ValidationResponse {
    markers: ValidationMarker[];
    isValid: boolean;
    errorCount: number;
    warningCount: number;
}

export interface ValidationMarker {
    elementId: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    source?: string;
}

// ============================================================================
// Operation Types
// ============================================================================

export type DiagramOperation =
    | CreateNodeOperation
    | DeleteElementOperation
    | ChangeBoundsOperation
    | CreateEdgeOperation
    | ReconnectEdgeOperation
    | EditLabelOperation;

export interface CreateNodeOperation {
    kind: 'createNode';
    elementTypeId: string;
    location?: Point;
    containerId?: string;
    args?: Record<string, unknown>;
}

export interface DeleteElementOperation {
    kind: 'deleteElement';
    elementIds: string[];
}

export interface ChangeBoundsOperation {
    kind: 'changeBounds';
    newBounds: Array<{
        elementId: string;
        newPosition?: Point;
        newSize?: Dimension;
    }>;
}

export interface CreateEdgeOperation {
    kind: 'createEdge';
    elementTypeId: string;
    sourceElementId: string;
    targetElementId: string;
    args?: Record<string, unknown>;
}

export interface ReconnectEdgeOperation {
    kind: 'reconnectEdge';
    edgeId: string;
    sourceElementId?: string;
    targetElementId?: string;
}

export interface EditLabelOperation {
    kind: 'editLabel';
    labelId: string;
    text: string;
}

// ============================================================================
// Layout Options
// ============================================================================

export interface LayoutOptions {
    algorithm?: 'layered' | 'force' | 'radial' | 'stress' | 'tree' | 'grid';
    direction?: 'DOWN' | 'UP' | 'LEFT' | 'RIGHT';
    spacing?: number;
    preserveExisting?: boolean;
}

// ============================================================================
// Service Interface
// ============================================================================

/**
 * RPC service interface for GLSP diagram operations.
 *
 * This interface is implemented by SanyamGlspBackendServiceImpl in the backend
 * and proxied by SanyamLanguageClientProvider in the frontend.
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
     * @returns GModel root with positions and sizes
     */
    loadModel(uri: string): Promise<LoadModelResponse>;

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
        position?: Point
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
}
