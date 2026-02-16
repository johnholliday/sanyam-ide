/**
 * Snap Grid Tool (T049, T054, FR-017, FR-018, FR-019)
 *
 * UI extension for snap-to-grid functionality including:
 * - Grid overlay visualization
 * - Toolbar toggle button
 * - Preference persistence
 *
 * @packageDocumentation
 */

import { createLogger } from '@sanyam/logger';
import { injectable, inject, optional } from 'inversify';
import { Emitter } from '@theia/core/lib/common';
import { PreferenceService } from '@theia/core/lib/common/preferences/preference-service';
import type { SModelRootImpl } from 'sprotty';

import { AbstractUIExtension, DIAGRAM_CONTAINER_ID } from '../../ui-extensions/base-ui-extension';
import {
  type SnapGridConfig,
  type SnapGridState,
  type SnapPosition,
  type SnapGridService,
  DEFAULT_SNAP_GRID_CONFIG,
  SnapGridCssClasses,
  SNAP_TO_GRID_PREFERENCE_ID,
  GRID_SIZE_PREFERENCE_ID,
  snapPositionToGrid,
} from './snap-grid-types';

/**
 * Snap Grid Tool Extension ID.
 */
export const SNAP_GRID_TOOL_ID = 'sanyam-snap-grid-tool';

/**
 * Global key for shared snap grid config state.
 * Using window object ensures state survives webpack loading module from different chunks.
 */
const SNAP_GRID_CONFIG_KEY = '__sanyam_snap_grid_config__';
const SNAP_GRID_EMITTER_KEY = '__sanyam_snap_grid_emitter__';

/**
 * Get the global shared config (creates it if it doesn't exist).
 * This ensures all instances share the same config, even across webpack chunks.
 */
function getSharedConfig(): SnapGridConfig {
  if (!(window as any)[SNAP_GRID_CONFIG_KEY]) {
    (window as any)[SNAP_GRID_CONFIG_KEY] = { ...DEFAULT_SNAP_GRID_CONFIG };
  }
  return (window as any)[SNAP_GRID_CONFIG_KEY];
}

/**
 * Get or create the global shared emitter.
 * This ensures all instances fire/listen on the same emitter.
 */
function getSharedEmitter(): Emitter<SnapGridConfig> {
  if (!(window as any)[SNAP_GRID_EMITTER_KEY]) {
    (window as any)[SNAP_GRID_EMITTER_KEY] = new Emitter<SnapGridConfig>();
  }
  return (window as any)[SNAP_GRID_EMITTER_KEY];
}

/**
 * Update the global shared config and fire the global emitter.
 */
function setSharedConfig(config: Partial<SnapGridConfig>): void {
  const current = getSharedConfig();
  Object.assign(current, config);
  // Fire the global emitter so all listeners (across all instances) are notified
  getSharedEmitter().fire({ ...current });
}

/**
 * Snap Grid Tool Extension.
 *
 * Provides:
 * - Visual grid overlay (optional)
 * - Snap-to-grid service implementation
 * - Preference persistence (T054)
 */
/** Counter for instance tracking */
let snapGridToolInstanceCounter = 0;

@injectable()
export class SnapGridTool extends AbstractUIExtension implements SnapGridService {
  protected readonly logger = createLogger({ name: 'SnapGridTool' });

  /** Unique instance ID for debugging */
  public readonly instanceId = ++snapGridToolInstanceCounter;

  @inject(DIAGRAM_CONTAINER_ID) @optional()
  protected diagramContainerId: string | undefined;

  @inject(PreferenceService) @optional()
  protected readonly preferenceService?: PreferenceService;

  /** Current configuration */
  protected config: SnapGridConfig = { ...DEFAULT_SNAP_GRID_CONFIG };

  constructor() {
    super();
  }

  /** Grid visible state */
  protected gridVisible: boolean = false;

  /** Grid overlay element */
  protected gridOverlay: HTMLElement | undefined;

  /** Config changed emitter */
  protected readonly onConfigChangedEmitter = new Emitter<SnapGridConfig>();

  /** Parent container element reference */
  protected parentContainerElement: HTMLElement | undefined;

  id(): string {
    return SNAP_GRID_TOOL_ID;
  }

  containerClass(): string {
    return SnapGridCssClasses.GRID_OVERLAY;
  }

  /**
   * Set the parent container element.
   */
  setParentContainer(element: HTMLElement): void {
    this.parentContainerElement = element;
  }

  protected getParentContainer(): HTMLElement | undefined {
    if (this.parentContainerElement) {
      return this.parentContainerElement;
    }

    if (this.diagramContainerId) {
      const container = document.getElementById(this.diagramContainerId);
      if (container?.parentElement) {
        return container.parentElement;
      }
    }

    return undefined;
  }

  protected initializeContents(containerElement: HTMLElement): void {
    // Set up container as grid overlay
    containerElement.style.position = 'absolute';
    containerElement.style.top = '0';
    containerElement.style.left = '0';
    containerElement.style.width = '100%';
    containerElement.style.height = '100%';
    containerElement.style.pointerEvents = 'none';
    containerElement.style.overflow = 'hidden';
    containerElement.style.display = 'none'; // Hidden by default

    this.gridOverlay = containerElement;

    // T054: Load preferences
    this.loadPreferences();
  }

