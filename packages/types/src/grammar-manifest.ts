/**
 * @sanyam/types - Grammar Manifest Type Definitions
 *
 * This file defines the type contracts for GrammarManifest and related types
 * used by the SANYAM platform for grammar-agnostic language support.
 *
 * @packageDocumentation
 */

// =============================================================================
// Primitive Types
// =============================================================================

// =============================================================================
// SVG Icon Types
// =============================================================================

/** A single SVG path segment with optional fill color and fill rule. */
export interface IconSvgPath {
    readonly d: string;
    readonly fill?: string;        // e.g., '#1177D7'
    readonly fillRule?: 'evenodd';
    readonly opacity?: number;     // e.g., 0.5
}

/** Parsed SVG icon data with viewBox and colored paths. */
export interface IconSvgData {
    readonly viewBox: string;                 // e.g., '0 0 32 32'
    readonly paths: readonly IconSvgPath[];
}

/**
 * Available shapes for diagram nodes.
 *
 * - `rectangle`: Standard rectangular box
 * - `rounded`: Rectangle with rounded corners
 * - `ellipse`: Oval/circular shape
 * - `diamond`: Rotated square (decision points)
 * - `hexagon`: Six-sided polygon (actions/operations)
 * - `pill`: Rectangle with fully rounded ends
 */
export type NodeShape = 'rectangle' | 'rounded' | 'ellipse' | 'diamond' | 'hexagon' | 'pill';

/**
 * Input types for template wizard fields.
 */
export type InputType = 'string' | 'number' | 'boolean' | 'select';

/**
 * Action types for tool palette items.
 */
export type ActionType = 'create-node' | 'create-edge';

/**
 * Size specification for diagram elements.
 */
export interface Size {
  readonly width: number;
  readonly height: number;
}

// =============================================================================
// Port Types (FR-023, FR-024, FR-025)
// =============================================================================

/**
 * Position of a port on a node boundary.
 */
export type PortPosition = 'top' | 'bottom' | 'left' | 'right';

/**
 * Visual style for port rendering.
 */
export type PortStyle = 'circle' | 'square' | 'diamond';

/**
 * Configuration for a connection port on a diagram node.
 *
 * Ports provide named connection points on nodes with
 * grammar-defined connection rules.
 *
 * @example
 * ```typescript
 * const inputPort: PortConfig = {
 *   id: 'input',
 *   label: 'Data Input',
 *   position: 'left',
 *   offset: 0.5,
 *   style: 'circle',
 *   allowedConnections: ['edge:data-flow'],
 * };
 * ```
 */
export interface PortConfig {
  /**
   * Unique identifier for this port within the node.
   * Used to reference the port in connection rules.
   */
  readonly id: string;

  /**
   * Display label shown on hover.
   * Defaults to the id if not provided.
   */
  readonly label?: string;

  /**
   * Which edge of the node the port appears on.
   */
  readonly position: PortPosition;

  /**
   * Position along the edge as a fraction (0-1).
   * - 0 = start of edge
   * - 0.5 = center (default)
   * - 1 = end of edge
   */
  readonly offset?: number;

  /**
   * Visual shape of the port.
   * Defaults to 'circle'.
   */
  readonly style?: PortStyle;

  /**
   * Edge types that can connect to this port.
   * If not specified, any edge type is allowed.
   * Use GLSP type identifiers (e.g., 'edge:reference').
   */
  readonly allowedConnections?: readonly string[];
}

/**
 * Rule defining valid connections between node types and ports.
 *
 * Connection rules are evaluated during edge creation to determine
 * if a connection is allowed. The rule matches if all specified
 * criteria match (AND logic). Use '*' for wildcards.
 *
 * @example
 * ```typescript
 * // Data can flow from Process output to Storage input
 * const dataFlowRule: ConnectionRule = {
 *   sourceType: 'node:process',
 *   sourcePort: 'output',
 *   targetType: 'node:storage',
 *   targetPort: 'input',
 *   edgeType: 'edge:data-flow',
 * };
 *
 * // Any node can reference any other node
 * const anyReferenceRule: ConnectionRule = {
 *   sourceType: '*',
 *   targetType: '*',
 *   edgeType: 'edge:reference',
 * };
 * ```
 */
