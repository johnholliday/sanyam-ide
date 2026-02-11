There is no standalone "expandable container with children" example repo in the GLSP ecosystem. The closest working reference is the **Workflow Example** in `glsp-examples` (which has compartment nodes with hbox/vbox layouts) plus the **ExpandButtonView** pattern documented on the GLSP site. The Ecore GLSP editor (EClasses with attribute compartments) is the most feature-complete real-world example of container nodes, but it uses a Java server.

Let me synthesize a working example from the official documentation and source code.

### Best Starting Point

The `node-json-theia` project template at:

- **[glsp-examples/project-templates/node-json-theia](https://github.com/eclipse-glsp/glsp-examples/tree/master/project-templates/node-json-theia)** — TypeScript server, JSON source model, Theia integration

### The Pattern (assembled from GLSP docs)

There are three interlocking pieces:

**1. Server — Build the GModel with nested compartments**

```typescript
// Node GLSP Server (TypeScript)
GNode.builder()
  .type('node:container')
  .addCssClass('container-node')
  .position(point ?? Point.ORIGIN)
  .layout('vbox')
  .addLayoutOption('paddingTop', 10)
  .addLayoutOption('paddingBottom', 10)
  .addLayoutOption('paddingLeft', 10)
  .addLayoutOption('paddingRight', 10)
  .addLayoutOption('hAlign', 'center')
  // Header compartment (hbox): icon + label + expand button
  .add(
    GCompartment.builder()
      .type('comp:header')
      .layout('hbox')
      .addLayoutOption('hGap', 5)
      .add(GCompartment.builder().type('icon').build())
      .add(GLabel.builder().text('My Container').id('header-label').build())
      .add(
        GButton.builder()
          .type(DefaultTypes.BUTTON_EXPAND)
          .addCssClass('button-expand')
          .enabled(true)
          .build()
      )
      .build()
  )
  // Children compartment (vbox) — holds the child nodes
  .add(
    GCompartment.builder()
      .type('comp:structure')
      .layout('freeform')  // or 'vbox' for stacked children
      .addLayoutOption('prefWidth', 250)
      .addLayoutOption('prefHeight', 125)
      .add(
        GNode.builder()
          .type('node:child')
          .position({ x: 20, y: 10 })
          .size(100, 40)
          .add(GLabel.builder().text('Child 1').build())
          .build()
      )
      .add(
        GNode.builder()
          .type('node:child')
          .position({ x: 20, y: 60 })
          .size(100, 40)
          .add(GLabel.builder().text('Child 2').build())
          .build()
      )
      .build()
  )
  .build();
```

**2. Client — Model class, views, and DI wiring (`di.config.ts`)**

```typescript
// model.ts
import { GNode, Expandable, expandFeature } from '@eclipse-glsp/client';

export class ContainerNode extends GNode implements Expandable {
  static override readonly DEFAULT_FEATURES = [
    ...GNode.DEFAULT_FEATURES,
    expandFeature
  ];
  expanded = true;
}
// container-node-view.tsx
/** @jsx svg */
import { VNode } from 'snabbdom';
import { RenderingContext, ShapeView, svg, IViewArgs } from '@eclipse-glsp/client';
import { injectable } from 'inversify';
import { ContainerNode } from './model';

@injectable()
export class ContainerNodeView extends ShapeView {
  render(node: Readonly<ContainerNode>, context: RenderingContext, args?: IViewArgs): VNode | undefined {
    if (!this.isVisible(node, context)) {
      return undefined;
    }
    return (
      <g class-node-container={true} class-selected={node.selected}>
        <rect
          class-sprotty-node={true}
          x="0" y="0"
          rx="5" ry="5"
          width={Math.max(node.size.width, 0)}
          height={Math.max(node.size.height, 0)}
        ></rect>
        {context.renderChildren(node)}
      </g>
    );
  }
}
// di.config.ts
import { ContainerModule } from 'inversify';
import {
  configureModelElement, DefaultTypes, GButton, GCompartment,
  GCompartmentView, GLabel, GLabelView, GNode,
  RectangularNodeView, ExpandButtonView, CollapseExpandAction,
  configureActionHandler
} from '@eclipse-glsp/client';
import { StructureCompartmentView } from '@eclipse-glsp/client';
import { ContainerNode } from './model';
import { ContainerNodeView } from './container-node-view';
import { ExpandHandler } from './expand-handler';

export const diagramModule = new ContainerModule((bind, unbind, isBound, rebind) => {
  const context = { bind, unbind, isBound, rebind };

  // Container node with expand support
  configureModelElement(context, 'node:container', ContainerNode, ContainerNodeView);

  // Child nodes
  configureModelElement(context, 'node:child', GNode, RectangularNodeView);

  // Compartments
  configureModelElement(context, 'comp:header', GCompartment, GCompartmentView);
  configureModelElement(context, 'comp:structure', GCompartment, StructureCompartmentView);

  // Expand button
  configureModelElement(context, DefaultTypes.BUTTON_EXPAND, GButton, ExpandButtonView);

  // Expand action handler
  configureActionHandler(context, CollapseExpandAction.KIND, ExpandHandler);
});
```

**3. Client — ExpandHandler (toggles visibility of children compartment)**

```typescript
// expand-handler.ts
import { injectable, inject } from 'inversify';
import {
  Action, CollapseExpandAction, GParentElement,
  IActionHandler, TYPES, SelectionService, SModelRoot
} from '@eclipse-glsp/client';

@injectable()
export class ExpandHandler implements IActionHandler {
  @inject(TYPES.SelectionService) protected selectionService: SelectionService;

  expansionState: { [key: string]: boolean } = {};

  handle(action: Action): void {
    if (action.kind === CollapseExpandAction.KIND) {
      const cea = action as CollapseExpandAction;
      cea.expandIds.forEach(id => (this.expansionState[id] = true));
      cea.collapseIds.forEach(id => (this.expansionState[id] = false));
      this.applyExpansionState();
    }
  }

  get modelRoot(): Readonly<SModelRoot> {
    return this.selectionService.getModelRoot();
  }

  protected applyExpansionState(): void {
    for (const id in this.expansionState) {
      const element = this.modelRoot.index.getById(id);
      if (element && element instanceof GParentElement && element.children) {
        (element as any).expanded = this.expansionState[id];
      }
    }
  }
}
```

### Layout Gotchas

These are the pain points you're likely to hit with container+children layouts:

- **Don't nest GNodes inside GNodes** for layout children. Use `GCompartment` for structural containers inside a GNode. Nesting GNodes causes layout computation issues (confirmed in GLSP Discussion #454).
- **`freeform` layout** positions children by their explicit `x/y` coords relative to parent. The container auto-resizes around them.
- **`vbox`/`hbox` layout** stacks children sequentially. Children's positions are computed by the layouter, not their explicit coords.
- **`resizeContainer: true`** (default for vbox/hbox) means the parent grows to fit its children. Set `prefWidth`/`prefHeight` to define a minimum.
- **XY-movable children inside a movable container** is *not supported* out of the box (Discussion #353). Workaround: auto-size the container and don't make it independently movable, or use freeform layout with `reparentable` type hints.
- **`ShapeTypeHint.containableElementTypeIds`** on the server must declare which child types a container can hold, otherwise drag-to-reparent won't work.

### Where to Find Real Source Code

| Repo                                                         | What It Shows                                             |
| ------------------------------------------------------------ | --------------------------------------------------------- |
| [glsp-server-node/examples/workflow-server](https://github.com/eclipse-glsp/glsp-server-node/tree/master/examples/workflow-server) | TS server with compartment/layout GModel construction     |
| [glsp-client/examples/workflow-glsp](https://github.com/eclipse-glsp/glsp-client/tree/master/examples/workflow-glsp) | Client views, Icon model, DI config for compartment nodes |
| [glsp-client/packages/client/src/views/compartments.tsx](https://github.com/eclipse-glsp/glsp-client/blob/master/packages/client/src/views/compartments.tsx) | `StructureCompartmentView` source                         |
| [GLSP Client-side Layouting docs](https://eclipse.dev/glsp/documentation/clientlayouting/) | hbox/vbox/freeform layout options reference               |
| [GLSP Rendering docs](https://eclipse.dev/glsp/documentation/rendering/) | ExpandButtonView + ExpandableNode pattern                 |
| [glsp-examples/project-templates/node-json-theia](https://github.com/eclipse-glsp/glsp-examples/tree/master/project-templates/node-json-theia) | Cleanest starting point for a TS/Theia project            |

The workflow example is the canonical reference, but it doesn't have an explicit "expandable container with children" node — it uses flat task nodes with hbox compartments for icon+label. The expand pattern is documented separately in the Rendering docs. The example code above wires both together into what you need.