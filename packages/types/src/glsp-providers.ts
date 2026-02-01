/**
 * GLSP Feature Provider Contracts
 *
 * This file defines the interfaces for GLSP feature providers that grammar packages
 * can implement to customize diagram behavior. All methods are optional -
 * manifest-driven defaults are used when not provided.
 *
 * @packageDocumentation
 */

import type { AstNode, LangiumDocument } from 'langium';
import type { LangiumServices, LangiumSharedServices } from 'langium/lsp';
import type { GrammarManifest, DiagramTypeConfig, RootTypeConfig, NodeShape } from './grammar-manifest.js';
import type { MaybePromise } from './lsp-providers.js';

// ═══════════════════════════════════════════════════════════════════════════════
// GLSP TYPE PLACEHOLDERS
// These will be replaced with actual @eclipse-glsp/server types when integrated
// ═══════════════════════════════════════════════════════════════════════════════

/** Placeholder for GLSP GModelRoot */
export interface GModelRoot {
  id: string;
  type: string;
  children: GModelElement[];
  revision?: number;
}

/** Placeholder for GLSP GModelElement */
export interface GModelElement {
  id: string;
  type: string;
  children?: GModelElement[];
  /** CSS classes for styling */
  cssClasses?: string[];
}

/** Placeholder for GLSP GNode */
export interface GNode extends GModelElement {
  readonly position?: Point;
  readonly size?: Dimension;
  readonly children?: GModelElement[];
  /** Visual shape for rendering (rectangle, rounded, ellipse, diamond, hexagon, pill) */
  readonly shape?: NodeShape;
}

/** Placeholder for GLSP GEdge */
export interface GEdge extends GModelElement {
  readonly sourceId: string;
  readonly targetId: string;
  readonly routingPoints?: Point[];
}

/** Placeholder for GLSP GLabel */
export interface GLabel extends GModelElement {
  readonly text: string;
}

/** Placeholder for GLSP GPort */
export interface GPort extends GModelElement {
  readonly position?: Point;
}