export interface ConnectionRule {
  /**
   * GLSP type of the source node.
   * Use '*' to match any node type.
   */
  readonly sourceType: string;

  /**
   * Port ID on the source node.
   * - Omit or use '*' to match any port
   * - Use undefined for edge-of-node connections (no specific port)
   */
  readonly sourcePort?: string;

  /**
   * GLSP type of the target node.
   * Use '*' to match any node type.
   */
  readonly targetType: string;

  /**
   * Port ID on the target node.
   * - Omit or use '*' to match any port
   * - Use undefined for edge-of-node connections (no specific port)
   */
  readonly targetPort?: string;

  /**
   * GLSP type of edge to create for this connection.
   */
  readonly edgeType: string;

  /**
   * Whether this rule allows self-connections (source = target node).
   * Defaults to false.
   */
  readonly allowSelfConnection?: boolean;
}

// =============================================================================
// Property Classification Types (FR-011)
// =============================================================================

/**
 * Classification of an AST field for properties panel display.
 *
 * - 'property': Displayed in the properties panel (editable)
 * - 'child': Displayed hierarchically in outline/diagram (structural)
 */
export type FieldClassification = 'property' | 'child';

/**
 * Override for automatic property/child classification.
 *
 * By default, scalar types (string, number, boolean, enum) are classified
 * as properties, and object/array types as children. This override allows
 * grammar manifests to explicitly control classification per field.
 *
 * @example
 * ```typescript
 * // Force 'description' to be a property even if it's an object
 * const override: PropertyOverride = {
 *   property: 'description',
 *   classification: 'property',
 * };
 * ```
 */
export interface PropertyOverride {
  /** AST property name to override */
  readonly property: string;
  /** Override classification */
  readonly classification: FieldClassification;
}

// =============================================================================
// Template Configuration
// =============================================================================

/**
 * Input field definition for file creation wizard.
 *
 * @example
 * ```typescript
 * const nameInput: TemplateInput = {
 *   id: 'name',
 *   label: 'Entity Name',
 *   type: 'string',
 *   required: true
 * };
 * ```
 */
export interface TemplateInput {
  /** Unique identifier for the input field */
  readonly id: string;

  /** Display label shown to user */
  readonly label: string;

  /** Input field type */
  readonly type: InputType;

  /** Whether the field is mandatory */
  readonly required: boolean;

  /** Options for 'select' type inputs */
  readonly options?: readonly string[];

  /** Default value if not provided by user */
  readonly default?: string | number | boolean;
}

// =============================================================================
// Diagram Configuration
// =============================================================================

/**
 * Visual configuration for a diagram node representing an AST type.
 */
export interface DiagramNodeConfig {
  /** GLSP node type identifier (e.g., 'node:application') */
  readonly glspType: string;

  /** Visual shape of the node */
  readonly shape: NodeShape;

  /**
   * CSS class for styling.
   *
   * Uses grammar-qualified naming: `{GrammarName}.{AstType}`
   * Example: `Workflow.Step`, `Ecml.Actor`
   *
   * This enables targeted CSS styling per grammar:
   * ```css
   * .Workflow.Step { fill: #d1fae5; stroke: #059669; }
   * .Workflow.Step.selected { stroke: #2563eb; }
   * ```
   */
  readonly cssClass: string;

  /** Default dimensions for new nodes */
  readonly defaultSize: Size;

  /**
   * Hover tooltip template.
   *
   * Supports `${name}` placeholder for dynamic content.
   * Example: `"Step: ${name}"` → `"Step: ProcessOrder"`
   */
  readonly tooltip?: string;

  /**
   * Port configurations for this node type (FR-023).
   *
   * If specified, the node will display connection ports at the
   * configured positions. Connections will snap to these ports.
   *
   * @example
   * ```typescript
   * ports: [
   *   { id: 'input', position: 'left', style: 'circle' },
   *   { id: 'output', position: 'right', style: 'circle' },
   * ]
   * ```
   */
  readonly ports?: readonly PortConfig[];

