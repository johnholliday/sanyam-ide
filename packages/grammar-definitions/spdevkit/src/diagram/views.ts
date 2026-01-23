/**
 * SPDevKit Diagram Views
 *
 * This module provides view type constants and re-exports for SPDevKit diagrams.
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
 * View type identifiers for SPDevKit diagram elements.
 */
export const SPDevKitViewTypes = {
  NODE_APPLICATION: 'SPDevKitApplicationView',
  NODE_ENTITY: 'SPDevKitEntityView',
  NODE_SERVICE: 'SPDevKitServiceView',
  NODE_WORKFLOW: 'SPDevKitWorkflowView',
  EDGE_CONTAINMENT: 'SPDevKitContainmentEdgeView',
  EDGE_REFERENCE: 'SPDevKitReferenceEdgeView',
  LABEL_NAME: 'SPDevKitNameLabelView',
  LABEL_TYPE: 'SPDevKitTypeLabelView',
} as const;
