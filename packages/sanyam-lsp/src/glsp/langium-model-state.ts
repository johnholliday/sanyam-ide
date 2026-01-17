/**
 * Langium Model State (T065)
 *
 * Wraps a LangiumDocument as a GLSP source model.
 *
 * @packageDocumentation
 */

import type { LangiumDocument, AstNode, CstNode } from 'langium';
import type {
  GModelRoot,
  GModelElement,
  GModelNode,
  GModelEdge,
  ModelState,
  ModelMetadata,
} from './glsp-context-factory';

/**
 * Element ID to AST node mapping.
 */
export interface ElementMapping {
  /** GModel element ID */
  elementId: string;
  /** Corresponding AST node */
  astNode: AstNode;
  /** Path to the AST node from root */
  path: string;
}

/**
 * Extended model state with Langium-specific functionality.
 */
export class LangiumModelState implements ModelState {
  private _gModel: GModelRoot;
  private _isDirty: boolean = false;
  private elementMappings: Map<string, ElementMapping> = new Map();
  private astToElementId: WeakMap<AstNode, string> = new WeakMap();

  constructor(
    public readonly document: LangiumDocument,
    public metadata: ModelMetadata
  ) {
    this._gModel = {
      id: `root_${document.uri.toString()}`,
      type: 'graph',
      children: [],
      revision: 0,
    };
  }

  /**
   * Get the root AST node.
   */
  get root(): AstNode {
    const value = this.document.parseResult?.value;
    if (!value) {
      throw new Error('Document has no parsed content');
    }
    return value;
  }

  /**
   * Get the GModel representation.
   */
  get gModel(): GModelRoot {
    return this._gModel;
  }

  /**
   * Set the GModel representation.
   */
  set gModel(model: GModelRoot) {
    this._gModel = model;
    this._isDirty = true;
  }

  /**
   * Check if the model has unsaved changes.
   */
  get isDirty(): boolean {
    return this._isDirty;
  }

  /**
   * Set the dirty state.
   */
  set isDirty(dirty: boolean) {
    this._isDirty = dirty;
  }

  /**
   * Register a mapping between an element ID and AST node.
   *
   * @param elementId - The GModel element ID
   * @param astNode - The corresponding AST node
   * @param path - The path to the AST node
   */
  registerMapping(elementId: string, astNode: AstNode, path: string): void {
    this.elementMappings.set(elementId, { elementId, astNode, path });
    this.astToElementId.set(astNode, elementId);
  }

  /**
   * Get the AST node for an element ID.
   *
   * @param elementId - The GModel element ID
   * @returns The AST node or undefined
   */
  getAstNode(elementId: string): AstNode | undefined {
    return this.elementMappings.get(elementId)?.astNode;
  }

  /**
   * Get the element ID for an AST node.
   *
   * @param astNode - The AST node
   * @returns The element ID or undefined
   */
  getElementId(astNode: AstNode): string | undefined {
    return this.astToElementId.get(astNode);
  }

  /**
   * Get the mapping for an element ID.
   *
   * @param elementId - The GModel element ID
   * @returns The element mapping or undefined
   */
  getMapping(elementId: string): ElementMapping | undefined {
    return this.elementMappings.get(elementId);
  }

  /**
   * Clear all element mappings.
   */
  clearMappings(): void {
    this.elementMappings.clear();
    this.astToElementId = new WeakMap();
  }

  /**
   * Get all element mappings.
   *
   * @returns Iterator over element mappings
   */
  getAllMappings(): IterableIterator<ElementMapping> {
    return this.elementMappings.values();
  }

  /**
   * Find element by ID in the GModel.
   *
   * @param id - The element ID
   * @returns The GModel element or undefined
   */
  findElement(id: string): GModelElement | undefined {
    const search = (elements: GModelElement[]): GModelElement | undefined => {
      for (const element of elements) {
        if (element.id === id) {
          return element;
        }
        if (element.children) {
          const found = search(element.children);
          if (found) return found;
        }
      }
      return undefined;
    };

    if (this._gModel.id === id) {
      return this._gModel;
    }
    return search(this._gModel.children);
  }

