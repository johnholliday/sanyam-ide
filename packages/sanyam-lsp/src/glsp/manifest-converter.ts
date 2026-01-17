/**
 * Manifest-Driven GModel Factory (T067)
 *
 * Converts AST to GModel using manifest configuration.
 *
 * @packageDocumentation
 */

import type { AstNode } from 'langium';
import { streamAllContents, isNamed, isReference } from 'langium';
import type { LanguageContribution } from '@sanyam/types';
import type {
  GModelRoot,
  GModelElement,
  GModelNode,
  GModelEdge,
  GModelLabel,
  ModelMetadata,
} from './glsp-context-factory';
import type { LangiumModelState } from './langium-model-state';

/**
 * Node mapping configuration from manifest.
 */
export interface NodeMappingConfig {
  /** GModel node type */
  type: string;
  /** AST property to use as label */
  labelProperty?: string;
  /** Default width for nodes of this type */
  defaultWidth?: number;
  /** Default height for nodes of this type */
  defaultHeight?: number;
  /** Child types to include */
  childTypes?: string[];
  /** CSS classes to apply */
  cssClasses?: string[];
}

/**
 * Edge mapping configuration from manifest.
 */
export interface EdgeMappingConfig {
  /** GModel edge type */
  type: string;
  /** AST property path to source */
  sourceProperty?: string;
  /** AST property path to target */
  targetProperty?: string;
  /** Property to use as edge label */
  labelProperty?: string;
}

/**
 * Conversion context passed to converters.
 */
export interface ConversionContext {
  /** The model state */
  modelState: LangiumModelState;
  /** Node mappings from manifest */
  nodeMappings: Map<string, NodeMappingConfig>;
  /** Edge mappings from manifest */
  edgeMappings: Map<string, EdgeMappingConfig>;
  /** Generated element IDs */
  generatedIds: Set<string>;
  /** Default node type for unmapped AST types */
  defaultNodeType: string;
  /** Default edge type for unmapped references */
  defaultEdgeType: string;
}

/**
 * Result of AST to GModel conversion.
 */
export interface ConversionResult {
  /** The converted GModel root */
  gModel: GModelRoot;
  /** Number of nodes created */
  nodeCount: number;
  /** Number of edges created */
  edgeCount: number;
  /** Any warnings during conversion */
  warnings: string[];
}

/**
 * Default dimensions for nodes.
 */
const DEFAULT_NODE_WIDTH = 100;
const DEFAULT_NODE_HEIGHT = 50;

/**
 * Generate a unique element ID.
 *
 * @param astNode - The AST node
 * @param context - The conversion context
 * @returns A unique ID
 */
function generateElementId(astNode: AstNode, context: ConversionContext): string {
  // Try to use node name if available
  if (isNamed(astNode)) {
    let baseId = astNode.name;
    let id = baseId;
    let counter = 1;

    // Ensure uniqueness
    while (context.generatedIds.has(id)) {
      id = `${baseId}_${counter++}`;
    }

    context.generatedIds.add(id);
    return id;
  }

  // Generate ID from type and counter
  const type = astNode.$type;
  let counter = 1;
  let id = `${type}_${counter}`;

  while (context.generatedIds.has(id)) {
    id = `${type}_${++counter}`;
  }

  context.generatedIds.add(id);
  return id;
}

/**
 * Generate an edge ID.
 *
 * @param sourceId - Source element ID
 * @param targetId - Target element ID
 * @param property - Property name
 * @param context - Conversion context
 * @returns A unique edge ID
 */
function generateEdgeId(
  sourceId: string,
  targetId: string,
  property: string,
  context: ConversionContext
): string {
  let baseId = `${sourceId}_${property}_${targetId}`;
  let id = baseId;
  let counter = 1;

  while (context.generatedIds.has(id)) {
    id = `${baseId}_${counter++}`;
  }

  context.generatedIds.add(id);
  return id;
}

/**
 * Get the label for a node.
 *
 * @param astNode - The AST node
 * @param mapping - The node mapping config
 * @returns The label text
 */
function getNodeLabel(astNode: AstNode, mapping?: NodeMappingConfig): string {
  if (mapping?.labelProperty) {
    const value = (astNode as any)[mapping.labelProperty];
    if (typeof value === 'string') {
      return value;
    }
  }

  if (isNamed(astNode)) {
    return astNode.name;
  }

  return astNode.$type;
}

