# Grammar Config Extension: Sprotty Diagram Customization

## Overview

This document extends the `/grammar.config` command specification to automatically generate grammar-specific Sprotty diagram customization code. The generated code provides custom views, models, and styling for each grammar construct, enabling visually distinctive diagram representations.

---

## New Directory Structure

The extended command generates additional files in a `diagram/` subdirectory:

```
packages/grammar-definitions/{name}/
├── src/
│   ├── {name}.langium              # Grammar file
│   ├── manifest.ts                 # GrammarManifest configuration
│   ├── contribution.ts             # LanguageContribution export (UPDATED)
│   ├── logo.svg                    # Grammar logo
│   └── diagram/                    # NEW: Sprotty customizations
│       ├── index.ts                # Barrel exports
│       ├── model.ts                # Custom model element classes
│       ├── views.tsx               # Custom view implementations
│       ├── module.ts               # InversifyJS DI configuration
│       └── styles.css              # CSS styling
├── package.json                    # (UPDATED: Sprotty dependencies)
├── tsconfig.json                   # (UPDATED: JSX support)
└── langium-config.json
```

---

## New Grammar Comment Tags for Diagram Customization

### Step 4.2 Enhancement: Extract Diagram Tags

Add tags for diagram customization metadata. Visual styling (colors, borders) is handled entirely via CSS with auto-generated semantic class names.

| Tag | Maps to | Description |
|-----|---------|-------------|
| `@shape` | `diagramNode.shape` | Shape type: `rectangle`, `rounded`, `hexagon`, `diamond`, `ellipse`, `pill` |
| `@tooltip` | `diagramNode.tooltip` | Hover tooltip template (supports `${name}` placeholder) |

**Tag placement**: Tags apply to the rule immediately following them.

**Example grammar with diagram tags:**

```langium
// @name = "Workflow DSL"
// @tagline = "Visual workflow automation"
// @extension = ".wf"
grammar Workflow

// @shape = "rounded"
// @tooltip = "Workflow model: ${name}"
entry Model:
    (workflows+=WorkflowDef)*;

// @shape = "hexagon"
// @tooltip = "Workflow definition: ${name}"
WorkflowDef:
    'workflow' name=ID '{'
        (steps+=Step)*
    '}';

// @shape = "rectangle"
// @tooltip = "Step: ${name}"
Step:
    'step' name=ID (':' description=STRING)?
    ('->' next=[Step:ID])?;

// @shape = "diamond"
// @tooltip = "Decision point"
Decision:
    'if' condition=STRING 'then' thenStep=[Step:ID] ('else' elseStep=[Step:ID])?;
```

**Extraction regex (per rule):**

```regex
// Tag extraction: apply to next rule
/\/\/\s*@(shape|tooltip)\s*=\s*"([^"]+)"\s*\n(?:\/\/[^\n]*\n)*\s*(?:entry\s+)?([A-Z][a-zA-Z0-9]*)\s*:/g
```

**Processing:**

1. Scan grammar for tagged rules
2. Build `DiagramMetadata` map: `{ [ruleName]: DiagramRuleMetadata }`
3. Pass to Step 6 for enhanced diagram configuration
4. Pass to Step 15 for Sprotty code generation

```typescript
interface DiagramRuleMetadata {
  shape?: 'rectangle' | 'rounded' | 'hexagon' | 'diamond' | 'ellipse' | 'pill';
  tooltip?: string;  // Template with ${name} placeholder
}

type DiagramMetadata = Map<string, DiagramRuleMetadata>;
```

### CSS Class Naming Convention

All visual styling is controlled via CSS using grammar-qualified class names:

**Node classes**: `{GrammarName}.{RuleName}` (e.g., `Workflow.Model`, `Workflow.WorkflowDef`, `Workflow.Step`)

**Edge classes**: `{GrammarName}.edge.{edgeKind}` (e.g., `Workflow.edge.containment`, `Workflow.edge.reference`)

**State modifiers**: Standard Sprotty classes applied additively:
- `.selected` — Node/edge is selected
- `.mouseover` — Mouse is hovering
- `.highlighted` — Programmatically highlighted

This enables developers to customize appearance by editing CSS:

```css
/* Custom styling for Workflow grammar */
.Workflow.WorkflowDef {
  fill: #8b5cf6;
  stroke: #7c3aed;
}

.Workflow.Step {
  fill: #10b981;
  stroke: #059669;
}

.Workflow.Decision {
  fill: #f59e0b;
  stroke: #d97706;
}

/* Hover state */
.Workflow.Step.mouseover {
  fill: #34d399;
}

/* Selection state */
.Workflow.Step.selected {
  stroke: #2563eb;
  stroke-width: 3px;
}
```

---

## Step 6 Enhancement: Generate Enhanced diagramNode Configuration

Update the `diagramNode` generation in Step 6 to use extracted metadata:

**DiagramNodeConfig:** (embedded in RootTypeConfig)

```typescript
{
  glspType: `node:${astType.toLowerCase()}`,
  sprottyType: `node:${astType.toLowerCase()}`,
  shape: diagramMetadata[astType]?.shape ?? deriveShapeFromName(astType),
  tooltip: diagramMetadata[astType]?.tooltip ?? `${displayName}: \${name}`,
  cssClass: `${GrammarName}.${astType}`,  // Grammar-qualified class name
  defaultSize: deriveSizeFromShape(shape)
}
```