  /**
   * Whether this node type can contain child nodes.
   *
   * Container nodes render children inside a body compartment
   * with an expand/collapse button in the header.
   *
   * @example
   * ```typescript
   * { glspType: 'node:activity', shape: 'rectangle', isContainer: true, ... }
   * ```
   */
  readonly isContainer?: boolean;
}

/**
 * Node type availability in a diagram.
 */
export interface NodeTypeConfig {
  /** GLSP type identifier */
  readonly glspType: string;

  /** Whether users can create this node type */
  readonly creatable: boolean;

  /** Whether this node type is visible */
  readonly showable: boolean;
}

/**
 * Edge type availability in a diagram.
 */
export interface EdgeTypeConfig {
  /** GLSP type identifier */
  readonly glspType: string;

  /** Whether users can create this edge type */
  readonly creatable: boolean;

  /** Whether this edge type is visible */
  readonly showable: boolean;

  /** Whether edges of this type render with dashed strokes (and animate when animated-edges is enabled) */
  readonly dashed?: boolean;
}

/**
 * Action triggered by a palette tool.
 */
export interface ToolAction {
  /** Type of action to perform */
  readonly type: ActionType;

  /** GLSP type to create */
  readonly glspType: string;
}

/**
 * Single item in the tool palette.
 */
export interface ToolPaletteItem {
  /** Unique identifier */
  readonly id: string;

  /** Display label */
  readonly label: string;

  /** VS Code Codicon name */
  readonly icon: string;

  /** Action to perform when clicked */
  readonly action: ToolAction;
}

/**
 * Group of related tools in the palette.
 */
export interface ToolPaletteGroup {
  /** Unique group identifier */
  readonly id: string;

  /** Display label */
  readonly label: string;

  /** Tools in this group */
  readonly items: readonly ToolPaletteItem[];
}

/**
 * Tool palette configuration for a diagram type.
 */
export interface ToolPaletteConfig {
  /** Tool groups */
  readonly groups: readonly ToolPaletteGroup[];
}

/**
 * Configuration for a diagram view type.
 *
 * @example
 * ```typescript
 * const architectureDiagram: DiagramTypeConfig = {
 *   id: 'myapp-architecture',
 *   displayName: 'Architecture Diagram',
 *   fileType: 'Model',
 *   nodeTypes: [...],
 *   edgeTypes: [...],
 *   toolPalette: { groups: [...] },
 *   connectionRules: [...],
 *   propertyOverrides: [...]
 * };
 * ```
 */
export interface DiagramTypeConfig {
  /** Unique diagram type identifier */
  readonly id: string;

  /** Human-readable name */
  readonly displayName: string;

  /** Associated file type */
  readonly fileType: string;

  /** Available node types */
  readonly nodeTypes: readonly NodeTypeConfig[];

  /** Available edge types */
  readonly edgeTypes: readonly EdgeTypeConfig[];

  /** Tool palette configuration */
  readonly toolPalette: ToolPaletteConfig;

  /**
   * Connection rules for port-based connections (FR-024).
   *
   * Defines which connections are valid between node types and ports.
   * If not specified, all connections are allowed.
   *
   * @example
   * ```typescript
   * connectionRules: [
   *   { sourceType: 'node:process', sourcePort: 'output',
   *     targetType: 'node:storage', targetPort: 'input',
   *     edgeType: 'edge:data-flow' },
   *   { sourceType: '*', targetType: '*', edgeType: 'edge:reference' }
   * ]
   * ```
   */
  readonly connectionRules?: readonly ConnectionRule[];

  /**
   * Property classification overrides (FR-011).
   *
   * By default, scalar types (string, number, boolean, enum) are shown
   * in the properties panel, and object/array types are shown hierarchically.
   * Use these overrides to change classification for specific fields.
   *
   * @example
   * ```typescript
   * propertyOverrides: [
   *   { property: 'metadata', classification: 'property' },
   *   { property: 'tags', classification: 'child' }
   * ]
   * ```
   */
  readonly propertyOverrides?: readonly PropertyOverride[];
}

// =============================================================================
// Documentation Types
// =============================================================================

/**
 * A key feature or capability of the grammar.
 */
export interface KeyFeature {
  /** The feature name */
  readonly feature: string;

