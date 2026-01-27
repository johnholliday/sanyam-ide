/**
 * Snap Grid Preferences (T050, FR-017, FR-018, FR-019)
 *
 * Theia preferences schema for snap-to-grid settings.
 *
 * @packageDocumentation
 */

import { PreferenceSchema, PreferenceContribution } from '@theia/core/lib/common/preferences/preference-schema';
import type { PreferenceProxy } from '@theia/core/lib/common/preferences/preference-proxy';
import { createPreferenceProxy } from '@theia/core/lib/common/preferences/preference-proxy';
import { PreferenceService } from '@theia/core/lib/common/preferences/preference-service';
import { interfaces } from 'inversify';

import {
  SNAP_TO_GRID_PREFERENCE_ID,
  GRID_SIZE_PREFERENCE_ID,
  DEFAULT_SNAP_GRID_CONFIG,
} from './snap-grid-types';

/**
 * Preference ID for showing grid lines.
 */
export const SHOW_GRID_PREFERENCE_ID = 'diagram.snapToGrid.showGrid';

/**
 * Preference ID for grid color.
 */
export const GRID_COLOR_PREFERENCE_ID = 'diagram.snapToGrid.gridColor';

/**
 * Preference ID for snap threshold.
 */
export const SNAP_THRESHOLD_PREFERENCE_ID = 'diagram.snapToGrid.snapThreshold';

/**
 * Snap-to-grid preferences schema.
 */
export const snapGridPreferenceSchema: PreferenceSchema = {
  properties: {
    [SNAP_TO_GRID_PREFERENCE_ID]: {
      type: 'boolean',
      default: DEFAULT_SNAP_GRID_CONFIG.enabled,
      description: 'Enable snap-to-grid when moving diagram elements.',
    },
    [GRID_SIZE_PREFERENCE_ID]: {
      type: 'number',
      default: DEFAULT_SNAP_GRID_CONFIG.gridSize,
      minimum: 5,
      maximum: 100,
      description: 'Grid cell size in pixels for snap-to-grid.',
    },
    [SHOW_GRID_PREFERENCE_ID]: {
      type: 'boolean',
      default: DEFAULT_SNAP_GRID_CONFIG.showGrid,
      description: 'Show visual grid lines in the diagram editor.',
    },
    [GRID_COLOR_PREFERENCE_ID]: {
      type: 'string',
      default: DEFAULT_SNAP_GRID_CONFIG.gridColor,
      description: 'Color of grid lines (CSS color value).',
    },
    [SNAP_THRESHOLD_PREFERENCE_ID]: {
      type: 'number',
      default: DEFAULT_SNAP_GRID_CONFIG.snapThreshold,
      minimum: 1,
      maximum: 20,
      description: 'Distance in pixels within which elements snap to grid lines.',
    },
  },
};

/**
 * Snap-to-grid preferences interface.
 */
export interface SnapGridPreferences {
  [SNAP_TO_GRID_PREFERENCE_ID]: boolean;
  [GRID_SIZE_PREFERENCE_ID]: number;
  [SHOW_GRID_PREFERENCE_ID]: boolean;
  [GRID_COLOR_PREFERENCE_ID]: string;
  [SNAP_THRESHOLD_PREFERENCE_ID]: number;
}

/**
 * Symbol for snap-grid preferences.
 */
export const SnapGridPreferencesSymbol = Symbol('SnapGridPreferences');

/**
 * Create snap-grid preferences proxy.
 *
 * @param preferences - Preference service
 * @returns Preference proxy
 */
export function createSnapGridPreferences(preferences: PreferenceService): PreferenceProxy<SnapGridPreferences> {
  return createPreferenceProxy(preferences, snapGridPreferenceSchema);
}

/**
 * Bind snap-grid preferences in container.
 *
 * @param bind - Inversify bind function
 */
export function bindSnapGridPreferences(bind: interfaces.Bind): void {
  bind(PreferenceContribution).toConstantValue({ schema: snapGridPreferenceSchema });

  bind(SnapGridPreferencesSymbol).toDynamicValue(ctx => {
    const preferences = ctx.container.get<PreferenceService>(PreferenceService);
    return createSnapGridPreferences(preferences);
  }).inSingletonScope();
}

/**
 * Get current snap-grid configuration from preferences.
 *
 * @param preferences - Preference service
 * @returns Current configuration
 */
export function getSnapGridConfigFromPreferences(preferences: PreferenceService): {
  enabled: boolean;
  gridSize: number;
  showGrid: boolean;
  gridColor: string;
  snapThreshold: number;
} {
  return {
    enabled: preferences.get<boolean>(SNAP_TO_GRID_PREFERENCE_ID, DEFAULT_SNAP_GRID_CONFIG.enabled),
    gridSize: preferences.get<number>(GRID_SIZE_PREFERENCE_ID, DEFAULT_SNAP_GRID_CONFIG.gridSize),
    showGrid: preferences.get<boolean>(SHOW_GRID_PREFERENCE_ID, DEFAULT_SNAP_GRID_CONFIG.showGrid),
    gridColor: preferences.get<string>(GRID_COLOR_PREFERENCE_ID, DEFAULT_SNAP_GRID_CONFIG.gridColor),
    snapThreshold: preferences.get<number>(SNAP_THRESHOLD_PREFERENCE_ID, DEFAULT_SNAP_GRID_CONFIG.snapThreshold),
  };
}
