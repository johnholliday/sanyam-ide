/**
 * Grid Snapper (T048, FR-017, FR-018)
 *
 * Implements Sprotty ISnapper interface for snap-to-grid functionality.
 * Snaps element positions to grid intersections during drag operations.
 *
 * @packageDocumentation
 */

import { injectable, inject, optional } from 'inversify';
import type { ISnapper, SModelElementImpl } from 'sprotty';
import { SChildElementImpl, SShapeElementImpl } from 'sprotty';
import type { Point } from 'sprotty-protocol';

import {
  type SnapGridConfig,
  DEFAULT_SNAP_GRID_CONFIG,
  snapToGrid,
  SnapGridServiceSymbol,
  type SnapGridService,
} from './snap-grid-types';
import { SanyamContainerNodeImpl } from '../../di/sanyam-container-node';

/**
 * Container body area padding (must match ELK padding in elk-layout-module.ts).
 */
const CONTAINER_PADDING = { top: 40, left: 12, bottom: 12, right: 12 };

/**
 * Minimum container body area size beyond padding. The container will never
 * shrink below its current minimum (header + padding + this body size).
 */
const MIN_CONTAINER_BODY = { width: 100, height: 40 };

/**
 * Extra margin (px) added when auto-expanding a container to give breathing room.
 */
const EXPAND_MARGIN = 20;

/**
 * Grid Snapper Implementation.
 *
 * Implements Sprotty's ISnapper interface to provide snap-to-grid
 * behavior during element drag operations.
 *
 * Features:
 * - Snaps to configurable grid size
 * - Respects snap threshold (only snaps when close to grid line)
 * - Can be enabled/disabled dynamically
 */
@injectable()
export class GridSnapper implements ISnapper {
  /** Current configuration */
  protected config: SnapGridConfig = { ...DEFAULT_SNAP_GRID_CONFIG };

  @inject(SnapGridServiceSymbol) @optional()
  protected readonly snapGridService?: SnapGridService;

  /**
   * Snap a point to the grid.
   *
   * This method is called by Sprotty during drag operations.
   *
   * @param position - The position to snap
   * @param _element - The element being dragged (unused)
   * @returns Snapped position
   */
  snap(position: Point, element: SModelElementImpl): Point {
    // Get current config from service if available
    const config = this.snapGridService?.getConfig() ?? this.config;

    let result = position;

    if (config.enabled) {
      const snappedX = this.snapValue(position.x, config);
      const snappedY = this.snapValue(position.y, config);
      result = { x: snappedX, y: snappedY };
    }

    // Clamp child nodes within parent container bounds
    return this.clampWithinContainer(result, element);
  }

  /**
   * Constrain a child element within its parent container, expanding the
   * container when the child is dragged past the current boundary.
   *
   * If the element is a child of a container node (SanyamContainerNodeImpl):
   * - Positions are clamped at the minimum (top/left padding)
   * - When the child + its size would exceed the container body area the
   *   container is dynamically expanded to accommodate it
   *
   * @param position - Position to constrain
   * @param element - The element being moved
   * @returns Constrained position (may be unchanged if container was expanded)
   */
  protected clampWithinContainer(position: Point, element: SModelElementImpl): Point {
    // Walk up to find the container node. Structure:
    // Container → body compartment → child node (element)
    if (!(element instanceof SChildElementImpl)) {
      return position;
    }
    const bodyComp = element.parent;
    if (!(bodyComp instanceof SChildElementImpl)) {
      return position;
    }
    const container = bodyComp.parent;
    if (!(container instanceof SanyamContainerNodeImpl)) {
      return position;
    }

    // Get child element size (default to 0 if not a shape)
    const childWidth = element instanceof SShapeElementImpl ? element.size.width : 0;
    const childHeight = element instanceof SShapeElementImpl ? element.size.height : 0;

    // Enforce minimum position (cannot drag above header or into left padding)
    const clampedX = Math.max(CONTAINER_PADDING.left, position.x);
    const clampedY = Math.max(CONTAINER_PADDING.top, position.y);

    // Compute the space the child needs from the container origin
    const requiredWidth = clampedX + childWidth + CONTAINER_PADDING.right + EXPAND_MARGIN;
    const requiredHeight = clampedY + childHeight + CONTAINER_PADDING.bottom + EXPAND_MARGIN;

    // Minimum container size: padding + minimum body area
    const minWidth = CONTAINER_PADDING.left + MIN_CONTAINER_BODY.width + CONTAINER_PADDING.right;
    const minHeight = CONTAINER_PADDING.top + MIN_CONTAINER_BODY.height + CONTAINER_PADDING.bottom;

    // Expand the container if needed (never shrink below minimum)
    const newWidth = Math.max(minWidth, container.size.width, requiredWidth);
    const newHeight = Math.max(minHeight, container.size.height, requiredHeight);

    if (newWidth !== container.size.width || newHeight !== container.size.height) {
      (container as any).size = { width: newWidth, height: newHeight };
    }

    return { x: clampedX, y: clampedY };
  }

  /**
   * Snap a single value to the grid.
   *
   * @param value - Value to snap
   * @param config - Grid configuration
   * @returns Snapped value
   */
  protected snapValue(value: number, config: SnapGridConfig): number {
    const snapped = snapToGrid(value, config.gridSize);
    const diff = Math.abs(value - snapped);

    // Only snap if within threshold
    if (diff <= config.snapThreshold) {
      return snapped;
    }

    return value;
  }

  /**
   * Update the configuration.
   *
   * @param config - Partial configuration update
   */
  setConfig(config: Partial<SnapGridConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get the current configuration.
   */
  getConfig(): SnapGridConfig {
    return this.snapGridService?.getConfig() ?? { ...this.config };
  }

  /**
   * Check if snapping is enabled.
   */
  isEnabled(): boolean {
    return this.getConfig().enabled;
  }

  /**
   * Enable snapping.
   */
  enable(): void {
    if (this.snapGridService) {
      this.snapGridService.enable();
    } else {
      this.config = { ...this.config, enabled: true };
    }
  }

  /**
   * Disable snapping.
   */
  disable(): void {
    if (this.snapGridService) {
      this.snapGridService.disable();
    } else {
      this.config = { ...this.config, enabled: false };
    }
  }

  /**
   * Toggle snapping.
   *
   * @returns New enabled state
   */
  toggle(): boolean {
    if (this.snapGridService) {
      return this.snapGridService.toggle();
    }

    const newEnabled = !this.config.enabled;
    this.config = { ...this.config, enabled: newEnabled };
    return newEnabled;
  }
}

/**
 * Create a grid snapper instance.
 */
export function createGridSnapper(): GridSnapper {
  return new GridSnapper();
}