/**
 * Create a label element.
 *
 * @param id - Element ID
 * @param text - Label text
 * @returns A GModelLabel element
 */
function createLabel(id: string, text: string): GModelLabel {
  return {
    id: `${id}_label`,
    type: 'label:text',
    text,
  };
}

/**
 * Convert an AST node to a GModel node.
 *
 * @param astNode - The AST node
 * @param context - Conversion context
 * @returns A GModelNode or undefined
 */
function convertToNode(
  astNode: AstNode,
  context: ConversionContext
): GModelNode | undefined {
  const mapping = context.nodeMappings.get(astNode.$type);
  if (!mapping && !isNamed(astNode)) {
    // Skip unnamed nodes without explicit mapping
    return undefined;
  }

  const id = generateElementId(astNode, context);
  const nodeType = mapping?.type ?? context.defaultNodeType;

  // Get position from metadata or default
  const position = context.modelState.metadata.positions.get(id) ?? { x: 0, y: 0 };

  // Get size from metadata or defaults
  const size = context.modelState.metadata.sizes.get(id) ?? {
    width: mapping?.defaultWidth ?? DEFAULT_NODE_WIDTH,
    height: mapping?.defaultHeight ?? DEFAULT_NODE_HEIGHT,
  };

  const node: GModelNode = {
    id,
    type: nodeType,
    position,
    size,
    children: [],
  };

  // Add label
  const labelText = getNodeLabel(astNode, mapping);
  node.children!.push(createLabel(id, labelText));

  // Register mapping
  context.modelState.registerMapping(id, astNode, getAstPath(astNode));

  return node;
}

/**
 * Get the AST path for a node.
 *
 * @param node - The AST node
 * @returns The path string
 */
function getAstPath(node: AstNode): string {
  const parts: string[] = [];
  let current: AstNode | undefined = node;

  while (current) {
    if (isNamed(current)) {
      parts.unshift(current.name);
    } else {
      parts.unshift(current.$type);
    }
    current = current.$container;
  }

  return parts.join('/');
}

/**
 * Find references in an AST node.
 *
 * @param node - The AST node
 * @returns Array of reference info
 */
function findReferences(node: AstNode): Array<{
  property: string;
  target: AstNode;
  index?: number;
}> {
  const refs: Array<{ property: string; target: AstNode; index?: number }> = [];

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) continue;

    if (isReference(value) && value.ref) {
      refs.push({ property: key, target: value.ref });
    }

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (isReference(item) && item.ref) {
          refs.push({ property: key, target: item.ref, index: i });
        }
      }
    }
  }

  return refs;
}

/**
 * Convert references to edges.
 *
 * @param sourceNode - Source AST node
 * @param sourceId - Source element ID
 * @param context - Conversion context
 * @returns Array of GModelEdge elements
 */
function convertReferencesToEdges(
  sourceNode: AstNode,
  sourceId: string,
  context: ConversionContext
): GModelEdge[] {
  const edges: GModelEdge[] = [];
  const refs = findReferences(sourceNode);

  for (const ref of refs) {
    const targetId = context.modelState.getElementId(ref.target);
    if (!targetId) {
      // Target not converted yet, skip
      continue;
    }

    const edgeId = generateEdgeId(sourceId, targetId, ref.property, context);
    const mapping = context.edgeMappings.get(ref.property);
    const edgeType = mapping?.type ?? context.defaultEdgeType;

    const edge: GModelEdge = {
      id: edgeId,
      type: edgeType,
      sourceId,
      targetId,
      children: [],
    };

    // Add label if configured
    if (mapping?.labelProperty) {
      const labelText = (sourceNode as any)[mapping.labelProperty];
      if (labelText) {
        edge.children!.push(createLabel(edgeId, labelText));
      }
    }

    // Apply routing points from metadata
    const routingPoints = context.modelState.metadata.routingPoints.get(edgeId);
    if (routingPoints) {
      edge.routingPoints = routingPoints;
    }

    edges.push(edge);
  }

  return edges;
}

/**
 * Manifest-driven GModel factory.
 *
 * Converts AST nodes to GModel elements based on manifest configuration.
 */
export class ManifestDrivenGModelFactory {
  private nodeMappings: Map<string, NodeMappingConfig> = new Map();
  private edgeMappings: Map<string, EdgeMappingConfig> = new Map();
  private defaultNodeType: string = 'node:generic';
  private defaultEdgeType: string = 'edge:reference';

