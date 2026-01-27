/**
 * Port and Connection Rule Contracts
 *
 * Defines types for port-based connections in diagrams.
 * Ports provide named connection points on nodes with
 * grammar-defined connection rules.
 *
 * @packageDocumentation
 */

// =============================================================================
// Port Types
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

// =============================================================================
// Connection Rule Types
// =============================================================================

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
// Validation Functions
// =============================================================================

/**
 * Check if a port allows a specific edge type.
 *
 * @param port - Port configuration
 * @param edgeType - Edge type to check
 * @returns True if connection is allowed
 */
export function portAllowsEdgeType(port: PortConfig, edgeType: string): boolean {
  if (!port.allowedConnections || port.allowedConnections.length === 0) {
    return true; // No restrictions
  }
  return port.allowedConnections.includes(edgeType);
}

/**
 * Check if a connection rule matches a given scenario.
 *
 * @param rule - Connection rule to check
 * @param sourceType - Source node GLSP type
 * @param sourcePort - Source port ID (if any)
 * @param targetType - Target node GLSP type
 * @param targetPort - Target port ID (if any)
 * @param isSelfConnection - Whether source and target are the same node
 * @returns True if rule matches
 */
export function ruleMatches(
  rule: ConnectionRule,
  sourceType: string,
  sourcePort: string | undefined,
  targetType: string,
  targetPort: string | undefined,
  isSelfConnection: boolean = false
): boolean {
  // Check self-connection
  if (isSelfConnection && !rule.allowSelfConnection) {
    return false;
  }

  // Check source type
  if (rule.sourceType !== '*' && rule.sourceType !== sourceType) {
    return false;
  }

  // Check source port
  if (rule.sourcePort !== undefined && rule.sourcePort !== '*') {
    if (rule.sourcePort !== sourcePort) {
      return false;
    }
  }

  // Check target type
  if (rule.targetType !== '*' && rule.targetType !== targetType) {
    return false;
  }

  // Check target port
  if (rule.targetPort !== undefined && rule.targetPort !== '*') {
    if (rule.targetPort !== targetPort) {
      return false;
    }
  }

  return true;
}

/**
 * Find matching connection rules for a scenario.
 *
 * @param rules - All connection rules
 * @param sourceType - Source node GLSP type
 * @param sourcePort - Source port ID (if any)
 * @param targetType - Target node GLSP type
 * @param targetPort - Target port ID (if any)
 * @param isSelfConnection - Whether source and target are the same node
 * @returns Matching rules
 */
export function findMatchingRules(
  rules: readonly ConnectionRule[],
  sourceType: string,
  sourcePort: string | undefined,
  targetType: string,
  targetPort: string | undefined,
  isSelfConnection: boolean = false
): ConnectionRule[] {
  return rules.filter(rule =>
    ruleMatches(rule, sourceType, sourcePort, targetType, targetPort, isSelfConnection)
  );
}

/**
 * Check if a connection is valid according to rules.
 *
 * @param rules - Connection rules to check against
 * @param sourceType - Source node GLSP type
 * @param sourcePort - Source port ID (if any)
 * @param targetType - Target node GLSP type
 * @param targetPort - Target port ID (if any)
 * @param isSelfConnection - Whether source and target are the same node
 * @returns True if at least one rule matches
 */
export function isConnectionValid(
  rules: readonly ConnectionRule[],
  sourceType: string,
  sourcePort: string | undefined,
  targetType: string,
  targetPort: string | undefined,
  isSelfConnection: boolean = false
): boolean {
  return findMatchingRules(
    rules,
    sourceType,
    sourcePort,
    targetType,
    targetPort,
    isSelfConnection
  ).length > 0;
}

/**
 * Get the edge type to create for a valid connection.
 * Returns the edge type from the first matching rule.
 *
 * @param rules - Connection rules
 * @param sourceType - Source node GLSP type
 * @param sourcePort - Source port ID (if any)
 * @param targetType - Target node GLSP type
 * @param targetPort - Target port ID (if any)
 * @param isSelfConnection - Whether source and target are the same node
 * @returns Edge type or undefined if no rule matches
 */
export function getEdgeTypeForConnection(
  rules: readonly ConnectionRule[],
  sourceType: string,
  sourcePort: string | undefined,
  targetType: string,
  targetPort: string | undefined,
  isSelfConnection: boolean = false
): string | undefined {
  const matching = findMatchingRules(
    rules,
    sourceType,
    sourcePort,
    targetType,
    targetPort,
    isSelfConnection
  );
  return matching.length > 0 ? matching[0].edgeType : undefined;
}

// =============================================================================
// Port Positioning
// =============================================================================

/**
 * Calculate port position on a node.
 *
 * @param nodeWidth - Node width in pixels
 * @param nodeHeight - Node height in pixels
 * @param port - Port configuration
 * @returns Port position relative to node origin
 */
export function calculatePortPosition(
  nodeWidth: number,
  nodeHeight: number,
  port: PortConfig
): { x: number; y: number } {
  const offset = port.offset ?? 0.5;

  switch (port.position) {
    case 'top':
      return { x: nodeWidth * offset, y: 0 };
    case 'bottom':
      return { x: nodeWidth * offset, y: nodeHeight };
    case 'left':
      return { x: 0, y: nodeHeight * offset };
    case 'right':
      return { x: nodeWidth, y: nodeHeight * offset };
  }
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default port style.
 */
export const DEFAULT_PORT_STYLE: PortStyle = 'circle';

/**
 * Default port offset (center of edge).
 */
export const DEFAULT_PORT_OFFSET = 0.5;

/**
 * Port size in pixels (radius for circle, half-width for square/diamond).
 */
export const PORT_SIZE = 5;

/**
 * CSS classes for port elements.
 */
export const PortCssClasses = {
  PORT: 'sanyam-port',
  PORT_VALID_TARGET: 'sanyam-port-valid-target',
  PORT_INVALID_TARGET: 'sanyam-port-invalid-target',
  PORT_HOVER: 'sanyam-port-hover',
} as const;
