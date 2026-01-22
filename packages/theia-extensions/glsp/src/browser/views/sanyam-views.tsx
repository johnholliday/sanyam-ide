/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Custom Sprotty Views for Sanyam Diagrams
 *
 * This module provides custom view implementations for Sanyam diagram elements.
 * For now, we use the default Sprotty views configured in sprotty-di-config.ts.
 *
 * Custom views can be added here when needed for specialized rendering.
 *
 * @packageDocumentation
 */

import { SanyamNode, SanyamEdge, SanyamLabel, SanyamCompartment } from '../di/sprotty-di-config';

/**
 * Re-export model types for convenience.
 */
export { SanyamNode, SanyamEdge, SanyamLabel, SanyamCompartment };

/**
 * View type identifiers.
 */
export const SanyamViewTypes = {
    NODE: 'SanyamNodeView',
    EDGE: 'SanyamEdgeView',
    LABEL: 'SanyamLabelView',
    COMPARTMENT: 'SanyamCompartmentView',
} as const;