  /** Description of what this feature provides */
  readonly description: string;
}

/**
 * A core concept defined by the grammar.
 */
export interface CoreConcept {
  /** The concept name */
  readonly concept: string;

  /** Description of what this concept represents */
  readonly description: string;
}

// =============================================================================
// Root Type Configuration
// =============================================================================

/**
 * Configuration for the grammar's main package/model file.
 */
export interface PackageFileConfig {
  /** Name of the package file (e.g., 'model.spdk') */
  readonly fileName: string;

  /** Human-readable name shown in UI */
  readonly displayName: string;

  /** VS Code Codicon name */
  readonly icon: string;
}

/**
 * Configuration for an AST type that can exist as a standalone file.
 *
 * @example
 * ```typescript
 * const taskConfig: RootTypeConfig = {
 *   astType: 'Task',
 *   displayName: 'Task',
 *   fileSuffix: '.task',
 *   folder: 'tasks',
 *   icon: 'checklist',
 *   template: `task \${name} {\n  // Add task details\n}\n`,
 *   templateInputs: [
 *     { id: 'name', label: 'Task Name', type: 'string', required: true }
 *   ],
 *   diagramNode: {
 *     glspType: 'node:task',
 *     shape: 'rectangle',
 *     cssClass: 'task-node',
 *     defaultSize: { width: 140, height: 50 }
 *   }
 * };
 * ```
 */
export interface RootTypeConfig {
  /** AST type name from grammar (PascalCase) */
  readonly astType: string;

  /** Human-readable name */
  readonly displayName: string;

  /** File suffix before base extension (e.g., '.task') */
  readonly fileSuffix: string;

  /** Target folder name in workspace */
  readonly folder: string;

  /** VS Code Codicon name */
  readonly icon: string;

  /**
   * Custom SVG icon data for diagram node rendering.
   *
   * When provided, the diagram node header renders these paths inside
   * a native `<svg>` element instead of looking up the built-in
   * platform icon map. Supports multi-color icons with per-path fills.
   *
   * @example { viewBox: '0 0 32 32', paths: [{ d: 'M10,...', fill: '#1177D7' }] }
   */
  readonly iconSvg?: IconSvgData;

  /** Default content template for new files (supports ${name} placeholder) */
  readonly template: string;

  /** Input fields for file creation wizard */
  readonly templateInputs?: readonly TemplateInput[];

  /** Diagram node configuration */
  readonly diagramNode?: DiagramNodeConfig;
}

// =============================================================================
// Grammar Operation Types
// =============================================================================

/**
 * JSON Schema for validation (simplified for operation schemas).
 */
export interface JSONSchema {
  readonly type?: string;
  readonly properties?: Record<string, JSONSchema>;
  readonly required?: readonly string[];
  readonly items?: JSONSchema;
  readonly enum?: readonly unknown[];
  readonly description?: string;
  readonly [key: string]: unknown;
}

/**
 * Field definition for operation input dialogs.
 */
export interface OperationDialogField {
  /** Unique field identifier */
  readonly id: string;

  /** Display label */
  readonly label: string;

  /** Field type for rendering */
  readonly type: 'string' | 'number' | 'boolean' | 'select' | 'textarea';

  /** Whether the field is required */
  readonly required?: boolean;

  /** Default value */
  readonly default?: string | number | boolean;

  /** Options for 'select' type */
  readonly options?: readonly { readonly label: string; readonly value: string }[];

  /** Placeholder text */
  readonly placeholder?: string;

  /** Help text shown below the field */
  readonly helpText?: string;
}

/**
 * Licensing and authentication requirements for an operation.
 */
export interface OperationLicensing {
  /** Whether authentication is required to invoke this operation */
  readonly requiresAuth?: boolean;

  /** Licensing tier required (e.g., 'free', 'pro', 'enterprise') */
  readonly tier?: string;

  /** Licensing group for feature bundling */
  readonly group?: string;
}

/**
 * Execution configuration for an operation.
 */
export interface OperationExecution {
  /** Whether the operation runs asynchronously (returns job ID) */
  readonly async?: boolean;

  /** Expected duration hint for UI feedback */
  readonly durationHint?: 'fast' | 'medium' | 'slow';

