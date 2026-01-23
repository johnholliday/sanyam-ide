/**
 * SPDevKit Diagram Module
 *
 * InversifyJS dependency injection configuration for SPDevKit Sprotty diagrams.
 * Registers model elements, views, and features.
 *
 * @packageDocumentation
 */

import { ContainerModule } from 'inversify';
import {
  configureModelElement,
  configureViewerOptions,
  SGraphImpl,
  SGraphView,
  SLabelImpl,
  SLabelView,
  RectangularNodeView,
  PolylineEdgeView,
  selectFeature,
  moveFeature,
  hoverFeedbackFeature,
  boundsFeature,
} from 'sprotty';

// Model imports
import {
  SPDevKitTypes,
  ApplicationNode,
  EntityNode,
  ServiceNode,
  WorkflowNode,
  SPDevKitEdge,
} from './model.js';

/**
 * SPDevKit Diagram Module
 *
 * Configures Sprotty for SPDevKit grammar visualization.
 */
export const spdevkitDiagramModule = new ContainerModule((bind, unbind, isBound, rebind) => {
  const context = { bind, unbind, isBound, rebind };

  // ═══════════════════════════════════════════════════════════════
  // Viewer Options
  // ═══════════════════════════════════════════════════════════════
  configureViewerOptions(context, {
    needsClientLayout: true,
    needsServerLayout: true,
    baseDiv: 'spdevkit-diagram',
    hiddenDiv: 'spdevkit-diagram-hidden',
  });

  // ═══════════════════════════════════════════════════════════════
  // Graph Root
  // ═══════════════════════════════════════════════════════════════
  configureModelElement(context, SPDevKitTypes.GRAPH, SGraphImpl, SGraphView);

  // ═══════════════════════════════════════════════════════════════
  // Node Elements
  // Uses RectangularNodeView with CSS styling for customization.
  // CSS classes are applied via the model's cssClasses property.
  // ═══════════════════════════════════════════════════════════════
  configureModelElement(
    context,
    SPDevKitTypes.NODE_APPLICATION,
    ApplicationNode,
    RectangularNodeView,
    { enable: [selectFeature, moveFeature, hoverFeedbackFeature, boundsFeature] }
  );

  configureModelElement(
    context,
    SPDevKitTypes.NODE_ENTITY,
    EntityNode,
    RectangularNodeView,
    { enable: [selectFeature, moveFeature, hoverFeedbackFeature, boundsFeature] }
  );

  configureModelElement(
    context,
    SPDevKitTypes.NODE_SERVICE,
    ServiceNode,
    RectangularNodeView,
    { enable: [selectFeature, moveFeature, hoverFeedbackFeature, boundsFeature] }
  );

  configureModelElement(
    context,
    SPDevKitTypes.NODE_WORKFLOW,
    WorkflowNode,
    RectangularNodeView,
    { enable: [selectFeature, moveFeature, hoverFeedbackFeature, boundsFeature] }
  );

  // ═══════════════════════════════════════════════════════════════
  // Edge Elements
  // Uses PolylineEdgeView with CSS styling for customization.
  // ═══════════════════════════════════════════════════════════════
  configureModelElement(context, SPDevKitTypes.EDGE_CONTAINMENT, SPDevKitEdge, PolylineEdgeView);
  configureModelElement(context, SPDevKitTypes.EDGE_REFERENCE, SPDevKitEdge, PolylineEdgeView);

  // ═══════════════════════════════════════════════════════════════
  // Labels
  // ═══════════════════════════════════════════════════════════════
  configureModelElement(context, SPDevKitTypes.LABEL_NAME, SLabelImpl, SLabelView);
  configureModelElement(context, SPDevKitTypes.LABEL_TYPE, SLabelImpl, SLabelView);
});

export default spdevkitDiagramModule;
