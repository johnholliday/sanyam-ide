/**
 * Port View (T061, T067)
 *
 * Sprotty view for rendering connection ports on nodes.
 * Supports visual feedback for valid/invalid connection targets.
 *
 * @packageDocumentation
 */

import { injectable } from 'inversify';
import { VNode, h } from 'snabbdom';
import {
  RenderingContext,
  IView,
  SPortImpl,
  SNodeImpl,
} from 'sprotty';

/**
 * Extended port implementation with styling support.
 */
export class SanyamPortImpl extends SPortImpl {
  /** Port style: circle, square, or diamond */
  style: 'circle' | 'square' | 'diamond' = 'circle';

  /** Whether this port is a valid connection target */
  isValidTarget: boolean = false;

  /** Whether this port is an invalid connection target */
  isInvalidTarget: boolean = false;

  /** Whether this port is currently being hovered */
  isHovered: boolean = false;

  /** Port label (shown on hover) */
  label?: string;

  /** Allowed connection edge types */
  allowedConnections?: string[];
}

/**
 * Port view for rendering ports with visual feedback.
 *
 * Features:
 * - Shape-based rendering (circle, square, diamond)
 * - Visual feedback for valid/invalid targets during connection
 * - Hover state highlighting
 * - Configurable size and colors via CSS
 */
@injectable()
export class SanyamPortView implements IView {
  /** Default port size */
  static readonly DEFAULT_SIZE = 15;

  render(port: Readonly<SanyamPortImpl>, context: RenderingContext): VNode {
    const size = port.bounds?.width ?? SanyamPortView.DEFAULT_SIZE;
    const halfSize = size / 2;

    // Build CSS classes
    const cssClasses = this.getCssClasses(port);

    // Render based on port style
    switch (port.style) {
      case 'square':
        return this.renderSquare(port, size, cssClasses, context);
      case 'diamond':
        return this.renderDiamond(port, halfSize, cssClasses, context);
      case 'circle':
      default:
        return this.renderCircle(port, halfSize, cssClasses, context);
    }
  }

  /**
   * Render a circular port.
   */
  protected renderCircle(
    port: Readonly<SanyamPortImpl>,
    radius: number,
    cssClasses: Record<string, boolean>,
    _context: RenderingContext
  ): VNode {
    const children: VNode[] = [
      h('circle', {
        class: cssClasses,
        attrs: {
          cx: radius,
          cy: radius,
          r: radius,
        },
      }),
    ];

    const labelVNode = this.renderLabel(port, radius * 2);
    if (labelVNode) {
      children.push(labelVNode);
    }

    return h('g', { class: { 'sanyam-port': true } }, children);
  }

  /**
   * Render a square port.
   */
  protected renderSquare(
    port: Readonly<SanyamPortImpl>,
    size: number,
    cssClasses: Record<string, boolean>,
    _context: RenderingContext
  ): VNode {
    const children: VNode[] = [
      h('rect', {
        class: cssClasses,
        attrs: {
          x: 0,
          y: 0,
          width: size,
          height: size,
        },
      }),
    ];

    const labelVNode = this.renderLabel(port, size);
    if (labelVNode) {
      children.push(labelVNode);
    }

    return h('g', { class: { 'sanyam-port': true } }, children);
  }

  /**
   * Render a diamond-shaped port.
   */
  protected renderDiamond(
    port: Readonly<SanyamPortImpl>,
    halfSize: number,
    cssClasses: Record<string, boolean>,
    _context: RenderingContext
  ): VNode {
    const points = [
      `${halfSize},0`,
      `${halfSize * 2},${halfSize}`,
      `${halfSize},${halfSize * 2}`,
      `0,${halfSize}`,
    ].join(' ');

    const children: VNode[] = [
      h('polygon', {
        class: cssClasses,
        attrs: { points },
      }),
    ];

    const labelVNode = this.renderLabel(port, halfSize * 2);
    if (labelVNode) {
      children.push(labelVNode);
    }

    return h('g', { class: { 'sanyam-port': true } }, children);
  }

  /**
   * Render port label (shown on hover).
   */
  protected renderLabel(port: Readonly<SanyamPortImpl>, size: number): VNode | undefined {
    if (!port.label || !port.isHovered) {
      return undefined;
    }

    return h('text', {
      class: { 'sanyam-port-label': true },
      attrs: {
        x: size + 4,
        y: size / 2 + 4,
      },
    }, port.label);
  }

  /**
   * Build CSS class object for port.
   */
  protected getCssClasses(port: Readonly<SanyamPortImpl>): Record<string, boolean> {
    const classes: Record<string, boolean> = {
      'sanyam-port-shape': true,
      [`sanyam-port-${port.style}`]: true,
    };

    // T067: Visual feedback for connection targets
    if (port.isValidTarget) {
      classes['sanyam-port-valid-target'] = true;
    }
    if (port.isInvalidTarget) {
      classes['sanyam-port-invalid-target'] = true;
    }
    if (port.isHovered) {
      classes['sanyam-port-hover'] = true;
    }

    // Add any custom CSS classes from model
    if (port.cssClasses) {
      for (const cls of port.cssClasses) {
        classes[cls] = true;
      }
    }

    return classes;
  }
}

/**
 * Check if an element is a port.
 */
export function isPort(element: unknown): element is SanyamPortImpl {
  return element instanceof SanyamPortImpl || element instanceof SPortImpl;
}

/**
 * Get the parent node of a port.
 */
export function getPortParentNode(port: SPortImpl): SNodeImpl | undefined {
  const parent = port.parent;
  if (parent instanceof SNodeImpl) {
    return parent;
  }
  return undefined;
}