  /** Whether to show progress indicator during execution */
  readonly showProgress?: boolean;
}

/**
 * Endpoint configuration for REST gateway.
 */
export interface OperationEndpoint {
  /** HTTP method */
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';

  /** Path relative to /api/v1/{languageId}/operations/ */
  readonly path: string;

  /** JSON Schema for request validation */
  readonly requestSchema?: JSONSchema;

  /** JSON Schema for response documentation */
  readonly responseSchema?: JSONSchema;
}

/**
 * UI context configuration for operation visibility.
 */
export interface OperationContexts {
  /** Show in file explorer context menu */
  readonly fileExplorer?: boolean;

  /** Show in diagram element context menu */
  readonly diagramElement?: boolean;

  /** Show in composite editor toolbar */
  readonly compositeToolbar?: boolean;

  /** Show in main menu */
  readonly mainMenu?: boolean;
}

/**
 * Input gathering configuration for an operation.
 */
export interface OperationInput {
  /** How input is gathered before execution */
  readonly type: 'none' | 'selection' | 'dialog';

  /** Dialog field definitions (required if type is 'dialog') */
  readonly dialogFields?: readonly OperationDialogField[];
}

/**
 * Declaration of a custom API operation for a grammar.
 *
 * Operations are declared in the GrammarManifest and implemented
 * in the grammar package's src/operations/ directory.
 *
 * @example
 * ```typescript
 * const generatePowerShell: GrammarOperation = {
 *   id: 'generate-powershell',
 *   displayName: 'Generate PowerShell Script',
 *   description: 'Generate a PowerShell script for deploying this content model',
 *   targetTypes: ['ContentModel'],
 *   icon: 'terminal-powershell',
 *   category: 'Generate',
 *   contexts: {
 *     fileExplorer: true,
 *     diagramElement: true,
 *     compositeToolbar: true,
 *   },
 *   endpoint: {
 *     method: 'POST',
 *     path: '/generate/powershell',
 *   },
 *   input: { type: 'selection' },
 *   licensing: { requiresAuth: false, tier: 'free', group: 'generators' },
 *   execution: { async: false, durationHint: 'fast' }
 * };
 * ```
 */
export interface GrammarOperation {
  /**
   * Unique operation identifier (kebab-case).
   * Used in command registration and REST endpoints.
   *
   * @example 'generate-powershell', 'ai-analyze-compliance'
   */
  readonly id: string;

  /**
   * Human-readable name for UI display.
   *
   * @example 'Generate PowerShell Script'
   */
  readonly displayName: string;

  /**
   * Description for tooltips and help text.
   *
   * @example 'Generate a PowerShell script for deploying this content model'
   */
  readonly description: string;

  /**
   * AST types this operation applies to.
   * Use ['*'] for operations that apply to any type.
   *
   * @example ['ContentModel'], ['Actor', 'Content'], ['*']
   */
  readonly targetTypes: readonly string[];

  /**
   * VS Code Codicon name for the operation icon.
   *
   * @example 'terminal-powershell', 'shield', 'file-code'
   */
  readonly icon?: string;

  /**
   * Menu grouping category.
   *
   * @example 'Generate', 'Analyze', 'Export'
   */
  readonly category?: string;

  /**
   * Where to surface this operation in the IDE.
   */
  readonly contexts: OperationContexts;

  /**
   * REST endpoint configuration.
   */
  readonly endpoint: OperationEndpoint;

  /**
   * Input gathering mode.
   */
  readonly input?: OperationInput;

  /**
   * Licensing and authentication requirements.
   */
  readonly licensing?: OperationLicensing;

  /**
   * Execution mode configuration.
   */
  readonly execution?: OperationExecution;
}

// =============================================================================
// Grammar Manifest
// =============================================================================

/**
 * The primary configuration object that describes how a grammar integrates
 * with the SANYAM platform.
 *
 * GrammarManifest enables grammar-agnostic platform features by declaring:
 * - Language identification and file extensions
 * - AST types that can be standalone files (rootTypes)
 * - Diagram support with node/edge types and tool palettes
 *
 * @example
 * ```typescript
 * import type { GrammarManifest } from '@sanyam/types';
 *
 * export const MYAPP_MANIFEST: GrammarManifest = {
 *   languageId: 'myapp',
 *   displayName: 'MyApp',
 *   fileExtension: '.myapp',
 *   baseExtension: '.myapp',
 *   rootTypes: [...],
 *   diagrammingEnabled: true,
 *   diagramTypes: [...]
 * };
 * ```
 */
