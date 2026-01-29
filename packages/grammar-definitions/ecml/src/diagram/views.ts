/**
 * ECML Diagram Views
 *
 * This module provides view type constants and re-exports for ECML diagrams.
 *
 * The actual rendering uses Sprotty's built-in views (RectangularNodeView,
 * PolylineEdgeView, SLabelView) with customization via CSS classes defined
 * in styles.css.
 *
 * For custom shapes (hexagon, diamond, etc.), extend ShapeView and implement
 * custom rendering using snabbdom JSX when needed.
 *
 * @packageDocumentation
 */

// Re-export built-in views for convenience
export {
  RectangularNodeView,
  PolylineEdgeView,
  SLabelView,
  ShapeView,
  SGraphView,
} from 'sprotty';

/**
 * View type identifiers for ECML diagram elements.
 */
export const EcmlViewTypes = {
  NODE_ACTOR: 'EcmlActorView',
  NODE_ACTIVITY: 'EcmlActivityView',
  NODE_TASK: 'EcmlTaskView',
  NODE_CONTENT: 'EcmlContentView',
  NODE_SECURITYGROUP: 'EcmlSecurityGroupView',
  NODE_PERMISSION: 'EcmlPermissionView',
  NODE_RETENTIONLABEL: 'EcmlRetentionLabelView',
  NODE_SENSITIVITYLABEL: 'EcmlSensitivityLabelView',
  NODE_WORKFLOW: 'EcmlWorkflowView',
  EDGE_CONTAINMENT: 'EcmlContainmentEdgeView',
  EDGE_REFERENCE: 'EcmlReferenceEdgeView',
  LABEL_NAME: 'EcmlNameLabelView',
  LABEL_TYPE: 'EcmlTypeLabelView',
} as const;