  /**
   * Find all elements of a specific type.
   *
   * @param type - The element type
   * @returns Array of matching elements
   */
  findElementsByType(type: string): GModelElement[] {
    const results: GModelElement[] = [];

    const search = (elements: GModelElement[]) => {
      for (const element of elements) {
        if (element.type === type) {
          results.push(element);
        }
        if (element.children) {
          search(element.children);
        }
      }
    };

    search(this._gModel.children);
    return results;
  }

  /**
   * Get the position of an element.
   *
   * @param elementId - The element ID
   * @returns The position or undefined
   */
  getPosition(elementId: string): { x: number; y: number } | undefined {
    return this.metadata.positions.get(elementId);
  }

  /**
   * Set the position of an element.
   *
   * @param elementId - The element ID
   * @param position - The new position
   */
  setPosition(elementId: string, position: { x: number; y: number }): void {
    this.metadata.positions.set(elementId, position);

    // Update GModel node if it exists
    const element = this.findElement(elementId) as GModelNode;
    if (element) {
      element.position = position;
    }

    this._isDirty = true;
  }

  /**
   * Get the size of an element.
   *
   * @param elementId - The element ID
   * @returns The size or undefined
   */
  getSize(elementId: string): { width: number; height: number } | undefined {
    return this.metadata.sizes.get(elementId);
  }

  /**
   * Set the size of an element.
   *
   * @param elementId - The element ID
   * @param size - The new size
   */
  setSize(elementId: string, size: { width: number; height: number }): void {
    this.metadata.sizes.set(elementId, size);

    // Update GModel node if it exists
    const element = this.findElement(elementId) as GModelNode;
    if (element) {
      element.size = size;
    }

    this._isDirty = true;
  }

  /**
   * Get the routing points of an edge.
   *
   * @param edgeId - The edge ID
   * @returns The routing points or undefined
   */
  getRoutingPoints(edgeId: string): { x: number; y: number }[] | undefined {
    return this.metadata.routingPoints.get(edgeId);
  }

  /**
   * Set the routing points of an edge.
   *
   * @param edgeId - The edge ID
   * @param points - The routing points
   */
  setRoutingPoints(edgeId: string, points: { x: number; y: number }[]): void {
    this.metadata.routingPoints.set(edgeId, points);

    // Update GModel edge if it exists
    const element = this.findElement(edgeId) as GModelEdge;
    if (element) {
      element.routingPoints = points;
    }

    this._isDirty = true;
  }

  /**
   * Check if an element is collapsed.
   *
   * @param elementId - The element ID
   * @returns True if collapsed
   */
  isCollapsed(elementId: string): boolean {
    return this.metadata.collapsed.has(elementId);
  }

  /**
   * Set the collapsed state of an element.
   *
   * @param elementId - The element ID
   * @param collapsed - Whether to collapse
   */
  setCollapsed(elementId: string, collapsed: boolean): void {
    if (collapsed) {
      this.metadata.collapsed.add(elementId);
    } else {
      this.metadata.collapsed.delete(elementId);
    }
    this._isDirty = true;
  }

  /**
   * Increment the GModel revision.
   */
  incrementRevision(): void {
    this._gModel.revision = (this._gModel.revision ?? 0) + 1;
  }

  /**
   * Mark the model as clean (no unsaved changes).
   */
  markClean(): void {
    this._isDirty = false;
  }

  /**
   * Get the document URI.
   */
  get uri(): string {
    return this.document.uri.toString();
  }

  /**
   * Get the document text.
   */
  get text(): string {
    return this.document.textDocument.getText();
  }

  /**
   * Get the document version.
   */
  get version(): number {
    return this.document.textDocument.version;
  }
}

/**
 * Create a new Langium model state.
 *
 * @param document - The Langium document
 * @param metadata - Optional initial metadata
 * @returns A new LangiumModelState instance
 */
export function createLangiumModelState(
  document: LangiumDocument,
  metadata?: ModelMetadata
): LangiumModelState {
  const defaultMetadata: ModelMetadata = metadata ?? {
    positions: new Map(),
    sizes: new Map(),
    routingPoints: new Map(),
    collapsed: new Set(),
  };

  return new LangiumModelState(document, defaultMetadata);
}