  /**
   * Configure the factory from a language contribution.
   *
   * @param contribution - The language contribution
   */
  configure(contribution: LanguageContribution): void {
    const manifest = contribution.manifest;

    // Load node mappings
    if (manifest.diagram?.nodeTypes) {
      for (const [astType, config] of Object.entries(manifest.diagram.nodeTypes)) {
        this.nodeMappings.set(astType, config as NodeMappingConfig);
      }
    }

    // Load edge mappings
    if (manifest.diagram?.edgeTypes) {
      for (const [property, config] of Object.entries(manifest.diagram.edgeTypes)) {
        this.edgeMappings.set(property, config as EdgeMappingConfig);
      }
    }

    // Set defaults
    if (manifest.diagram?.defaultNodeType) {
      this.defaultNodeType = manifest.diagram.defaultNodeType;
    }
    if (manifest.diagram?.defaultEdgeType) {
      this.defaultEdgeType = manifest.diagram.defaultEdgeType;
    }
  }

  /**
   * Convert an AST to GModel.
   *
   * @param modelState - The model state
   * @returns Conversion result
   */
  convert(modelState: LangiumModelState): ConversionResult {
    const context: ConversionContext = {
      modelState,
      nodeMappings: this.nodeMappings,
      edgeMappings: this.edgeMappings,
      generatedIds: new Set(),
      defaultNodeType: this.defaultNodeType,
      defaultEdgeType: this.defaultEdgeType,
    };

    const root = modelState.root;
    const gModelRoot: GModelRoot = {
      id: `root_${modelState.uri}`,
      type: 'graph',
      children: [],
      revision: (modelState.gModel.revision ?? 0) + 1,
    };

    const warnings: string[] = [];
    const nodes: Map<string, GModelNode> = new Map();
    const edges: GModelEdge[] = [];

    // Clear existing mappings
    modelState.clearMappings();

    // First pass: convert all nodes
    for (const astNode of streamAllContents(root)) {
      const node = convertToNode(astNode, context);
      if (node) {
        nodes.set(node.id, node);
      }
    }

    // Second pass: convert references to edges
    for (const [id, node] of nodes) {
      const astNode = modelState.getAstNode(id);
      if (astNode) {
        const nodeEdges = convertReferencesToEdges(astNode, id, context);
        edges.push(...nodeEdges);
      }
    }

    // Build GModel children (nodes first, then edges)
    gModelRoot.children = [...nodes.values(), ...edges];

    // Update model state
    modelState.gModel = gModelRoot;

    return {
      gModel: gModelRoot,
      nodeCount: nodes.size,
      edgeCount: edges.length,
      warnings,
    };
  }

  /**
   * Incrementally update GModel for a changed AST node.
   *
   * @param modelState - The model state
   * @param changedNode - The changed AST node
   * @returns Updated conversion result
   */
  incrementalUpdate(
    modelState: LangiumModelState,
    changedNode: AstNode
  ): ConversionResult {
    // For simplicity, do a full conversion
    // A real implementation would only update affected elements
    return this.convert(modelState);
  }

  /**
   * Add a node mapping.
   *
   * @param astType - The AST type
   * @param config - The mapping configuration
   */
  addNodeMapping(astType: string, config: NodeMappingConfig): void {
    this.nodeMappings.set(astType, config);
  }

  /**
   * Add an edge mapping.
   *
   * @param property - The reference property
   * @param config - The mapping configuration
   */
  addEdgeMapping(property: string, config: EdgeMappingConfig): void {
    this.edgeMappings.set(property, config);
  }

  /**
   * Set the default node type.
   *
   * @param type - The default node type
   */
  setDefaultNodeType(type: string): void {
    this.defaultNodeType = type;
  }

  /**
   * Set the default edge type.
   *
   * @param type - The default edge type
   */
  setDefaultEdgeType(type: string): void {
    this.defaultEdgeType = type;
  }
}

/**
 * Create a manifest-driven GModel factory.
 *
 * @param contribution - Optional language contribution to configure from
 * @returns A new ManifestDrivenGModelFactory instance
 */
export function createManifestDrivenGModelFactory(
  contribution?: LanguageContribution
): ManifestDrivenGModelFactory {
  const factory = new ManifestDrivenGModelFactory();
  if (contribution) {
    factory.configure(contribution);
  }
  return factory;
}
