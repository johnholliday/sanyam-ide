/**
 * Snap to Grid Types (FR-017, FR-018, FR-019)
 *
 * Types for snap-to-grid functionality in diagram editing.
 *
 * @packageDocumentation
 */

// =============================================================================
// Grid Configuration
// =============================================================================

/**
 * Grid configuration for snap-to-grid behavior.
 */
export interface SnapGridConfig {
  /**
   * Whether snap-to-grid is enabled.
   * @default false
   */
  readonly enabled: boolean;

  /**
   * Grid cell size in pixels.
   * Elements snap to multiples of this value.
   * @default 10
   */
  readonly gridSize: number;

  /**
   * Whether to show visual grid lines.
   * @default false
   */
  readonly showGrid: boolean;

  /**
   * Grid line color (CSS color value).
   * @default 'rgba(128, 128, 128, 0.2)'
   */
  readonly gridColor: string;

  /**
   * Snap threshold in pixels.
   * Elements will snap when within this distance of a grid line.
   * @default 5
   */
  readonly snapThreshold: number;
}

/**
 * Default grid configuration.
 */
export const DEFAULT_SNAP_GRID_CONFIG: SnapGridConfig = {
  enabled: false,
  gridSize: 10,
  showGrid: false,
  gridColor: 'rgba(128, 128, 128, 0.2)',
  snapThreshold: 5,
};

// =============================================================================
// Grid State
// =============================================================================

/**
 * Current state of the snap-to-grid feature.
 */
export interface SnapGridState {
  /** Current configuration */
  readonly config: SnapGridConfig;

  /** Whether grid is currently visible */
  readonly gridVisible: boolean;

  /** Last snapped position (for feedback) */
  readonly lastSnappedPosition?: SnapPosition;
}

/**
 * A position that has been snapped to grid.
 */
export interface SnapPosition {
  /** Original position before snapping */
  readonly original: { x: number; y: number };

  /** Snapped position */
  readonly snapped: { x: number; y: number };

  /** Whether x was snapped */
  readonly xSnapped: boolean;

  /** Whether y was snapped */
  readonly ySnapped: boolean;
}

// =============================================================================
// Grid Actions
// =============================================================================

/**
 * Action to toggle snap-to-grid.
 */
export interface ToggleSnapToGridAction {
  readonly kind: 'toggleSnapToGrid';
  /** Optional explicit state (otherwise toggles) */
  readonly enabled?: boolean;
}

/**
 * Action to update grid configuration.
 */
export interface UpdateSnapGridConfigAction {
  readonly kind: 'updateSnapGridConfig';
  /** Partial configuration update */
  readonly config: Partial<SnapGridConfig>;
}

/**
 * Action to toggle grid visibility.
 */
export interface ToggleGridVisibilityAction {
  readonly kind: 'toggleGridVisibility';
  /** Optional explicit state (otherwise toggles) */
  readonly visible?: boolean;
}

/**
 * Union of all snap-to-grid actions.
 */
export type SnapGridAction =
  | ToggleSnapToGridAction
  | UpdateSnapGridConfigAction
  | ToggleGridVisibilityAction;

// =============================================================================
// Snap Utilities
// =============================================================================

/**
 * Snap a value to the nearest grid line.
 *
 * @param value - Value to snap
 * @param gridSize - Grid cell size
 * @returns Snapped value
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Snap a position to the grid.
 *
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param config - Grid configuration
 * @returns Snapped position with snap info
 */
export function snapPositionToGrid(
  x: number,
  y: number,
  config: SnapGridConfig
): SnapPosition {
  if (!config.enabled) {
    return {
      original: { x, y },
      snapped: { x, y },
      xSnapped: false,
      ySnapped: false,
    };
  }

  const snappedX = snapToGrid(x, config.gridSize);
  const snappedY = snapToGrid(y, config.gridSize);

  const xDiff = Math.abs(x - snappedX);
  const yDiff = Math.abs(y - snappedY);

  // Only snap if within threshold
  const xSnapped = xDiff <= config.snapThreshold;
  const ySnapped = yDiff <= config.snapThreshold;

  return {
    original: { x, y },
    snapped: {
      x: xSnapped ? snappedX : x,
      y: ySnapped ? snappedY : y,
    },
    xSnapped,
    ySnapped,
  };
}

/**
 * Check if a position is on a grid line.
 *
 * @param value - Value to check
 * @param gridSize - Grid cell size
 * @param tolerance - Tolerance for floating point comparison
 * @returns True if on grid
 */
export function isOnGrid(
  value: number,
  gridSize: number,
  tolerance: number = 0.001
): boolean {
  const remainder = value % gridSize;
  return remainder < tolerance || gridSize - remainder < tolerance;
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Service for managing snap-to-grid functionality.
 */
export interface SnapGridService {
  /**
   * Get current state.
   */
  getState(): SnapGridState;

  /**
   * Get current configuration.
   */
  getConfig(): SnapGridConfig;

  /**
   * Update configuration.
   */
  setConfig(config: Partial<SnapGridConfig>): void;

  /**
   * Toggle snap-to-grid enabled state.
   */
  toggle(): boolean;

  /**
   * Enable snap-to-grid.
   */
  enable(): void;

  /**
   * Disable snap-to-grid.
   */
  disable(): void;

  /**
   * Toggle grid visibility.
   */
  toggleGridVisibility(): boolean;

  /**
   * Snap a position according to current config.
   */
  snap(x: number, y: number): SnapPosition;

  /**
   * Subscribe to configuration changes.
   */
  onConfigChanged(callback: (config: SnapGridConfig) => void): { dispose(): void };
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Service ID for dependency injection.
 */
export const SnapGridServiceSymbol = Symbol('SnapGridService');

/**
 * CSS classes for grid UI.
 */
export const SnapGridCssClasses = {
  GRID_OVERLAY: 'sanyam-grid-overlay',
  GRID_LINE_H: 'sanyam-grid-line-h',
  GRID_LINE_V: 'sanyam-grid-line-v',
  SNAP_INDICATOR: 'sanyam-snap-indicator',
} as const;

/**
 * Toolbar button ID for snap-to-grid toggle.
 */
export const SNAP_TO_GRID_TOOLBAR_ID = 'sanyam.diagram.snapToGrid';

/**
 * Preference ID for snap-to-grid enabled state.
 */
export const SNAP_TO_GRID_PREFERENCE_ID = 'diagram.snapToGrid.enabled';

/**
 * Preference ID for grid size.
 */
export const GRID_SIZE_PREFERENCE_ID = 'diagram.snapToGrid.gridSize';
