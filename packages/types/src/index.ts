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

export {
  // Application metadata for frontend config
  type ApplicationLink,
  type ApplicationMetadata
} from './application-metadata.js';