**Shape derivation heuristics** (when no `@shape` tag):

```
if name matches /workflow|flow|process|pipeline/i → 'rounded'
if name matches /decision|condition|choice|branch/i → 'diamond'
if name matches /state|status|phase/i → 'ellipse'
if name matches /terminal|keyword|token/i → 'pill'
if name matches /action|command|operation/i → 'hexagon'
if name matches /group|container|package|module/i → 'rounded' (larger)
else → 'rectangle'
```

**Size derivation:**

```typescript
function deriveSizeFromShape(shape: string): { width: number; height: number } {
  switch (shape) {
    case 'diamond': return { width: 100, height: 100 };
    case 'ellipse': return { width: 120, height: 80 };
    case 'hexagon': return { width: 140, height: 80 };
    case 'pill': return { width: 100, height: 40 };
    case 'rounded': return { width: 160, height: 70 };
    default: return { width: 150, height: 60 };
  }
}
```

---

## NEW Step 15: Generate Sprotty Diagram Module

After Step 14 (Report Completion), add Step 15 to generate the Sprotty customization files.

### Step 15.1: Generate src/diagram/model.ts

```typescript
/**
 * {DisplayName} Diagram Model Elements
 *
 * Custom Sprotty model classes for {DisplayName} grammar constructs.
 * These extend Sprotty's base implementations with grammar-specific properties.
 *
 * @packageDocumentation
 */

import {
  SNodeImpl,
  SEdgeImpl,
  SLabelImpl,
  SCompartmentImpl,
  Bounds,
} from 'sprotty';

// ═══════════════════════════════════════════════════════════════════
// Type Constants
// ═══════════════════════════════════════════════════════════════════

export const {GrammarName}Types = {
  // Graph root
  GRAPH: 'graph',

  // Nodes
{nodeTypeConstants}

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

{nodeImplementations}

// ═══════════════════════════════════════════════════════════════════
// Edge Implementation
// ═══════════════════════════════════════════════════════════════════

export class {GrammarName}Edge extends SEdgeImpl {
  edgeKind: 'containment' | 'reference' = 'containment';
  propertyName?: string;
  optional: boolean = false;
}

// ═══════════════════════════════════════════════════════════════════
// Compartment Implementation
// ═══════════════════════════════════════════════════════════════════

export class {GrammarName}Compartment extends SCompartmentImpl {
  override layout?: string = 'vbox';
}
```

**Node type constants generation** (for each rootType):

```typescript
// Template for nodeTypeConstants
`  NODE_${astType.toUpperCase()}: 'node:${astType.toLowerCase()}',`
```

**Node implementation generation** (for each rootType):

```typescript
// Template for each rootType
`/**
 * ${displayName} node element
 */
