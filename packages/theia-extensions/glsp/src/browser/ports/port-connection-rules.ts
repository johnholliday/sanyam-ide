/**
 * Port Connection Rules (T062, T066)
 *
 * Validation logic for port-based connections using grammar-defined rules.
 *
 * @packageDocumentation
 */

import type { ConnectionRule, PortConfig } from '@sanyam/types';

/**
 * Result of connection validation.
 */
export interface ConnectionValidationResult {
  /** Whether the connection is valid */
  valid: boolean;
  /** Error message if invalid */
  reason?: string;
  /** The matched rule (if valid) */
  matchedRule?: ConnectionRule;
  /** Edge type to use for the connection */
  edgeType?: string;
}

/**
 * Source/target information for connection validation.
 */
export interface ConnectionEndpoint {
  /** GLSP type of the node */
  nodeType: string;
  /** Port ID (if connecting to a port) */
  portId?: string;
  /** Node element ID */
  elementId: string;
}

/**
 * Port connection rules validator.
 *
 * Validates connections against grammar-defined ConnectionRules.
 */
export class PortConnectionRules {
  private rules: readonly ConnectionRule[];

  constructor(rules: readonly ConnectionRule[] = []) {
    this.rules = rules;
  }

  /**
   * Validate a connection between two endpoints.
   *
   * @param source - Source endpoint
   * @param target - Target endpoint
   * @param edgeType - Optional specific edge type to validate
   * @returns Validation result
   */
  validateConnection(
    source: ConnectionEndpoint,
    target: ConnectionEndpoint,
    edgeType?: string
  ): ConnectionValidationResult {
    // If no rules defined, allow all connections
    if (this.rules.length === 0) {
      return { valid: true, edgeType: edgeType ?? 'edge:reference' };
    }

    // Check self-connection
    if (source.elementId === target.elementId) {
      // Find a rule that allows self-connection
      const selfRule = this.findMatchingRule(source, target, edgeType, true);
      if (!selfRule) {
        return {
          valid: false,
          reason: 'Self-connections are not allowed for this node type',
        };
      }
    }

    // Find matching rule
    const matchedRule = this.findMatchingRule(source, target, edgeType, false);
    if (!matchedRule) {
      return {
        valid: false,
        reason: this.getInvalidConnectionReason(source, target, edgeType),
      };
    }

    return {
      valid: true,
      matchedRule,
      edgeType: matchedRule.edgeType,
    };
  }

  /**
   * Find a rule that matches the connection.
   */
  protected findMatchingRule(
    source: ConnectionEndpoint,
    target: ConnectionEndpoint,
    edgeType: string | undefined,
    requireSelfConnectionSupport: boolean
  ): ConnectionRule | undefined {
    for (const rule of this.rules) {
      // Check edge type if specified
      if (edgeType && rule.edgeType !== edgeType) {
        continue;
      }

      // Check self-connection support
      if (requireSelfConnectionSupport && !rule.allowSelfConnection) {
        continue;
      }

      // Check source type
      if (!this.matchesType(source.nodeType, rule.sourceType)) {
        continue;
      }

      // Check target type
      if (!this.matchesType(target.nodeType, rule.targetType)) {
        continue;
      }

      // Check source port
      if (!this.matchesPort(source.portId, rule.sourcePort)) {
        continue;
      }

      // Check target port
      if (!this.matchesPort(target.portId, rule.targetPort)) {
        continue;
      }

      return rule;
    }

    return undefined;
  }

  /**
   * Check if a node type matches a rule's type pattern.
   */
  protected matchesType(nodeType: string, ruleType: string): boolean {
    // Wildcard matches everything
    if (ruleType === '*') {
      return true;
    }
    return nodeType === ruleType;
  }

  /**
   * Check if a port matches a rule's port pattern.
   */
  protected matchesPort(portId: string | undefined, rulePort: string | undefined): boolean {
    // If rule doesn't specify port, any port (or no port) matches
    if (rulePort === undefined || rulePort === '*') {
      return true;
    }
    // If rule specifies port, port must match
    return portId === rulePort;
  }

  /**
   * Get a human-readable reason for invalid connection.
   */
  protected getInvalidConnectionReason(
    source: ConnectionEndpoint,
    target: ConnectionEndpoint,
    edgeType?: string
  ): string {
    if (edgeType) {
      return `Connection of type '${edgeType}' is not allowed from '${source.nodeType}' to '${target.nodeType}'`;
    }
    return `No valid connection type found from '${source.nodeType}' to '${target.nodeType}'`;
  }

  /**
   * Get all valid edge types for a source endpoint.
   *
   * @param source - Source endpoint
   * @returns Array of valid edge types
   */
  getValidEdgeTypesForSource(source: ConnectionEndpoint): string[] {
    if (this.rules.length === 0) {
      return ['edge:reference']; // Default
    }

    const edgeTypes = new Set<string>();

    for (const rule of this.rules) {
      if (this.matchesType(source.nodeType, rule.sourceType)) {
        if (this.matchesPort(source.portId, rule.sourcePort)) {
          edgeTypes.add(rule.edgeType);
        }
      }
    }

    return Array.from(edgeTypes);
  }

  /**
   * Get all valid target types for a source and edge type.
   *
   * @param source - Source endpoint
   * @param edgeType - Edge type being created
   * @returns Array of valid target node types
   */
  getValidTargetTypes(source: ConnectionEndpoint, edgeType: string): string[] {
    const targetTypes = new Set<string>();

    for (const rule of this.rules) {
      if (rule.edgeType !== edgeType) {
        continue;
      }
      if (!this.matchesType(source.nodeType, rule.sourceType)) {
        continue;
      }
      if (!this.matchesPort(source.portId, rule.sourcePort)) {
        continue;
      }

      // Add target type (or mark as wildcard)
      if (rule.targetType === '*') {
        return ['*']; // Any type is valid
      }
      targetTypes.add(rule.targetType);
    }

    return Array.from(targetTypes);
  }

  /**
   * Check if a port accepts a specific edge type.
   *
   * @param port - Port configuration
   * @param edgeType - Edge type to check
   * @returns Whether the port accepts this edge type
   */
  portAcceptsEdgeType(port: PortConfig, edgeType: string): boolean {
    // If no restrictions, accept all
    if (!port.allowedConnections || port.allowedConnections.length === 0) {
      return true;
    }
    return port.allowedConnections.includes(edgeType);
  }
}

/**
 * Create a port connection rules validator from manifest.
 *
 * @param rules - Connection rules from manifest
 * @returns Configured validator
 */
export function createPortConnectionRules(rules?: readonly ConnectionRule[]): PortConnectionRules {
  return new PortConnectionRules(rules ?? []);
}

/**
 * Check if two endpoints can be connected with any edge type.
 *
 * @param rules - Connection rules
 * @param source - Source endpoint
 * @param target - Target endpoint
 * @returns Whether any connection is valid
 */
export function canConnect(
  rules: PortConnectionRules,
  source: ConnectionEndpoint,
  target: ConnectionEndpoint
): boolean {
  return rules.validateConnection(source, target).valid;
}

/**
 * Get the edge type to use for a connection.
 *
 * @param rules - Connection rules
 * @param source - Source endpoint
 * @param target - Target endpoint
 * @returns Edge type or undefined if no valid connection
 */
export function getConnectionEdgeType(
  rules: PortConnectionRules,
  source: ConnectionEndpoint,
  target: ConnectionEndpoint
): string | undefined {
  const result = rules.validateConnection(source, target);
  return result.valid ? result.edgeType : undefined;
}
