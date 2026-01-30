/**
 * ECML Diagram Model Elements
 *
 * Custom Sprotty model classes for ECML grammar constructs.
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

export const EcmlTypes = {
  // Graph root
  GRAPH: 'graph',

  // Nodes
  NODE_ACTOR: 'node:actor',
  NODE_ACTIVITY: 'node:activity',
  NODE_TASK: 'node:task',
  NODE_CONTENT: 'node:content',
  NODE_SECURITYGROUP: 'node:securitygroup',
  NODE_PERMISSION: 'node:permission',
  NODE_RETENTIONLABEL: 'node:retentionlabel',
  NODE_SENSITIVITYLABEL: 'node:sensitivitylabel',
  NODE_WORKFLOW: 'node:workflow',

  // Edges
  EDGE_CONTAINMENT: 'edge:containment',
  EDGE_REFERENCE: 'edge:reference',

  // Labels
  LABEL_NAME: 'label:name',
  LABEL_TYPE: 'label:type',
  LABEL_TEXT: 'label:text',

  // Compartments
  COMPARTMENT_HEADER: 'compartment:header',
  COMPARTMENT_BODY: 'compartment:body',
} as const;

// ═══════════════════════════════════════════════════════════════════
// Node Implementations
// ═══════════════════════════════════════════════════════════════════

/**
 * Actor node element
 */
export class ActorNode extends SNodeImpl {
  /** The name/identifier of this actor */
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
 * Activity node element
 */
export class ActivityNode extends SNodeImpl {
  /** The name/identifier of this activity */
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
 * Task node element
 */
export class TaskNode extends SNodeImpl {
  /** The name/identifier of this task */
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
 * Content node element
 */
export class ContentNode extends SNodeImpl {
  /** The name/identifier of this content */
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
 * Security Group node element
 */
export class SecurityGroupNode extends SNodeImpl {
  /** The name/identifier of this security group */
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
 * Permission node element
 */
export class PermissionNode extends SNodeImpl {
  /** The name/identifier of this permission */
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
 * Retention Label node element
 */
export class RetentionLabelNode extends SNodeImpl {
  /** The name/identifier of this retention label */
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
 * Sensitivity Label node element
 */
export class SensitivityLabelNode extends SNodeImpl {
  /** The name/identifier of this sensitivity label */
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

export class EcmlEdge extends SEdgeImpl {
  edgeKind: 'containment' | 'reference' = 'containment';
  propertyName?: string;
  optional: boolean = false;
}

// ═══════════════════════════════════════════════════════════════════
// Compartment Implementation
// ═══════════════════════════════════════════════════════════════════

export class EcmlCompartment extends SCompartmentImpl {
  override layout?: string = 'vbox';
}