export interface GrammarManifest {
  /**
   * Unique identifier for the language.
   * Must be lowercase alphanumeric with hyphens only.
   *
   * @example 'spdevkit', 'my-language'
   */
  readonly languageId: string;

  /**
   * Human-readable name for the language.
   *
   * @example 'SPDevKit', 'My Language'
   */
  readonly displayName: string;

  /**
   * Brief description of the grammar's purpose and capabilities.
   * Typically 1-2 sentences.
   *
   * @example 'A domain-specific language for modeling enterprise content workflows and security policies.'
   */
  readonly summary: string;

  /**
   * Short marketing-style tagline for the grammar.
   * Should be catchy and memorable, under 10 words.
   *
   * @example 'Model content, secure by design'
   */
  readonly tagline: string;

  /**
   * List of key features or capabilities of the grammar.
   * Each entry has a feature name and description.
   *
   * @example [{ feature: 'Visual Workflows', description: 'Model complex workflows with drag-and-drop diagrams' }]
   */
  readonly keyFeatures: readonly KeyFeature[];

  /**
   * List of core domain concepts defined by the grammar.
   * Each entry has a concept name and description.
   *
   * @example [{ concept: 'Actor', description: 'A user or system that interacts with content' }]
   */
  readonly coreConcepts: readonly CoreConcept[];

  /**
   * A quick code example showing basic grammar usage.
   * Should be 3-10 lines demonstrating the core syntax.
   *
   * @example 'Actor Admin "Administrator" "System administrator"\nContent Policy "Policy Doc" "Security policy document"'
   */
  readonly quickExample: string;

  /**
   * Primary file extension including the dot.
   *
   * @example '.spdk', '.myapp'
   */
  readonly fileExtension: string;

  /**
   * Base extension used for composing file suffixes.
   * Often the same as fileExtension.
   *
   * @example '.spdk'
   */
  readonly baseExtension: string;

  /**
   * Configuration for the grammar's main package/model file.
   */
  readonly packageFile?: PackageFileConfig;

  /**
   * Array of AST types that can be standalone files.
   * Must contain at least one entry.
   */
  readonly rootTypes: readonly RootTypeConfig[];

  /**
   * Whether diagram features are enabled for this grammar.
   */
  readonly diagrammingEnabled: boolean;

  /**
   * Diagram view configurations.
   * Required if diagrammingEnabled is true.
   */
  readonly diagramTypes?: readonly DiagramTypeConfig[];

  /**
   * Optional logo for this grammar as a data URL.
   * Use base64-encoded SVG or PNG for best compatibility.
   *
   * @example 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0i...'
   */
  readonly logo?: string;

  /**
   * Custom API operations for this grammar.
   *
   * Operations are exposed via both LSP (workspace/executeCommand)
   * and REST gateway endpoints. Each operation is implemented in
   * the grammar package's src/operations/ directory.
   *
   * @example
   * ```typescript
   * operations: [
   *   {
   *     id: 'generate-powershell',
   *     displayName: 'Generate PowerShell Script',
   *     description: 'Generate a PowerShell script for provisioning',
   *     targetTypes: ['ContentModel'],
   *     icon: 'terminal-powershell',
   *     category: 'Generate',
   *     contexts: { fileExplorer: true, compositeToolbar: true },
   *     endpoint: { method: 'POST', path: '/generate/powershell' },
   *     execution: { async: false, durationHint: 'fast' }
   *   }
   * ]
   * ```
   */
  readonly operations?: readonly GrammarOperation[];
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a value is a valid GrammarManifest.
 *
 * @param value - Value to check
 * @returns True if value is a valid GrammarManifest
 */
export function isGrammarManifest(value: unknown): value is GrammarManifest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj['languageId'] === 'string' &&
    typeof obj['displayName'] === 'string' &&
    typeof obj['summary'] === 'string' &&
    typeof obj['tagline'] === 'string' &&
    Array.isArray(obj['keyFeatures']) &&
    obj['keyFeatures'].length > 0 &&
    Array.isArray(obj['coreConcepts']) &&
    obj['coreConcepts'].length > 0 &&
    typeof obj['quickExample'] === 'string' &&
    typeof obj['fileExtension'] === 'string' &&
    typeof obj['baseExtension'] === 'string' &&
    Array.isArray(obj['rootTypes']) &&
    obj['rootTypes'].length > 0 &&
    typeof obj['diagrammingEnabled'] === 'boolean'
  );
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validation result for manifest checks.
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Validates a GrammarManifest for correctness.
 *
 * @param manifest - Manifest to validate
 * @returns Validation result with any errors
 */
