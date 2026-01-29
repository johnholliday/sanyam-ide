/**
 * ECML Diagram Module
 *
 * InversifyJS dependency injection configuration for ECML Sprotty diagrams.
 * Registers model elements with built-in Sprotty views and CSS-based styling.
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
  EcmlTypes,
  ActorNode,
  ActivityNode,
  TaskNode,
  ContentNode,
  SecurityGroupNode,
  PermissionNode,
  RetentionLabelNode,
  SensitivityLabelNode,
  WorkflowNode,
  EcmlEdge,
} from './model.js';

/**
 * ECML Diagram Module
 *
 * Configures Sprotty for ECML grammar visualization.
 * Uses built-in Sprotty views with CSS-based styling.
 */
export const ecmlDiagramModule = new ContainerModule((bind, unbind, isBound, rebind) => {
  const context = { bind, unbind, isBound, rebind };

  // ═══════════════════════════════════════════════════════════════
  // Viewer Options
  // ═══════════════════════════════════════════════════════════════
  configureViewerOptions(context, {
    needsClientLayout: true,
    needsServerLayout: true,
    baseDiv: 'ecml-diagram',
    hiddenDiv: 'ecml-diagram-hidden',
  });

  // ═══════════════════════════════════════════════════════════════
  // Graph Root
  // ═══════════════════════════════════════════════════════════════
  configureModelElement(context, EcmlTypes.GRAPH, SGraphImpl, SGraphView);

  // ═══════════════════════════════════════════════════════════════
  // Node Elements
  // Uses RectangularNodeView with CSS styling for customization.
  // CSS classes are applied via the model's cssClasses property.
  // ═══════════════════════════════════════════════════════════════
  configureModelElement(
    context,
    EcmlTypes.NODE_ACTOR,
    ActorNode,
    RectangularNodeView,
    { enable: [selectFeature, moveFeature, hoverFeedbackFeature, boundsFeature] }
  );

  configureModelElement(
    context,
    EcmlTypes.NODE_ACTIVITY,
    ActivityNode,
    RectangularNodeView,
    { enable: [selectFeature, moveFeature, hoverFeedbackFeature, boundsFeature] }
  );

  configureModelElement(
    context,
    EcmlTypes.NODE_TASK,
    TaskNode,
    RectangularNodeView,
    { enable: [selectFeature, moveFeature, hoverFeedbackFeature, boundsFeature] }
  );

  configureModelElement(
    context,
    EcmlTypes.NODE_CONTENT,
    ContentNode,
    RectangularNodeView,
    { enable: [selectFeature, moveFeature, hoverFeedbackFeature, boundsFeature] }
  );

  configureModelElement(
    context,
    EcmlTypes.NODE_SECURITYGROUP,
    SecurityGroupNode,
    RectangularNodeView,
    { enable: [selectFeature, moveFeature, hoverFeedbackFeature, boundsFeature] }
  );

  configureModelElement(
    context,
    EcmlTypes.NODE_PERMISSION,
    PermissionNode,
    RectangularNodeView,
    { enable: [selectFeature, moveFeature, hoverFeedbackFeature, boundsFeature] }
  );

  configureModelElement(
    context,
    EcmlTypes.NODE_RETENTIONLABEL,
    RetentionLabelNode,
    RectangularNodeView,
    { enable: [selectFeature, moveFeature, hoverFeedbackFeature, boundsFeature] }
  );

  configureModelElement(
    context,
    EcmlTypes.NODE_SENSITIVITYLABEL,
    SensitivityLabelNode,
    RectangularNodeView,
    { enable: [selectFeature, moveFeature, hoverFeedbackFeature, boundsFeature] }
  );

  configureModelElement(
    context,
    EcmlTypes.NODE_WORKFLOW,
    WorkflowNode,
    RectangularNodeView,
    { enable: [selectFeature, moveFeature, hoverFeedbackFeature, boundsFeature] }
  );

  // ═══════════════════════════════════════════════════════════════
  // Edge Elements
  // Uses PolylineEdgeView with CSS styling for customization.
  // ═══════════════════════════════════════════════════════════════
  configureModelElement(context, EcmlTypes.EDGE_CONTAINMENT, EcmlEdge, PolylineEdgeView);
  configureModelElement(context, EcmlTypes.EDGE_REFERENCE, EcmlEdge, PolylineEdgeView);

  // ═══════════════════════════════════════════════════════════════
  // Labels
  // ═══════════════════════════════════════════════════════════════
  configureModelElement(context, EcmlTypes.LABEL_NAME, SLabelImpl, SLabelView);
  configureModelElement(context, EcmlTypes.LABEL_TYPE, SLabelImpl, SLabelView);
});

export default ecmlDiagramModule;