export class ${astType}Node extends SNodeImpl {
  /** The name/identifier of this ${displayName.toLowerCase()} */
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
`
```

### Step 15.2: Generate src/diagram/views.tsx

```typescript
/**
 * {DisplayName} Diagram Views
 *
 * Custom Sprotty views for rendering {DisplayName} grammar constructs.
 * Each view defines the SVG representation for its corresponding model element.
 *
 * @packageDocumentation
 */

/** @jsx svg */
import { svg } from 'sprotty/lib/jsx';
import { injectable } from 'inversify';
import { VNode } from 'snabbdom';
import {
  IView,
  IViewArgs,
  RenderingContext,
  SShapeElementView,
  PolylineEdgeView,
  SLabelImpl,
  Point,
} from 'sprotty';

import {
{modelImports}
} from './model.js';

// ═══════════════════════════════════════════════════════════════════
// Node Views
// ═══════════════════════════════════════════════════════════════════

{nodeViews}

// ═══════════════════════════════════════════════════════════════════
// Edge Views
// ═══════════════════════════════════════════════════════════════════

@injectable()
export class {GrammarName}ContainmentEdgeView extends PolylineEdgeView {
  protected override renderLine(
    edge: {GrammarName}Edge,
    segments: Point[],
    context: RenderingContext,
    args?: IViewArgs
  ): VNode {
    const path = this.buildPath(segments);

    return (
      <g>
        <path
          class-sprotty-edge={true}
          class-containment={true}
          class-optional={edge.optional}
          d={path}
          fill="none"
        />
        {this.renderDiamond(segments)}
      </g>
    );
  }

  private buildPath(segments: Point[]): string {
    if (segments.length === 0) return '';
    let path = `M ${segments[0].x},${segments[0].y}`;
    for (let i = 1; i < segments.length; i++) {
      path += ` L ${segments[i].x},${segments[i].y}`;
    }
    return path;
  }

  private renderDiamond(segments: Point[]): VNode {
    if (segments.length < 2) return <g />;

    const start = segments[0];
    const next = segments[1];
    const angle = Math.atan2(next.y - start.y, next.x - start.x);
    const size = 10;

    const p1 = `${start.x},${start.y}`;
    const p2 = `${start.x + size * Math.cos(angle - Math.PI / 4)},${start.y + size * Math.sin(angle - Math.PI / 4)}`;
    const p3 = `${start.x + size * 1.4 * Math.cos(angle)},${start.y + size * 1.4 * Math.sin(angle)}`;
    const p4 = `${start.x + size * Math.cos(angle + Math.PI / 4)},${start.y + size * Math.sin(angle + Math.PI / 4)}`;

    return <polygon class-containment-diamond={true} points={`${p1} ${p2} ${p3} ${p4}`} />;
  }
}

@injectable()
export class {GrammarName}ReferenceEdgeView extends PolylineEdgeView {
  protected override renderLine(
    edge: {GrammarName}Edge,
    segments: Point[],
    context: RenderingContext,
    args?: IViewArgs
  ): VNode {
    const path = this.buildPath(segments);

    return (
      <g>
        <path
          class-sprotty-edge={true}
          class-reference={true}
          class-optional={edge.optional}
          d={path}
          fill="none"
          stroke-dasharray="6,3"
        />
        {this.renderArrow(segments)}
      </g>
    );
  }

  private buildPath(segments: Point[]): string {
    if (segments.length === 0) return '';
    let path = `M ${segments[0].x},${segments[0].y}`;
    for (let i = 1; i < segments.length; i++) {
      path += ` L ${segments[i].x},${segments[i].y}`;
    }
    return path;
  }

  private renderArrow(segments: Point[]): VNode {
    if (segments.length < 2) return <g />;

    const end = segments[segments.length - 1];
    const prev = segments[segments.length - 2];
    const angle = Math.atan2(end.y - prev.y, end.x - prev.x);
    const size = 10;

    const p1 = `${end.x},${end.y}`;
    const p2 = `${end.x - size * Math.cos(angle - Math.PI / 6)},${end.y - size * Math.sin(angle - Math.PI / 6)}`;
    const p3 = `${end.x - size * Math.cos(angle + Math.PI / 6)},${end.y - size * Math.sin(angle + Math.PI / 6)}`;

    return <polygon class-reference-arrow={true} points={`${p1} ${p2} ${p3}`} />;
  }
}

// ═══════════════════════════════════════════════════════════════════
// Label Views
// ═══════════════════════════════════════════════════════════════════

@injectable()
export class {GrammarName}NameLabelView implements IView {
  render(label: Readonly<SLabelImpl>, context: RenderingContext, args?: IViewArgs): VNode | undefined {
    return (
      <text class-sprotty-label={true} class-name-label={true}>
        {label.text}
      </text>
    );
  }
}

@injectable()
export class {GrammarName}TypeLabelView implements IView {
  render(label: Readonly<SLabelImpl>, context: RenderingContext, args?: IViewArgs): VNode | undefined {
    return (
      <text class-sprotty-label={true} class-type-label={true} font-size="11" font-style="italic">
        {label.text}
      </text>
    );
  }
}
```

**Node view generation** (for each rootType, based on shape):

The view generator function signature is simplified - colors are handled by CSS:

```typescript
function generateNodeView(
  grammarName: string,
  astType: string, 
  shape: string,
  tooltip?: string
): string
```

**Common view preamble** (added once at top of views.tsx):

```typescript
/** Resolve tooltip template with node properties */
function resolveTooltip(template: string, node: { name?: string }): string {
  return template.replace(/\$\{name\}/g, node.name ?? 'unnamed');
}
```

**Shape-specific view templates:**

```typescript
// Rectangle shape
function generateRectangleView(grammarName: string, astType: string, tooltip?: string): string {
  const tooltipAttr = tooltip 
    ? `\n          title={resolveTooltip('${tooltip}', node)}` 
    : '';
  return `
@injectable()
export class ${astType}View extends SShapeElementView {
  render(
    node: Readonly<${astType}Node>,
    context: RenderingContext,
    args?: IViewArgs
  ): VNode | undefined {
    if (!this.isVisible(node, context)) {
      return undefined;
    }

    const { width, height } = node.size;

    return (
      <g>
        <rect
          class-sprotty-node={true}
          class-${grammarName}={true}
          class-${astType}={true}
          class-mouseover={node.hoverFeedback}
          class-selected={node.selected}${tooltipAttr}
          x="0"
          y="0"
          width={Math.max(width, 0)}
          height={Math.max(height, 0)}
        />
        {context.renderChildren(node)}
      </g>
    );
  }
}
`;
}

// Rounded rectangle shape
function generateRoundedView(grammarName: string, astType: string, tooltip?: string): string {
  const tooltipAttr = tooltip 
    ? `\n          title={resolveTooltip('${tooltip}', node)}` 
    : '';
  return `
@injectable()
export class ${astType}View extends SShapeElementView {
  render(
    node: Readonly<${astType}Node>,
    context: RenderingContext,
    args?: IViewArgs
  ): VNode | undefined {
    if (!this.isVisible(node, context)) {
      return undefined;
    }

    const { width, height } = node.size;
    const cornerRadius = 8;

    return (
      <g>
        <rect
          class-sprotty-node={true}
          class-${grammarName}={true}
          class-${astType}={true}
          class-mouseover={node.hoverFeedback}
          class-selected={node.selected}${tooltipAttr}
          x="0"
          y="0"
          width={Math.max(width, 0)}
          height={Math.max(height, 0)}
          rx={cornerRadius}
          ry={cornerRadius}
        />
        {context.renderChildren(node)}
      </g>
    );
  }
}
`;
}

// Hexagon shape
function generateHexagonView(grammarName: string, astType: string, tooltip?: string): string {
  const tooltipAttr = tooltip 
    ? `\n          title={resolveTooltip('${tooltip}', node)}` 
    : '';
  return `
@injectable()
export class ${astType}View extends SShapeElementView {
  render(
    node: Readonly<${astType}Node>,
    context: RenderingContext,
    args?: IViewArgs
  ): VNode | undefined {
    if (!this.isVisible(node, context)) {
      return undefined;
    }

    const { width, height } = node.size;
    const indent = 15;
    const points = [
      \`\${indent},0\`,
      \`\${width - indent},0\`,
      \`\${width},\${height / 2}\`,
      \`\${width - indent},\${height}\`,
      \`\${indent},\${height}\`,
      \`0,\${height / 2}\`,
    ].join(' ');

    return (
      <g>
        <polygon
          class-sprotty-node={true}
          class-${grammarName}={true}
          class-${astType}={true}
          class-mouseover={node.hoverFeedback}
          class-selected={node.selected}${tooltipAttr}
          points={points}
        />
        {context.renderChildren(node)}
      </g>
    );
  }
}
`;
}

// Diamond shape
function generateDiamondView(grammarName: string, astType: string, tooltip?: string): string {
  const tooltipAttr = tooltip 
    ? `\n          title={resolveTooltip('${tooltip}', node)}` 
    : '';
  return `
@injectable()
export class ${astType}View extends SShapeElementView {
  render(
    node: Readonly<${astType}Node>,
    context: RenderingContext,
    args?: IViewArgs
  ): VNode | undefined {
    if (!this.isVisible(node, context)) {
      return undefined;
    }

    const { width, height } = node.size;
    const points = [
      \`\${width / 2},0\`,
      \`\${width},\${height / 2}\`,
      \`\${width / 2},\${height}\`,
      \`0,\${height / 2}\`,
    ].join(' ');

    return (
      <g>
        <polygon
          class-sprotty-node={true}
          class-${grammarName}={true}
          class-${astType}={true}
          class-mouseover={node.hoverFeedback}
          class-selected={node.selected}${tooltipAttr}
          points={points}
        />
        {context.renderChildren(node)}
      </g>
    );
  }
}
`;
}

// Ellipse shape
function generateEllipseView(grammarName: string, astType: string, tooltip?: string): string {
  const tooltipAttr = tooltip 
    ? `\n          title={resolveTooltip('${tooltip}', node)}` 
    : '';
  return `
@injectable()
export class ${astType}View extends SShapeElementView {
  render(
    node: Readonly<${astType}Node>,
    context: RenderingContext,
    args?: IViewArgs
  ): VNode | undefined {
    if (!this.isVisible(node, context)) {
      return undefined;
    }

    const { width, height } = node.size;

    return (
      <g>
        <ellipse
          class-sprotty-node={true}
          class-${grammarName}={true}
          class-${astType}={true}
          class-mouseover={node.hoverFeedback}
          class-selected={node.selected}${tooltipAttr}
          cx={width / 2}
          cy={height / 2}
          rx={width / 2}
          ry={height / 2}
        />
        {context.renderChildren(node)}
      </g>
    );
  }
}
`;
}

// Pill shape (rounded ends)
function generatePillView(grammarName: string, astType: string, tooltip?: string): string {
  const tooltipAttr = tooltip 
    ? `\n          title={resolveTooltip('${tooltip}', node)}` 
    : '';
  return `
@injectable()
export class ${astType}View extends SShapeElementView {
  render(
    node: Readonly<${astType}Node>,
    context: RenderingContext,
    args?: IViewArgs
  ): VNode | undefined {
    if (!this.isVisible(node, context)) {
      return undefined;
    }

    const { width, height } = node.size;

    return (
      <g>
        <rect
          class-sprotty-node={true}
          class-${grammarName}={true}
          class-${astType}={true}
          class-mouseover={node.hoverFeedback}
          class-selected={node.selected}${tooltipAttr}
          x="0"
          y="0"
          width={Math.max(width, 0)}
          height={Math.max(height, 0)}
          rx={height / 2}
          ry={height / 2}
        />
        {context.renderChildren(node)}
      </g>
    );
  }
}
`;
}
```

### Step 15.3: Generate src/diagram/module.ts

```typescript
/**
 * {DisplayName} Diagram Module
 *
 * InversifyJS dependency injection configuration for {DisplayName} Sprotty diagrams.
 * Registers model elements, views, and features.
 *
 * @packageDocumentation
 */

import { ContainerModule } from 'inversify';
import {
  TYPES,
  configureModelElement,
  configureViewerOptions,
  SGraphImpl,
  SGraphView,
  SLabelImpl,
  selectFeature,
  moveFeature,
  hoverFeature,
  boundsFeature,
  layoutContainerFeature,
} from 'sprotty';

// Model imports
import {
  {GrammarName}Types,
{modelClassImports}
  {GrammarName}Edge,
  {GrammarName}Compartment,
} from './model.js';

// View imports
import {
{viewClassImports}
  {GrammarName}ContainmentEdgeView,
  {GrammarName}ReferenceEdgeView,
  {GrammarName}NameLabelView,
  {GrammarName}TypeLabelView,
} from './views.js';

/**
 * {DisplayName} Diagram Module
 *
 * Configures Sprotty for {DisplayName} grammar visualization.
 */
export const {grammarName}DiagramModule = new ContainerModule((bind, unbind, isBound, rebind) => {
  const context = { bind, unbind, isBound, rebind };

  // ═══════════════════════════════════════════════════════════════
  // Viewer Options
  // ═══════════════════════════════════════════════════════════════
  configureViewerOptions(context, {
    needsClientLayout: true,
    needsServerLayout: true,
    baseDiv: '{languageId}-diagram',
    hiddenDiv: '{languageId}-diagram-hidden',
  });

  // ═══════════════════════════════════════════════════════════════
  // Graph Root
  // ═══════════════════════════════════════════════════════════════
  configureModelElement(context, {GrammarName}Types.GRAPH, SGraphImpl, SGraphView);

  // ═══════════════════════════════════════════════════════════════
  // Node Elements
  // ═══════════════════════════════════════════════════════════════
{nodeRegistrations}

  // ═══════════════════════════════════════════════════════════════
  // Edge Elements
  // ═══════════════════════════════════════════════════════════════
  configureModelElement(context, {GrammarName}Types.EDGE_CONTAINMENT, {GrammarName}Edge, {GrammarName}ContainmentEdgeView);
  configureModelElement(context, {GrammarName}Types.EDGE_REFERENCE, {GrammarName}Edge, {GrammarName}ReferenceEdgeView);

  // ═══════════════════════════════════════════════════════════════
  // Labels
  // ═══════════════════════════════════════════════════════════════
  configureModelElement(context, {GrammarName}Types.LABEL_NAME, SLabelImpl, {GrammarName}NameLabelView);
  configureModelElement(context, {GrammarName}Types.LABEL_TYPE, SLabelImpl, {GrammarName}TypeLabelView);
});

export default {grammarName}DiagramModule;
```

**Node registration generation** (for each rootType):

```typescript
// Template for node registrations
`  configureModelElement(
    context,
    ${GrammarName}Types.NODE_${astType.toUpperCase()},
    ${astType}Node,
    ${astType}View,
    { enable: [selectFeature, moveFeature, hoverFeature, boundsFeature] }
  );`
```

### Step 15.4: Generate src/diagram/styles.css

The CSS file uses grammar-qualified class names (e.g., `.Workflow.Step`) enabling developers to easily customize styling. Default colors are derived using heuristics.

**Color derivation heuristics** (applied during generation):

```typescript
function deriveColors(astType: string): { fill: string; stroke: string; hover: string } {
  const name = astType.toLowerCase();
  
  if (/workflow|flow|process|pipeline/i.test(name)) {
    return { fill: '#dbeafe', stroke: '#2563eb', hover: '#bfdbfe' }; // Blue
  }
  if (/task|step|action|activity/i.test(name)) {
    return { fill: '#d1fae5', stroke: '#059669', hover: '#a7f3d0' }; // Green
  }
  if (/decision|condition|choice|branch|gateway/i.test(name)) {
    return { fill: '#fef3c7', stroke: '#d97706', hover: '#fde68a' }; // Amber
  }
  if (/state|status|phase/i.test(name)) {
    return { fill: '#ede9fe', stroke: '#7c3aed', hover: '#ddd6fe' }; // Purple
  }
  if (/error|exception|fault|invalid/i.test(name)) {
    return { fill: '#fee2e2', stroke: '#dc2626', hover: '#fecaca' }; // Red
  }
  if (/event|trigger|signal|message/i.test(name)) {
    return { fill: '#cffafe', stroke: '#0891b2', hover: '#a5f3fc' }; // Cyan
  }
  if (/data|entity|record|model/i.test(name)) {
    return { fill: '#e0e7ff', stroke: '#4f46e5', hover: '#c7d2fe' }; // Indigo
  }
  if (/config|settings|option|param/i.test(name)) {
    return { fill: '#f1f5f9', stroke: '#475569', hover: '#e2e8f0' }; // Slate
  }
  if (/group|container|package|module|namespace/i.test(name)) {
    return { fill: '#f3f4f6', stroke: '#6b7280', hover: '#e5e7eb' }; // Gray (light)
  }
  if (/start|begin|initial/i.test(name)) {
    return { fill: '#dcfce7', stroke: '#16a34a', hover: '#bbf7d0' }; // Green (bright)
  }
  if (/end|final|terminal|stop/i.test(name)) {
    return { fill: '#fecaca', stroke: '#b91c1c', hover: '#fca5a5' }; // Red (bright)
  }
  
  // Default: neutral gray-blue
  return { fill: '#f0f9ff', stroke: '#0369a1', hover: '#e0f2fe' };
}
```

**Generated CSS template:**

```css
/**
 * {DisplayName} Diagram Styles
 *
 * Grammar-qualified CSS classes for {DisplayName} diagram elements.
 * 
 * Class naming convention:
 *   Nodes: .{GrammarName}.{RuleName}  (e.g., .Workflow.Step)
 *   Edges: .{GrammarName}.edge.{kind} (e.g., .Workflow.edge.containment)
 *   State: .selected, .mouseover, .highlighted
 *
 * Customize by editing this file or overriding in your application CSS.
 */

/* ═══════════════════════════════════════════════════════════════════
   Base Styles
   ═══════════════════════════════════════════════════════════════════ */

.sprotty-graph.{GrammarName} {
  background-color: #fafafa;
}

.sprotty-node.{GrammarName} {
  cursor: pointer;
  stroke-width: 2px;
  transition: fill 0.15s ease, stroke-width 0.1s ease;
}

.sprotty-node.{GrammarName}.selected {
  stroke-width: 3px;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.15));
}

.sprotty-edge.{GrammarName} {
  cursor: crosshair;
}

/* ═══════════════════════════════════════════════════════════════════
   Node Styles - {GrammarName}
   ═══════════════════════════════════════════════════════════════════ */

{nodeStyles}

/* ═══════════════════════════════════════════════════════════════════
   Edge Styles - {GrammarName}
   ═══════════════════════════════════════════════════════════════════ */

.{GrammarName}.edge.containment {
  stroke: #1e40af;
  stroke-width: 2px;
}

.{GrammarName}.edge.containment.optional {
  stroke-dasharray: 4, 2;
}

.{GrammarName}.containment-diamond {
  fill: #1e40af;
}

.{GrammarName}.edge.reference {
  stroke: #6366f1;
  stroke-width: 1.5px;
  stroke-dasharray: 6, 3;
}

.{GrammarName}.edge.reference.optional {
  opacity: 0.7;
}

.{GrammarName}.reference-arrow {
  fill: #6366f1;
}

/* ═══════════════════════════════════════════════════════════════════
   Label Styles - {GrammarName}
   ═══════════════════════════════════════════════════════════════════ */

.sprotty-label.{GrammarName} {
  fill: #111827;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
}

.{GrammarName}.name-label {
  font-weight: 600;
  font-size: 14px;
}

.{GrammarName}.type-label {
  fill: #6b7280;
  font-style: italic;
  font-size: 11px;
}
```

**Node styles generation** (for each rootType, using heuristic colors):

```css
/* {DisplayName} ({astType}) */
.{GrammarName}.{astType} {
  fill: {derivedFill};
  stroke: {derivedStroke};
}

.{GrammarName}.{astType}.mouseover {
  fill: {derivedHover};
}

.{GrammarName}.{astType}.selected {
  stroke: #2563eb;
}
```

**Example generated output for Workflow grammar:**

```css
/* Workflow Definition (WorkflowDef) */
.Workflow.WorkflowDef {
  fill: #dbeafe;
  stroke: #2563eb;
}

.Workflow.WorkflowDef.mouseover {
  fill: #bfdbfe;
}

.Workflow.WorkflowDef.selected {
  stroke: #2563eb;
}

/* Step (Step) */
.Workflow.Step {
  fill: #d1fae5;
  stroke: #059669;
}

.Workflow.Step.mouseover {
  fill: #a7f3d0;
}

.Workflow.Step.selected {
  stroke: #2563eb;
}

/* Decision (Decision) */
.Workflow.Decision {
  fill: #fef3c7;
  stroke: #d97706;
}

.Workflow.Decision.mouseover {
  fill: #fde68a;
}

.Workflow.Decision.selected {
  stroke: #2563eb;
}
```

### Step 15.5: Generate src/diagram/index.ts

```typescript
/**
 * {DisplayName} Diagram Module
 *
 * Barrel exports for {DisplayName} Sprotty diagram customizations.
 *
 * @packageDocumentation
 */

export * from './model.js';
export * from './views.js';
export { {grammarName}DiagramModule } from './module.js';
```

---

## Step 8 Update: Enhanced contribution.ts

Update the `contribution.ts` template to include the diagram module:

```typescript
/**
 * {DisplayName} Language Contribution
 *
 * Exports the LanguageContribution for registration with the unified server.
 *
 * @packageDocumentation
 */

import type { Module } from 'langium';
import type { LangiumServices, LangiumSharedServices } from 'langium/lsp';
import type {
  LanguageContribution,
  LspFeatureProviders,
  GlspFeatureProviders,
} from '@sanyam/types';
import type { ContainerModule } from 'inversify';

import { manifest } from './manifest.js';
import {
  {GrammarName}GeneratedModule,
  {GrammarName}GeneratedSharedModule,
} from './generated/module.js';
import { {grammarName}DiagramModule } from './diagram/index.js';

/**
 * Custom LSP providers for {DisplayName}.
 */
const lspProviders: Partial<LspFeatureProviders> = {
  // Add custom LSP providers here
};

/**
 * Custom GLSP providers for {DisplayName}.
 */
const glspProviders: Partial<GlspFeatureProviders> = {
  // Add custom GLSP providers here
};

/**
 * {DisplayName} Language Contribution
 */
export const contribution: LanguageContribution = {
  languageId: '{languageId}',
  fileExtensions: ['.{ext}'],
  generatedSharedModule: {GrammarName}GeneratedSharedModule as Module<LangiumSharedServices>,
  generatedModule: {GrammarName}GeneratedModule as Module<LangiumServices>,
  manifest,
  lspProviders,
  glspProviders,
  diagramModule: {grammarName}DiagramModule as ContainerModule,  // NEW
};

export default contribution;
```

---

## Step 9 Update: Enhanced package.json

Add Sprotty dependencies:

```json
{
  "name": "@sanyam-grammar/{name}",
  "version": "0.0.1",
  "description": "Grammar package for {DisplayName}",
  "type": "module",
  "main": "./lib/contribution.js",
  "types": "./lib/contribution.d.ts",
  "exports": {
    ".": {
      "types": "./lib/contribution.d.ts",
      "import": "./lib/contribution.js"
    },
    "./contribution": {
      "types": "./lib/contribution.d.ts",
      "import": "./lib/contribution.js"
    },
    "./manifest": {
      "types": "./lib/manifest.d.ts",
      "import": "./lib/manifest.js"
    },
    "./diagram": {
      "types": "./lib/diagram/index.d.ts",
      "import": "./lib/diagram/index.js"
    }
  },
  "scripts": {
    "build": "npm run langium:generate && tsc -b tsconfig.json",
    "clean": "rimraf lib src/generated",
    "langium:generate": "langium generate",
    "watch": "tsc -b tsconfig.json --watch"
  },
  "sanyam": {
    "grammar": true,
    "languageId": "{languageId}",
    "contribution": "./lib/contribution.js",
    "diagramModule": "./lib/diagram/module.js"
  },
  "dependencies": {
    "langium": "^4.1.0",
    "sprotty": "^1.4.0",
    "inversify": "^6.0.2"
  },
  "devDependencies": {
    "@sanyam/types": "workspace:*",
    "@types/snabbdom": "^0.5.0",
    "langium-cli": "^4.0.0",
    "rimraf": "^5.0.0",
    "typescript": "~5.6.3"
  }
}
```

---

## Step 10 Update: Enhanced tsconfig.json

Add JSX support for TSX views:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../../configs/base.tsconfig.json",
  "compilerOptions": {
    "outDir": "./lib",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "jsx": "react",
    "reactNamespace": "JSX"
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.tsx"
  ],
  "exclude": [
    "node_modules",
    "lib"
  ],
  "references": [
    { "path": "../../types" }
  ]
}
```

---

## Step 14 Update: Enhanced Completion Report

Update the completion report to include diagram files:

```
Grammar package generated successfully!

Master grammar:
  packages/grammar-definitions/.source/{name}.langium    - Master source (DO NOT DELETE)

Package files created:
  packages/grammar-definitions/{name}/src/{name}.langium       - Grammar copy (synced from .source/)
  packages/grammar-definitions/{name}/src/manifest.ts          - GrammarManifest configuration
  packages/grammar-definitions/{name}/src/contribution.ts      - LanguageContribution export
  packages/grammar-definitions/{name}/src/logo.svg             - Grammar logo (bundled by webpack)

  Diagram customization:
  packages/grammar-definitions/{name}/src/diagram/index.ts     - Barrel exports
  packages/grammar-definitions/{name}/src/diagram/model.ts     - Custom Sprotty model elements
  packages/grammar-definitions/{name}/src/diagram/views.tsx    - Custom Sprotty views
  packages/grammar-definitions/{name}/src/diagram/module.ts    - InversifyJS DI configuration
  packages/grammar-definitions/{name}/src/diagram/styles.css   - CSS styling

  packages/grammar-definitions/{name}/package.json             - Package with sanyam discovery metadata
  packages/grammar-definitions/{name}/tsconfig.json            - TypeScript configuration (JSX enabled)
  packages/grammar-definitions/{name}/langium-config.json      - Langium CLI configuration

Grammar: {DisplayName}
Language ID: {languageId}
Root Types: {count} ({list of type names})
Diagramming: Enabled (with custom views)
Logo: Auto-generated (bundled to assets/logos/{languageId}.svg by webpack)

Diagram shapes:
{list of rootType → shape mappings}

Next steps:
1. Build the grammar package (generates Langium modules):
   cd packages/grammar-definitions/{name} && pnpm build

2. Install workspace dependencies:
   pnpm install

3. To modify the grammar:
   - Edit packages/grammar-definitions/.source/{name}.langium (master)
   - Re-run /grammar.config {name} to sync changes and regenerate diagram code

4. To customize diagram appearance:
   - Add @shape, @tooltip tags to grammar rules
   - Edit src/diagram/styles.css for color/styling customization
   - CSS uses grammar-qualified selectors: .{GrammarName}.{RuleName}
   - Edit src/diagram/views.tsx for SVG/shape customization

Note: The .source/{name}.langium is the master copy. Changes should be made there
and synced to the package via /grammar.config. NEVER delete the .source/ file.
```

---

## Reference: Extended Type Definitions

Add to `@sanyam/types`:

### DiagramNodeConfig (Simplified)

```typescript
interface DiagramNodeConfig {
  glspType: string;           // GLSP type identifier (e.g., 'node:step')
  sprottyType: string;        // Sprotty type identifier (same as glspType)
  shape: 'rectangle' | 'rounded' | 'hexagon' | 'diamond' | 'ellipse' | 'pill';
  tooltip?: string;           // Hover tooltip template (supports ${name})
  cssClass: string;           // Grammar-qualified CSS class (e.g., 'Workflow.Step')
  defaultSize: { width: number; height: number };
}
```

**Note**: Visual styling (fill, stroke, colors) is controlled entirely via CSS using the grammar-qualified class names. This allows developers to customize appearance by editing `styles.css` without regenerating code.

### LanguageContribution (Enhanced)

```typescript
interface LanguageContribution {
  languageId: string;
  fileExtensions: string[];
  generatedSharedModule: Module<LangiumSharedServices>;
  generatedModule: Module<LangiumServices>;
  customModule?: Module<LangiumServices>;
  manifest: GrammarManifest;
  lspProviders?: LspFeatureProviders;
  glspProviders?: GlspFeatureProviders;
  diagramModule?: ContainerModule;  // NEW: Sprotty diagram module
  disabledLspFeatures?: LspFeatureName[];
  disabledGlspFeatures?: GlspFeatureName[];
}
```

---

## Example: Generated Output for Workflow Grammar

Given this grammar with diagram tags:

```langium
// @name = "Workflow DSL"
// @tagline = "Visual workflow automation"
// @extension = ".wf"
grammar Workflow

// @shape = "rounded"
// @tooltip = "Workflow model containing ${name}"
entry Model:
    (workflows+=WorkflowDef)*;

// @shape = "hexagon"
// @tooltip = "Workflow: ${name}"
WorkflowDef:
    'workflow' name=ID '{' (steps+=Step)* '}';

// @shape = "rectangle"
// @tooltip = "Step: ${name}"
Step:
    'step' name=ID (':' description=STRING)? ('->' next=[Step:ID])?;

// @shape = "diamond"
// @tooltip = "Decision point"
Decision:
    'if' condition=STRING 'then' thenStep=[Step:ID] ('else' elseStep=[Step:ID])?;
```

The command generates:

**src/diagram/model.ts** (excerpt):

```typescript
export const WorkflowTypes = {
  GRAPH: 'graph',
  NODE_MODEL: 'node:model',
  NODE_WORKFLOWDEF: 'node:workflowdef',
  NODE_STEP: 'node:step',
  NODE_DECISION: 'node:decision',
  EDGE_CONTAINMENT: 'edge:containment',
  EDGE_REFERENCE: 'edge:reference',
  LABEL_NAME: 'label:name',
  LABEL_TYPE: 'label:type',
  COMPARTMENT_HEADER: 'compartment:header',
  COMPARTMENT_BODY: 'compartment:body',
} as const;

export class WorkflowDefNode extends SNodeImpl {
  name: string = '';
  sourceRange?: { start: number; end: number };
  // ...
}

export class StepNode extends SNodeImpl {
  name: string = '';
  sourceRange?: { start: number; end: number };
  // ...
}

export class DecisionNode extends SNodeImpl {
  name: string = '';
  sourceRange?: { start: number; end: number };
  // ...
}
```

**src/diagram/views.tsx** (excerpt):

```typescript
@injectable()
export class StepView extends SShapeElementView {
  render(
    node: Readonly<StepNode>,
    context: RenderingContext,
    args?: IViewArgs
  ): VNode | undefined {
    if (!this.isVisible(node, context)) {
      return undefined;
    }

    const { width, height } = node.size;

    return (
      <g>
        <rect
          class-sprotty-node={true}
          class-Workflow={true}
          class-Step={true}
          class-mouseover={node.hoverFeedback}
          class-selected={node.selected}
          title={resolveTooltip('Step: ${name}', node)}
          x="0"
          y="0"
          width={Math.max(width, 0)}
          height={Math.max(height, 0)}
        />
        {context.renderChildren(node)}
      </g>
    );
  }
}
```

**src/diagram/styles.css** (excerpt):

```css
/* ═══════════════════════════════════════════════════════════════════
   Node Styles - Workflow
   Colors derived from rule name heuristics, easily customizable
   ═══════════════════════════════════════════════════════════════════ */

/* Model (entry rule) - Blue (data/model pattern) */
.Workflow.Model {
  fill: #e0e7ff;
  stroke: #4f46e5;
}

.Workflow.Model.mouseover {
  fill: #c7d2fe;
}

.Workflow.Model.selected {
  stroke: #2563eb;
}

/* WorkflowDef - Blue (workflow pattern) */
.Workflow.WorkflowDef {
  fill: #dbeafe;
  stroke: #2563eb;
}

.Workflow.WorkflowDef.mouseover {
  fill: #bfdbfe;
}

.Workflow.WorkflowDef.selected {
  stroke: #2563eb;
}

/* Step - Green (task/step pattern) */
.Workflow.Step {
  fill: #d1fae5;
  stroke: #059669;
}

.Workflow.Step.mouseover {
  fill: #a7f3d0;
}

.Workflow.Step.selected {
  stroke: #2563eb;
}

/* Decision - Amber (decision pattern) */
.Workflow.Decision {
  fill: #fef3c7;
  stroke: #d97706;
}

.Workflow.Decision.mouseover {
  fill: #fde68a;
}

.Workflow.Decision.selected {
  stroke: #2563eb;
}
```

---

## Summary of Changes

| Step | Change |
|------|--------|
| Step 4.2 | Extract `@shape` and `@tooltip` tags from grammar comments |
| Step 6 | Generate `diagramNode` with shape from tag or heuristics, grammar-qualified CSS class |
| Step 8 | Include `diagramModule` reference in `contribution.ts` |
| Step 9 | Add Sprotty and Inversify dependencies to `package.json` |
| Step 10 | Add JSX/TSX support to `tsconfig.json` |
| Step 14 | Report diagram files in completion summary |
| **Step 15** | **NEW**: Generate `src/diagram/` with model, views, module, and styles |

### Key Design Decisions

1. **Grammar-qualified CSS classes** (`{GrammarName}.{RuleName}`) enable intuitive styling without code regeneration
2. **Color heuristics** derive sensible defaults from rule names (workflow→blue, step→green, decision→amber)
3. **Only structural tags** (`@shape`, `@tooltip`) in grammar comments; visual styling delegated to CSS
4. **Tooltip templates** support `${name}` placeholder for dynamic content