export function validateManifest(manifest: GrammarManifest): ValidationResult {
  const errors: string[] = [];

  // Language ID validation
  if (!/^[a-z][a-z0-9-]*$/.test(manifest.languageId)) {
    errors.push('languageId must be lowercase alphanumeric with hyphens, starting with a letter');
  }

  // Summary validation
  if (!manifest.summary || manifest.summary.trim().length === 0) {
    errors.push('summary must be a non-empty string');
  }

  // Tagline validation
  if (!manifest.tagline || manifest.tagline.trim().length === 0) {
    errors.push('tagline must be a non-empty string');
  }

  // Key features validation
  if (!manifest.keyFeatures || manifest.keyFeatures.length === 0) {
    errors.push('keyFeatures must have at least one entry');
  } else {
    manifest.keyFeatures.forEach((kf, index) => {
      if (!kf.feature || kf.feature.trim().length === 0) {
        errors.push(`keyFeatures[${index}].feature must be a non-empty string`);
      }
      if (!kf.description || kf.description.trim().length === 0) {
        errors.push(`keyFeatures[${index}].description must be a non-empty string`);
      }
    });
  }

  // Core concepts validation
  if (!manifest.coreConcepts || manifest.coreConcepts.length === 0) {
    errors.push('coreConcepts must have at least one entry');
  } else {
    manifest.coreConcepts.forEach((cc, index) => {
      if (!cc.concept || cc.concept.trim().length === 0) {
        errors.push(`coreConcepts[${index}].concept must be a non-empty string`);
      }
      if (!cc.description || cc.description.trim().length === 0) {
        errors.push(`coreConcepts[${index}].description must be a non-empty string`);
      }
    });
  }

  // Quick example validation
  if (!manifest.quickExample || manifest.quickExample.trim().length === 0) {
    errors.push('quickExample must be a non-empty string');
  }

  // File extension validation
  if (!manifest.fileExtension.startsWith('.')) {
    errors.push('fileExtension must start with a dot');
  }

  // Base extension validation
  if (!manifest.baseExtension.startsWith('.')) {
    errors.push('baseExtension must start with a dot');
  }

  // Root types validation
  if (manifest.rootTypes.length === 0) {
    errors.push('rootTypes must have at least one entry');
  }

  manifest.rootTypes.forEach((rt, index) => {
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(rt.astType)) {
      errors.push(`rootTypes[${index}].astType must be PascalCase`);
    }
    if (!rt.fileSuffix.startsWith('.')) {
      errors.push(`rootTypes[${index}].fileSuffix must start with a dot`);
    }
  });

  // Diagram validation
  if (manifest.diagrammingEnabled && (!manifest.diagramTypes || manifest.diagramTypes.length === 0)) {
    errors.push('diagramTypes required when diagrammingEnabled is true');
  }

  // Logo validation (must be a data URL if provided)
  if (manifest.logo !== undefined) {
    if (typeof manifest.logo !== 'string') {
      errors.push('logo must be a string');
    } else if (!manifest.logo.startsWith('data:')) {
      errors.push('logo must be a data URL (starting with "data:")');
    } else if (!/^data:image\/(svg\+xml|png|jpeg|gif|webp);base64,/.test(manifest.logo)) {
      errors.push('logo must be a base64-encoded image data URL (e.g., data:image/svg+xml;base64,...)');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
