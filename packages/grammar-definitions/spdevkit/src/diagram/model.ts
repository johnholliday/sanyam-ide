/**
 * SPDevKit Diagram Model Elements
 *
 * Custom Sprotty model classes for SPDevKit grammar constructs.
 * These extend Sprotty's base implementations with grammar-specific properties.
 *
 * @packageDocumentation
 */

import {
  SNodeImpl,
  SEdgeImpl,
  SCompartmentImpl,
} from 'sprotty';
import type { Bounds } from 'sprotty-protocol';

// ═══════════════════════════════════════════════════════════════════
// Type Constants
// ═══════════════════════════════════════════════════════════════════

export const SPDevKitTypes = {
  // Graph root
  GRAPH: 'graph',

  // Nodes
  NODE_APPLICATION: 'node:application',
  NODE_ENTITY: 'node:entity',
  NODE_SERVICE: 'node:service',
  NODE_WORKFLOW: 'node:workflow',

  // Edges
  EDGE_CONTAINMENT: 'edge:containment',
  EDGE_REFERENCE: 'edge:reference',

  // Labels
  LABEL_NAME: 'label:name',
  LABEL_TYPE: 'label:type',

  // Compartments
  COMPARTMENT_HEADER: 'compartment:header',
  COMPARTMENT_BODY: 'compartment:body',
} as const;

// ═══════════════════════════════════════════════════════════════════
// Node Implementations
// ═══════════════════════════════════════════════════════════════════

/**
 * Application node element
 */
export class ApplicationNode extends SNodeImpl {
  /** The name/identifier of this application */
  name: string = '';

  /** Source location in the grammar file */
  sourceRange?: { start: number; end: number };

  override get bounds(): Bounds {
    return {
      x: this.position.x,
      y: this.position.y,
      width: this.size.width,
      height: this.size.height,
    };
  }
}

/**
 * Entity node element
 */
export class EntityNode extends SNodeImpl {
  /** The name/identifier of this entity */
  name: string = '';

  /** Source location in the grammar file */
  sourceRange?: { start: number; end: number };

  override get bounds(): Bounds {
    return {
      x: this.position.x,
      y: this.position.y,
      width: this.size.width,
      height: this.size.height,
    };
  }
}

/**
 * Service node element
 */
export class ServiceNode extends SNodeImpl {
  /** The name/identifier of this service */
  name: string = '';

  /** Source location in the grammar file */
  sourceRange?: { start: number; end: number };

  override get bounds(): Bounds {
    return {
      x: this.position.x,
      y: this.position.y,
      width: this.size.width,
      height: this.size.height,
    };
  }
}

/**
 * Workflow node element
 */
export class WorkflowNode extends SNodeImpl {
  /** The name/identifier of this workflow */
  name: string = '';

  /** Source location in the grammar file */
  sourceRange?: { start: number; end: number };

  override get bounds(): Bounds {
    return {
      x: this.position.x,
      y: this.position.y,
      width: this.size.width,
      height: this.size.height,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Edge Implementation
// ═══════════════════════════════════════════════════════════════════

export class SPDevKitEdge extends SEdgeImpl {
  edgeKind: 'containment' | 'reference' = 'containment';
  propertyName?: string;
  optional: boolean = false;
}

// ═══════════════════════════════════════════════════════════════════
// Compartment Implementation
// ═══════════════════════════════════════════════════════════════════

export class SPDevKitCompartment extends SCompartmentImpl {
  override layout?: string = 'vbox';
}
