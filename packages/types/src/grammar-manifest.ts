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

/**
 * Available shapes for diagram nodes.
 */
export type NodeShape = 'rectangle' | 'ellipse' | 'diamond' | 'hexagon';

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

  /** CSS class for styling */
  readonly cssClass: string;

  /** Default dimensions for new nodes */
  readonly defaultSize: Size;
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
 *   toolPalette: { groups: [...] }
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

  /** Default content template for new files (supports ${name} placeholder) */
  readonly template: string;

  /** Input fields for file creation wizard */
  readonly templateInputs?: readonly TemplateInput[];

  /** Diagram node configuration */
  readonly diagramNode?: DiagramNodeConfig;
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
