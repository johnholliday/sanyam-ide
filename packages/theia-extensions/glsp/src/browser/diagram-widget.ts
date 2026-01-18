/**
 * Diagram Widget (T084)
 *
 * Widget for rendering GLSP diagrams in Theia.
 * Handles diagram rendering, user interactions, and synchronization.
 *
 * @packageDocumentation
 */

import { injectable, postConstruct } from 'inversify';
import { Widget, BaseWidget, Message } from '@theia/core/lib/browser';
import { Emitter, Event, DisposableCollection } from '@theia/core/lib/common';
import URI from '@theia/core/lib/common/uri';

/**
 * Factory ID for diagram widgets.
 */
export const DIAGRAM_WIDGET_FACTORY_ID = 'sanyam-diagram-widget';

/**
 * Options for creating a diagram widget.
 */
export namespace DiagramWidget {
  export interface Options {
    /** URI of the source document */
    uri: string;
    /** Diagram type identifier */
    diagramType: string;
    /** Optional label override */
    label?: string;
  }
}

/**
 * GModel element base interface.
 */
export interface GModelElement {
  id: string;
  type: string;
  children?: GModelElement[];
}

/**
 * GModel root interface.
 */
export interface GModelRoot extends GModelElement {
  revision?: number;
}

/**
 * Point type.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Dimension type.
 */
export interface Dimension {
  width: number;
  height: number;
}

/**
 * Selection state.
 */
export interface SelectionState {
  selectedIds: string[];
  hoveredId?: string;
}

/**
 * Diagram state.
 */
export interface DiagramState {
  gModel?: GModelRoot;
  positions: Map<string, Point>;
  sizes: Map<string, Dimension>;
  selection: SelectionState;
  viewport: {
    scroll: Point;
    zoom: number;
  };
}

/**
 * Events emitted by the diagram widget.
 */
export interface DiagramWidgetEvents {
  onModelChanged: Event<GModelRoot>;
  onSelectionChanged: Event<SelectionState>;
  onOperationRequested: Event<{ operation: any }>;
}

/**
 * Diagram widget for rendering GLSP diagrams.
 *
 * This widget:
 * - Renders GModel as SVG using Sprotty
 * - Handles user interactions (selection, drag, connect)
 * - Communicates with the GLSP server for operations
 * - Synchronizes with text document changes
 */
@injectable()
export class DiagramWidget extends BaseWidget implements DiagramWidgetEvents {
  static readonly ID = DIAGRAM_WIDGET_FACTORY_ID;

  /** Source document URI */
  readonly uri: string;

  /** Diagram type */
  readonly diagramType: string;

  /** Current diagram state */
  protected state: DiagramState = {
    positions: new Map(),
    sizes: new Map(),
    selection: { selectedIds: [] },
    viewport: { scroll: { x: 0, y: 0 }, zoom: 1 },
  };

  /** Disposables */
  protected readonly toDispose = new DisposableCollection();

  /** Event emitters */
  protected readonly onModelChangedEmitter = new Emitter<GModelRoot>();
  protected readonly onSelectionChangedEmitter = new Emitter<SelectionState>();
  protected readonly onOperationRequestedEmitter = new Emitter<{ operation: any }>();

  /** Event accessors */
  readonly onModelChanged = this.onModelChangedEmitter.event;
  readonly onSelectionChanged = this.onSelectionChangedEmitter.event;
  readonly onOperationRequested = this.onOperationRequestedEmitter.event;

  /** SVG container element */
  protected svgContainer: HTMLDivElement | undefined;

  /** Tool palette element */
  protected toolPalette: HTMLDivElement | undefined;

  constructor(
    protected readonly options: DiagramWidget.Options
  ) {
    super();
    this.uri = options.uri;
    this.diagramType = options.diagramType;

    this.id = `${DIAGRAM_WIDGET_FACTORY_ID}:${options.uri}`;
    this.title.label = options.label ?? this.getDefaultLabel();
    this.title.caption = options.uri;
    this.title.closable = true;
    this.title.iconClass = 'fa fa-project-diagram';

    this.addClass('sanyam-diagram-widget');

    this.toDispose.push(this.onModelChangedEmitter);
    this.toDispose.push(this.onSelectionChangedEmitter);
    this.toDispose.push(this.onOperationRequestedEmitter);
  }

  @postConstruct()
  protected init(): void {
    this.update();
  }

  /**
   * Get default label from URI.
   */
  protected getDefaultLabel(): string {
    const uri = new URI(this.uri);
    return `${uri.path.base} (Diagram)`;
  }

