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
import type { Point } from 'sprotty-protocol';

import {
  type SnapGridConfig,
  DEFAULT_SNAP_GRID_CONFIG,
  snapToGrid,
  SnapGridServiceSymbol,
  type SnapGridService,
} from './snap-grid-types';

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
  snap(position: Point, _element: SModelElementImpl): Point {
    // Get current config from service if available
    const config = this.snapGridService?.getConfig() ?? this.config;

    console.log('[GridSnapper] snap called', {
      position,
      enabled: config.enabled,
      gridSize: config.gridSize,
      hasService: !!this.snapGridService,
      serviceConfig: this.snapGridService?.getConfig()
    });

    if (!config.enabled) {
      return position;
    }

    const snappedX = this.snapValue(position.x, config);
    const snappedY = this.snapValue(position.y, config);

    console.log('[GridSnapper] snapped to', { x: snappedX, y: snappedY });
    return { x: snappedX, y: snappedY };
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
