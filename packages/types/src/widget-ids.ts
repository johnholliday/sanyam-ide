/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Widget Factory IDs for Sanyam IDE
 *
 * These Symbol-based IDs enable decoupled widget lookup between packages.
 * Using Symbols prevents circular dependencies between the composite-editor
 * and glsp packages while allowing runtime widget factory lookup.
 *
 * @packageDocumentation
 */

/** Factory ID for diagram widgets (GLSP) */
export const DIAGRAM_WIDGET_FACTORY_ID = Symbol.for('sanyam-diagram-widget');

/** Factory ID for composite editor widgets */
export const COMPOSITE_EDITOR_WIDGET_FACTORY_ID = Symbol.for('sanyam-composite-editor');

/** Factory ID for form/property widgets (future) */
export const FORM_WIDGET_FACTORY_ID = Symbol.for('sanyam-form-widget');

/**
 * String-based factory ID for diagram widgets.
 * Used for WidgetFactory registration which requires strings.
 */
export const DIAGRAM_WIDGET_FACTORY_ID_STRING = 'sanyam-diagram-widget';

/**
 * String-based factory ID for composite editor widgets.
 * Used for WidgetFactory registration which requires strings.
 */
export const COMPOSITE_EDITOR_WIDGET_FACTORY_ID_STRING = 'sanyam-composite-editor';

/**
 * String-based factory ID for form widgets.
 * Used for WidgetFactory registration which requires strings.
 */
export const FORM_WIDGET_FACTORY_ID_STRING = 'sanyam-form-widget';