  /**
   * Called when widget is attached to DOM.
   */
  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    this.createDiagramContainer();
    this.loadModel();
  }

  /**
   * Called when widget is shown.
   */
  protected onAfterShow(msg: Message): void {
    super.onAfterShow(msg);
    this.refresh();
  }

  /**
   * Called when widget is resized.
   */
  protected onResize(msg: Widget.ResizeMessage): void {
    super.onResize(msg);
    this.updateViewport();
  }

  /**
   * Create the diagram container elements.
   */
  protected createDiagramContainer(): void {
    // Create main container
    const container = document.createElement('div');
    container.className = 'sanyam-diagram-container';

    // Create tool palette
    this.toolPalette = document.createElement('div');
    this.toolPalette.className = 'sanyam-diagram-tool-palette';
    container.appendChild(this.toolPalette);

    // Create SVG container
    this.svgContainer = document.createElement('div');
    this.svgContainer.className = 'sanyam-diagram-svg-container';
    container.appendChild(this.svgContainer);

    // Add event listeners
    this.svgContainer.addEventListener('click', this.handleClick.bind(this));
    this.svgContainer.addEventListener('contextmenu', this.handleContextMenu.bind(this));
    this.svgContainer.addEventListener('wheel', this.handleWheel.bind(this));

    this.node.appendChild(container);
  }

  /**
   * Load the diagram model from the server.
   */
  async loadModel(): Promise<void> {
    // This will be called via the language client
    // For now, set up placeholder
    console.log(`Loading diagram model for: ${this.uri}`);
  }

  /**
   * Set the diagram model.
   */
  setModel(gModel: GModelRoot): void {
    this.state.gModel = gModel;
    this.onModelChangedEmitter.fire(gModel);
    this.render();
  }

  /**
   * Get the current diagram model.
   */
  getModel(): GModelRoot | undefined {
    return this.state.gModel;
  }

  /**
   * Render the diagram.
   */
  protected render(): void {
    if (!this.svgContainer || !this.state.gModel) {
      return;
    }

    // Clear existing content
    this.svgContainer.innerHTML = '';

    // Create SVG element
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'sanyam-diagram-svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');

    // Render elements
    this.renderElements(svg, this.state.gModel.children ?? []);

    this.svgContainer.appendChild(svg);
  }

  /**
   * Render GModel elements to SVG.
   */
  protected renderElements(container: SVGElement, elements: GModelElement[]): void {
    for (const element of elements) {
      const svgElement = this.createSvgElement(element);
      if (svgElement) {
        container.appendChild(svgElement);

        // Render children
        if (element.children && element.children.length > 0) {
          this.renderElements(svgElement as SVGElement, element.children);
        }
      }
    }
  }

  /**
   * Create SVG element for a GModel element.
   */
  protected createSvgElement(element: GModelElement): SVGElement | null {
    const type = element.type;

    if (type.includes('node')) {
      return this.createNodeElement(element);
    } else if (type.includes('edge')) {
      return this.createEdgeElement(element);
    } else if (type.includes('label')) {
      return this.createLabelElement(element);
    } else if (type.includes('compartment')) {
      return this.createCompartmentElement(element);
    }

    // Default group
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', element.id);
    group.setAttribute('data-type', element.type);
    return group;
  }

  /**
   * Create SVG element for a node.
   */
  protected createNodeElement(element: GModelElement): SVGElement {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', element.id);
    group.setAttribute('data-type', element.type);
    group.classList.add('sanyam-node');

    // Get position and size
    const position = this.state.positions.get(element.id) ?? { x: 0, y: 0 };
    const size = this.state.sizes.get(element.id) ?? { width: 100, height: 50 };

    group.setAttribute('transform', `translate(${position.x}, ${position.y})`);

    // Create rectangle
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', String(size.width));
    rect.setAttribute('height', String(size.height));
    rect.setAttribute('rx', '5');
    rect.setAttribute('ry', '5');
    rect.classList.add('sanyam-node-rect');

    // Highlight if selected
    if (this.state.selection.selectedIds.includes(element.id)) {
      group.classList.add('selected');
    }

    group.appendChild(rect);

    // Add click handler
    group.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectElement(element.id);
    });

    return group;
  }

  /**
   * Create SVG element for an edge.
   */
  protected createEdgeElement(element: GModelElement): SVGElement {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', element.id);
    group.setAttribute('data-type', element.type);
    group.classList.add('sanyam-edge');

    // Create path (placeholder - actual routing would be computed)
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M 0 0 L 100 100'); // Placeholder path
    path.classList.add('sanyam-edge-path');

    // Highlight if selected
    if (this.state.selection.selectedIds.includes(element.id)) {
      group.classList.add('selected');
    }

    group.appendChild(path);

    return group;
  }

  /**
   * Create SVG element for a label.
   */
  protected createLabelElement(element: GModelElement): SVGElement {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('id', element.id);
    text.setAttribute('data-type', element.type);
    text.classList.add('sanyam-label');

    // Get label text from element
    const labelText = (element as any).text ?? '';
    text.textContent = labelText;

    return text;
  }

  /**
   * Create SVG element for a compartment.
   */
  protected createCompartmentElement(element: GModelElement): SVGElement {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', element.id);
    group.setAttribute('data-type', element.type);
    group.classList.add('sanyam-compartment');

    return group;
  }

  /**
   * Handle click events.
   */
  protected handleClick(event: MouseEvent): void {
    // Deselect if clicking on empty space
    if (event.target === this.svgContainer || (event.target as HTMLElement).tagName === 'svg') {
      this.clearSelection();
    }
  }

  /**
   * Handle context menu.
   */
  protected handleContextMenu(event: MouseEvent): void {
    event.preventDefault();

    const target = event.target as Element;
    const elementId = this.findElementId(target);

    // Request context menu from server
    this.requestContextMenu(
      elementId ? [elementId] : this.state.selection.selectedIds,
      { x: event.clientX, y: event.clientY }
    );
  }

  /**
   * Handle wheel events for zoom.
   */
  protected handleWheel(event: WheelEvent): void {
    if (event.ctrlKey) {
      event.preventDefault();
      const delta = event.deltaY > 0 ? 0.9 : 1.1;
      this.state.viewport.zoom *= delta;
      this.state.viewport.zoom = Math.max(0.1, Math.min(5, this.state.viewport.zoom));
      this.updateViewport();
    }
  }

  /**
   * Find element ID from DOM element.
   */
  protected findElementId(target: Element): string | undefined {
    let current: Element | null = target;
    while (current && current !== this.svgContainer) {
      const id = current.getAttribute('id');
      if (id) {
        return id;
      }
      current = current.parentElement;
    }
    return undefined;
  }

  /**
   * Select an element.
   */
  selectElement(elementId: string, addToSelection: boolean = false): void {
    if (addToSelection) {
      if (this.state.selection.selectedIds.includes(elementId)) {
        // Remove from selection
        this.state.selection.selectedIds = this.state.selection.selectedIds.filter(id => id !== elementId);
      } else {
        // Add to selection
        this.state.selection.selectedIds.push(elementId);
      }
    } else {
      // Replace selection
      this.state.selection.selectedIds = [elementId];
    }

    this.onSelectionChangedEmitter.fire(this.state.selection);
    this.render();
  }

  /**
   * Clear selection.
   */
  clearSelection(): void {
    this.state.selection.selectedIds = [];
    this.onSelectionChangedEmitter.fire(this.state.selection);
    this.render();
  }

  /**
   * Get current selection.
   */
  getSelection(): string[] {
    return [...this.state.selection.selectedIds];
  }

  /**
   * Request context menu from server.
   */
  protected requestContextMenu(selectedIds: string[], position: Point): void {
    this.onOperationRequestedEmitter.fire({
      operation: {
        kind: 'contextMenu',
        selectedIds,
        position,
      },
    });
  }

  /**
   * Execute an operation.
   */
  executeOperation(operation: any): void {
    this.onOperationRequestedEmitter.fire({ operation });
  }

  /**
   * Update positions from metadata.
   */
  updatePositions(positions: Map<string, Point>): void {
    this.state.positions = new Map(positions);
    this.render();
  }

  /**
   * Update sizes from metadata.
   */
  updateSizes(sizes: Map<string, Dimension>): void {
    this.state.sizes = new Map(sizes);
    this.render();
  }

  /**
   * Update viewport.
   */
  protected updateViewport(): void {
    if (this.svgContainer) {
      const svg = this.svgContainer.querySelector('svg');
      if (svg) {
        const { scroll, zoom } = this.state.viewport;
        svg.style.transform = `scale(${zoom}) translate(${-scroll.x}px, ${-scroll.y}px)`;
        svg.style.transformOrigin = '0 0';
      }
    }
  }

  /**
   * Refresh the diagram.
   */
  refresh(): void {
    this.loadModel();
  }

  /**
   * Zoom to fit all elements.
   */
  zoomToFit(): void {
    this.state.viewport.zoom = 1;
    this.state.viewport.scroll = { x: 0, y: 0 };
    this.updateViewport();
  }

  /**
   * Dispose the widget.
   */
  dispose(): void {
    this.toDispose.dispose();
    super.dispose();
  }
}

/**
 * Factory for creating diagram widgets.
 */
@injectable()
export class DiagramWidgetFactory {
  /**
   * Create a diagram widget.
   */
  createWidget(options: DiagramWidget.Options): DiagramWidget {
    return new DiagramWidget(options);
  }
}
