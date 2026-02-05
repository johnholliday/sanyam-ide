/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Canvas Double-Click Tool
 *
 * Mouse listener that detects double-clicks on empty canvas areas
 * and shows the quick menu for rapid element creation.
 *
 * @packageDocumentation
 */

import { injectable } from 'inversify';
import { SModelElementImpl, findParentByFeature, isSelectable } from 'sprotty';
import { Action, Point } from 'sprotty-protocol';
import { MouseListener } from 'sprotty';
import { createLogger } from '@sanyam/logger';
import { ShowQuickMenuAction } from './quick-menu-actions';

/**
 * Symbol for CanvasDoubleClickTool injection.
 */
export const CanvasDoubleClickToolSymbol = Symbol('CanvasDoubleClickTool');

/**
 * Canvas Double-Click Tool.
 *
 * Listens for double-click events on the diagram canvas.
 * When a double-click occurs on empty space (the graph root),
 * it dispatches a ShowQuickMenuAction to open the quick menu.
 *
 * Double-clicks on existing elements are not handled here - they
 * typically trigger inline edit mode handled by other tools.
 */
@injectable()
export class CanvasDoubleClickTool extends MouseListener {
    protected readonly logger = createLogger({ name: 'CanvasDoubleClick' });

    /**
     * Handle double-click events.
     *
     * @param target - The element under the click
     * @param event - The mouse event
     * @returns Actions to dispatch (ShowQuickMenuAction if clicked on empty canvas)
     */
    override doubleClick(target: SModelElementImpl, event: MouseEvent): Action[] {
        // Only handle if clicked on empty canvas (graph root or diagram element)
        // not on a selectable element like a node
        if (this.isEmptyCanvasClick(target)) {
            const modelPosition = this.getModelPosition(target, event);
            const screenPosition: Point = { x: event.clientX, y: event.clientY };

            this.logger.info({ modelPosition, screenPosition }, 'Double-click on empty canvas');

            return [ShowQuickMenuAction.create(modelPosition, screenPosition)];
        }

        // Double-click on element - don't handle, let other tools process
        return [];
    }

    /**
     * Check if the click target is empty canvas space.
     *
     * @param target - The clicked element
     * @returns True if the click is on empty canvas (graph root)
     */
    protected isEmptyCanvasClick(target: SModelElementImpl): boolean {
        // If target is the root, it's empty canvas
        if (target.root === target) {
            return true;
        }

        // If target has no selectable parent, it's effectively empty canvas
        const selectableParent = findParentByFeature(target, isSelectable);
        if (!selectableParent || selectableParent.id === target.root.id) {
            return true;
        }

        return false;
    }

    /**
     * Convert screen coordinates to model coordinates.
     *
     * @param target - The target element (used to access the root model)
     * @param event - The mouse event with screen coordinates
     * @returns Model coordinates
     */
    protected getModelPosition(target: SModelElementImpl, event: MouseEvent): Point {
        // Find the SVG element for coordinate transformation
        const svgElement = document.querySelector(`svg#${target.root.id}`) as SVGSVGElement | null;
        if (!svgElement) {
            // Fallback: return screen coordinates if SVG not found
            this.logger.warn('SVG element not found, using screen coordinates');
            return { x: event.clientX, y: event.clientY };
        }

        // Create SVG point and transform to model coordinates
        const point = svgElement.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;

        const ctm = svgElement.getScreenCTM();
        if (!ctm) {
            this.logger.warn('Could not get screen CTM');
            return { x: event.clientX, y: event.clientY };
        }

        const svgPoint = point.matrixTransform(ctm.inverse());
        return { x: svgPoint.x, y: svgPoint.y };
    }
}