/** Point in 2D space */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Dimension (width/height) */
export interface Dimension {
  readonly width: number;
  readonly height: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Model metadata storage for diagram elements.
 */
export interface ModelMetadata {
  /** Node positions by ID */
  positions: Map<string, Point>;
  /** Node sizes by ID */
  sizes: Map<string, Dimension>;
  /** Edge routing points by ID */
  routingPoints: Map<string, Point[]>;
  /** Collapsed state by ID */
  collapsed: Set<string>;
  /** Source ranges by element ID (LSP line/character positions from CST nodes) */
  sourceRanges?: Map<string, { start: { line: number; character: number }; end: { line: number; character: number } }>;
}

/**
 * Configuration for GLSP context.
 */
export interface GlspContextConfig {
  /** Custom feature providers to override defaults */
  providers?: Partial<GlspFeatureProviders>;
  /** Whether to enable automatic layout */
  autoLayout?: boolean;
  /** Whether to enable validation */
  validation?: boolean;
}

/**
 * Context for GLSP operations, extending LSP context with diagram-specific data.
 *
 * @typeParam T - The root AST node type for the document
 */
export interface GlspContext<T extends AstNode = AstNode> {
  /** The Langium document (source of truth) */
  readonly document: LangiumDocument<T>;
  /** Language-specific services */
  readonly services: LangiumServices;
  /** Shared services across all languages */
  readonly shared?: LangiumSharedServices;
  /** Grammar manifest with diagram configuration */
  readonly manifest?: GrammarManifest;
  /** Current diagram type configuration */
  readonly diagramType?: DiagramTypeConfig;
  /** The root AST node */
  readonly root?: T;
  /** The GModel representation */
  gModel?: GModelRoot;
  /** Model metadata (positions, sizes, etc.) */
  metadata?: ModelMetadata;
  /** Context configuration */
  config?: GlspContextConfig;
}

/**
 * Context passed during AST ↔ GModel conversion.
 */
export interface ConversionContext {
  /** Grammar manifest for configuration */
  readonly manifest: GrammarManifest;
  /** Diagram type being converted */
  readonly diagramType: DiagramTypeConfig;
  /** Counter for generating unique IDs */
  readonly idCounter: { value: number };
  /** Map from AST node to GModel element ID */
  readonly nodeMap: Map<AstNode, string>;
  /** Map from GModel element ID to AST node */
  readonly idMap: Map<string, AstNode>;
}

/**
 * Result of AST to GModel conversion.
 */
export interface ConversionResult {
  /** The generated graph model root */
  readonly root: GModelRoot;
  /** Map from AST node to GModel element ID */
  readonly nodeMap: Map<AstNode, string>;
  /** Map from GModel element ID to AST node */
  readonly idMap: Map<string, AstNode>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL PALETTE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Item in the diagram tool palette.
 */
export interface PaletteItem {
  /** Unique identifier for the palette item */
  readonly id: string;
  /** Display label */
  readonly label: string;
  /** Icon identifier (VS Code codicon or custom) */
  readonly icon: string;
  /** Sort key for ordering within group */
  readonly sortString?: string;
  /** Actions triggered when item is selected */
  readonly actions: PaletteAction[];
}

/**
 * Action triggered by a palette item.
 */
export interface PaletteAction {
  /** Action kind (e.g., 'createElement', 'createEdge') */
  readonly kind: string;
  /** Element type to create (GLSP type ID) */
  readonly elementTypeId?: string;
  /** Additional action arguments */
  readonly args?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Diagram-specific diagnostic/validation message.
 */
export interface GlspDiagnostic {
  /** ID of the affected diagram element */
  readonly elementId: string;
  /** Severity level */
  readonly severity: 'error' | 'warning' | 'info';
  /** Human-readable message */
  readonly message: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Layout data for a single element.
 */
export interface LayoutData {
  /** New position (if changed) */
  readonly position?: Point;
  /** New size (if changed) */
  readonly size?: Dimension;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT MENU TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context menu item.
 */
export interface ContextMenuItem {
  /** Unique identifier */
  readonly id: string;
  /** Display label */
  readonly label: string;
  /** Optional icon */
  readonly icon?: string;
  /** Submenu items */
  readonly children?: ContextMenuItem[];
  /** Action to execute when selected */
  readonly action?: PaletteAction;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GLSP FEATURE PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GLSP feature providers that grammar packages can override.
 *
 * Grammar packages implement this interface to customize diagram behavior.
 * All properties are optional - manifest-driven defaults are used when not provided.
 *
 * @example
 * ```typescript
 * export const myGlspProviders: GlspFeatureProviders = {
 *   astToGModel: {
 *     getLabel: (ast) => ast.name ?? 'Unnamed'
 *   }
 * };
 * ```
 */
export interface GlspFeatureProviders {
  // ═══════════════════════════════════════════════════════════════════════════
  // MODEL CONVERSION - AST TO GMODEL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Custom AST → GModel conversion.
   *
   * Implement these methods to customize how the text model is rendered as a diagram.
   */
  astToGModel?: {
    /**
     * Convert entire AST to GModel.
     * If provided, replaces the default conversion entirely.
     *
     * The context provides access to the document, root AST node, and metadata.
     */
    convert?(context: GlspContext): MaybePromise<GModelRoot>;

    /**
     * Create a GNode for a specific AST node.
     * Return null to skip this node.
     */
    createNode?(
      ast: AstNode,
      config: RootTypeConfig,
      context: ConversionContext
    ): MaybePromise<GNode | null>;

    /**
     * Create a GEdge between two AST nodes.
     * Return null to skip this relationship.
     */
    createEdge?(
      source: AstNode,
      target: AstNode,
      relationName: string,
      context: ConversionContext
    ): MaybePromise<GEdge | null>;

    /**
     * Extract the display label for an AST node.
     * Default: uses the `name` property if available.
     */
    getLabel?(ast: AstNode): string;

    /**
     * Extract the position for an AST node.
     * Default: looks for `x`/`y` or `position` properties.
     */
    getPosition?(ast: AstNode): Point | undefined;

    /**
     * Extract the size for an AST node.
     * Default: looks for `width`/`height` or `size` properties.
     */
    getSize?(ast: AstNode): Dimension | undefined;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // MODEL CONVERSION - GMODEL TO AST
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Custom GModel → AST conversion.
   *
   * Implement these methods to customize how diagram changes modify the text model.
   */
  gmodelToAst?: {
    /**
     * Apply a position change to an AST node.
     * Called when a diagram element is moved.
     */
    applyPosition?(ast: AstNode, position: Point): MaybePromise<void>;

    /**
     * Apply a size change to an AST node.
     * Called when a diagram element is resized.
     */
    applySize?(ast: AstNode, size: Dimension): MaybePromise<void>;

    /**
     * Create a new AST node from a diagram create operation.
     * Called when a user adds an element via the tool palette.
     */
    createNode?(
      glspType: string,
      position: Point,
      context: GlspContext
    ): MaybePromise<AstNode>;

    /**
     * Create an edge relationship in the AST.
     * Called when a user draws an edge between elements.
     */
    createEdge?(
      glspType: string,
      sourceId: string,
      targetId: string,
      context: GlspContext
    ): MaybePromise<void>;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // TOOL PALETTE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Custom tool palette items.
   *
   * Use this to add palette items beyond what the manifest defines.
   */
  toolPalette?: {
    /**
     * Get additional palette items for the current diagram type.
     */
    getAdditionalItems?(context: GlspContext): MaybePromise<PaletteItem[]>;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Diagram-specific validation.
   *
   * Use this to add visual validation indicators on diagram elements.
   */
  validation?: {
    /**
     * Validate the diagram and return diagnostics.
     * Diagnostics are displayed as markers on affected elements.
     */
    validate?(root: GModelRoot, context: GlspContext): MaybePromise<GlspDiagnostic[]>;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYOUT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Custom layout algorithm.
   *
   * Use this to implement automatic diagram layout.
   */
  layout?: {
    /**
     * Compute layout for all elements in the diagram.
     * Returns a map of element ID to new layout data.
     */
    computeLayout?(root: GModelRoot, context: GlspContext): MaybePromise<Map<string, LayoutData>>;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXT MENU
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Custom context menu items.
   *
   * Use this to add right-click menu options for diagram elements.
   */
  contextMenu?: {
    /**
     * Get context menu items for the selected elements.
     */
    getItems?(elementIds: string[], context: GlspContext): MaybePromise<ContextMenuItem[]>;
  };
}

/**
 * All GLSP feature names for selective disabling.
 */
export type GlspFeatureName = keyof GlspFeatureProviders;
