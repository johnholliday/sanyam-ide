/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Diagram Preferences
 *
 * Defines user preferences for diagram visualization including background styles,
 * colors, and other visual options.
 *
 * @packageDocumentation
 */

import { PreferenceSchema } from '@theia/core/lib/common/preferences/preference-schema';

/**
 * Preference keys for diagram configuration.
 */
export namespace DiagramPreferences {
    export const BACKGROUND_STYLE = 'diagram.background.style';
    export const BACKGROUND_IMAGE_PATH = 'diagram.background.imagePath';
    export const PATTERN_OPACITY = 'diagram.pattern.opacity';
    export const GRID_SIZE = 'diagram.grid.size';
    export const DOTS_SIZE = 'diagram.dots.size';
    export const DOTS_SPACING = 'diagram.dots.spacing';
    export const TOOLBAR_VISIBLE = 'diagram.toolbar.visible';
    export const FLOATING_TOOLBAR_VISIBLE = 'diagram.floatingToolbar.visible';
    export const EDGE_JUMPS_ENABLED = 'diagram.edgeJumps.enabled';
    export const ANIMATED_EDGES_ENABLED = 'diagram.edges.animated';
}

/**
 * Available background style options.
 */
export type DiagramBackgroundStyle = 'none' | 'dots' | 'grid' | 'image';

/**
 * Diagram preferences schema.
 */
export const diagramPreferenceSchema: PreferenceSchema = {
    properties: {
        [DiagramPreferences.BACKGROUND_STYLE]: {
            type: 'string',
            enum: ['none', 'dots', 'grid', 'image'],
            enumDescriptions: [
                'No background pattern (uses theme background)',
                'Dot pattern background',
                'Grid lines background',
                'Custom image background',
            ],
            default: 'dots',
            description: 'The background style for diagram canvases.',
        },
        [DiagramPreferences.BACKGROUND_IMAGE_PATH]: {
            type: 'string',
            default: '',
            description: 'Path or URL to a custom background image file (used when style is "image").',
        },
        [DiagramPreferences.PATTERN_OPACITY]: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            default: 0.3,
            description: 'Opacity of the background pattern (dots, grid, or image). Range: 0 (invisible) to 1 (fully opaque).',
        },
        [DiagramPreferences.GRID_SIZE]: {
            type: 'number',
            minimum: 5,
            maximum: 150,
            default: 30,
            description: 'Size of grid cells in pixels.',
        },
        [DiagramPreferences.DOTS_SIZE]: {
            type: 'number',
            minimum: 0.5,
            maximum: 15,
            default: 1,
            description: 'Size of dots in pixels.',
        },
        [DiagramPreferences.DOTS_SPACING]: {
            type: 'number',
            minimum: 5,
            maximum: 150,
            default: 20,
            description: 'Spacing between dots in pixels.',
        },
        [DiagramPreferences.TOOLBAR_VISIBLE]: {
            type: 'boolean',
            default: false,
            description: 'Show the embedded toolbar at the top of the diagram view.',
        },
        [DiagramPreferences.FLOATING_TOOLBAR_VISIBLE]: {
            type: 'boolean',
            default: true,
            description: 'Show the floating mini-toolbar in the bottom-left corner of the diagram canvas.',
        },
        [DiagramPreferences.EDGE_JUMPS_ENABLED]: {
            type: 'boolean',
            default: false,
            description: 'Enable edge jumps (line bridges) at edge crossing points.',
        },
        [DiagramPreferences.ANIMATED_EDGES_ENABLED]: {
            type: 'boolean',
            default: true,
            description: 'Animate dashed edges with a marching ants effect. Only affects edges that use a dash pattern (e.g., association edges).',
        },
    },
};