  /**
   * T054: Load preferences from Theia preference service.
   */
  protected loadPreferences(): void {
    if (!this.preferenceService) {
      return;
    }

    try {
      const enabled = this.preferenceService.get<boolean>(SNAP_TO_GRID_PREFERENCE_ID, false);
      const gridSize = this.preferenceService.get<number>(GRID_SIZE_PREFERENCE_ID, DEFAULT_SNAP_GRID_CONFIG.gridSize);

      this.config = {
        ...this.config,
        enabled: enabled ?? false,
        gridSize: gridSize ?? DEFAULT_SNAP_GRID_CONFIG.gridSize,
      };

      // Propagate to global shared config so getConfig() returns the loaded values
      setSharedConfig({ enabled: this.config.enabled, gridSize: this.config.gridSize });

      this.logger.info({ enabled, gridSize }, 'Loaded preferences');
    } catch (error) {
      this.logger.warn({ err: error }, 'Failed to load preferences');
    }
  }

  /**
   * T054: Save preferences to Theia preference service.
   */
  protected async savePreferences(): Promise<void> {
    if (!this.preferenceService) {
      return;
    }

    try {
      await this.preferenceService.set(SNAP_TO_GRID_PREFERENCE_ID, this.config.enabled);
      await this.preferenceService.set(GRID_SIZE_PREFERENCE_ID, this.config.gridSize);
      this.logger.info('Saved preferences');
    } catch (error) {
      this.logger.warn({ err: error }, 'Failed to save preferences');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SnapGridService Implementation
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get current state.
   */
  getState(): SnapGridState {
    return {
      config: { ...getSharedConfig() },
      gridVisible: this.gridVisible,
    };
  }

  /**
   * Get current configuration.
   * Uses global shared config to ensure consistency across all instances and webpack chunks.
   */
  getConfig(): SnapGridConfig {
    const shared = getSharedConfig();
    return { ...shared };
  }

  /**
   * Update configuration.
   * Updates both instance config and global shared config.
   */
  setConfig(config: Partial<SnapGridConfig>): void {
    this.config = { ...this.config, ...config };
    // Update global shared config and fire global emitter (notifies ALL listeners across all instances)
    setSharedConfig(config);

    // Update grid overlay if visibility changed
    if ('showGrid' in config) {
      this.updateGridVisibility();
    }

    // T054: Persist preferences
    this.savePreferences();
  }

  /**
   * Toggle snap-to-grid enabled state.
   */
  toggle(): boolean {
    // Read current state from global config to ensure consistency
    const currentEnabled = getSharedConfig().enabled;
    const newEnabled = !currentEnabled;
    this.setConfig({ enabled: newEnabled });
    return newEnabled;
  }

  /**
   * Enable snap-to-grid.
   */
  enable(): void {
    if (!this.config.enabled) {
      this.setConfig({ enabled: true });
      this.logger.info('Snap-to-grid enabled');
    }
  }

  /**
   * Disable snap-to-grid.
   */
  disable(): void {
    if (this.config.enabled) {
      this.setConfig({ enabled: false });
      this.logger.info('Snap-to-grid disabled');
    }
  }

  /**
   * Toggle grid visibility.
   */
  toggleGridVisibility(): boolean {
    const newVisible = !this.config.showGrid;
    this.setConfig({ showGrid: newVisible });
    return newVisible;
  }

  /**
   * Snap a position according to current config.
   */
  snap(x: number, y: number): SnapPosition {
    return snapPositionToGrid(x, y, this.config);
  }

  /**
   * Subscribe to configuration changes.
   * Uses the global emitter so listeners are notified regardless of which instance triggers the change.
   */
  onConfigChanged(callback: (config: SnapGridConfig) => void): { dispose(): void } {
    return getSharedEmitter().event(callback);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Grid Overlay Rendering
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Update grid visibility.
   */
  protected updateGridVisibility(): void {
    if (!this.gridOverlay) {
      return;
    }

    if (this.config.showGrid) {
      this.gridOverlay.style.display = 'block';
      this.renderGrid();
    } else {
      this.gridOverlay.style.display = 'none';
    }

    this.gridVisible = this.config.showGrid;
  }

  /**
   * Render the grid overlay.
   */
  protected renderGrid(): void {
    if (!this.gridOverlay) {
      return;
    }

    // Clear existing grid
    this.gridOverlay.innerHTML = '';

    // Create SVG for grid lines
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';

    // Create pattern for grid
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
    pattern.setAttribute('id', 'snap-grid-pattern');
    pattern.setAttribute('width', String(this.config.gridSize));
    pattern.setAttribute('height', String(this.config.gridSize));
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');

    // Horizontal line
    const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    hLine.setAttribute('x1', '0');
    hLine.setAttribute('y1', String(this.config.gridSize));
    hLine.setAttribute('x2', String(this.config.gridSize));
    hLine.setAttribute('y2', String(this.config.gridSize));
    hLine.setAttribute('stroke', this.config.gridColor);
    hLine.setAttribute('stroke-width', '1');
    pattern.appendChild(hLine);

    // Vertical line
    const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    vLine.setAttribute('x1', String(this.config.gridSize));
    vLine.setAttribute('y1', '0');
    vLine.setAttribute('x2', String(this.config.gridSize));
    vLine.setAttribute('y2', String(this.config.gridSize));
    vLine.setAttribute('stroke', this.config.gridColor);
    vLine.setAttribute('stroke-width', '1');
    pattern.appendChild(vLine);

    defs.appendChild(pattern);
    svg.appendChild(defs);

    // Fill rect with pattern
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', 'url(#snap-grid-pattern)');
    svg.appendChild(rect);

    this.gridOverlay.appendChild(svg);
  }

  override modelChanged(_model: SModelRootImpl): void {
    // Re-render grid if visible
    if (this.gridVisible) {
      this.renderGrid();
    }
  }

  /**
   * Dispose the tool.
   */
  dispose(): void {
    this.onConfigChangedEmitter.dispose();
    super.dispose();
  }
}
