/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Marquee Selection Mouse Listener
 *
 * Detects Ctrl+drag on the diagram canvas and enables marquee selection mode.
 *
 * @packageDocumentation
 */

import { createLogger } from '@sanyam/logger';
import { inject, injectable, optional } from 'inversify';
import { MouseListener, SModelElementImpl, SModelRootImpl } from 'sprotty';
import { Action } from 'sprotty-protocol';
import { MarqueeSelectionTool, MARQUEE_SELECTION_ID } from './marquee-selection-tool';
import { UI_EXTENSION_REGISTRY, UIExtensionRegistry } from '../base-ui-extension';
import { SanyamScrollMouseListener } from '../../di/sanyam-scroll-mouse-listener';
import { FitDiagramAction } from '../viewport/viewport-action-handler';

/**
 * Mouse listener that enables marquee selection when Ctrl+drag is detected on the canvas.
 */
@injectable()
export class MarqueeMouseListener extends MouseListener {
    protected readonly logger = createLogger({ name: 'MarqueeListener' });

    @inject(UI_EXTENSION_REGISTRY) @optional()
    protected readonly registry?: UIExtensionRegistry;

    @inject(SanyamScrollMouseListener) @optional()
    protected readonly scrollListener?: SanyamScrollMouseListener;

    /** Track if we started a potential marquee selection */
    protected ctrlMouseDownOnCanvas: boolean = false;

    /** Track if Ctrl+Shift was held (fit-to-screen after selection) */
    protected fitAfterSelect: boolean = false;

    /**
     * Handle mouse down event.
     * If Ctrl is pressed and target is the root (canvas), start marquee selection.
     */
    override mouseDown(target: SModelElementImpl, event: MouseEvent): (Action | Promise<Action>)[] {
        // Check if Ctrl (or Cmd on Mac) is pressed and we're clicking on the canvas (root)
        const isCtrlPressed = event.ctrlKey || event.metaKey;
        this.logger.debug({ isCtrlPressed, isRoot: target instanceof SModelRootImpl, targetType: target.type }, 'mouseDown');

        if (isCtrlPressed && target instanceof SModelRootImpl) {
            this.logger.debug('Ctrl+click detected on canvas, enabling marquee mode');
            this.ctrlMouseDownOnCanvas = true;

            // Prevent ScrollMouseListener from capturing lastScrollPosition
            if (this.scrollListener) {
                this.scrollListener.preventScrolling = true;
            }

            const tool = this.getMarqueeSelectionTool();
            if (tool) {
                const position = this.getPositionFromEvent(event);

                // Determine selection mode from modifiers
                // Ctrl+Drag = replace selection with marquee contents
                // Ctrl+Alt+Drag = remove from selection
                // Ctrl+Shift+Drag = replace selection + fit to screen
                let mode: 'replace' | 'add' | 'remove' | 'toggle' = 'replace';
                if (event.altKey) mode = 'remove';
                if (event.shiftKey) {
                    this.fitAfterSelect = true;
                } else {
                    this.fitAfterSelect = false;
                }

                tool.show();
                tool.startSelection(position, mode);
            }

            // Prevent default panning behavior
            event.preventDefault();
            event.stopPropagation();
            return [];
        }

        this.ctrlMouseDownOnCanvas = false;
        return super.mouseDown(target, event);
    }

    /**
     * Get the MarqueeSelectionTool instance.
     */
    protected getMarqueeSelectionTool(): MarqueeSelectionTool | undefined {
        if (this.registry) {
            const extension = this.registry.get(MARQUEE_SELECTION_ID);
            if (extension instanceof MarqueeSelectionTool) {
                return extension;
            }
        }
        return undefined;
    }

    /**
     * Handle mouse move event.
     */
    override mouseMove(target: SModelElementImpl, event: MouseEvent): (Action | Promise<Action>)[] {
        if (this.ctrlMouseDownOnCanvas) {
            const tool = this.getMarqueeSelectionTool();
            if (tool && tool.isSelectionActive()) {
                const position = this.getPositionFromEvent(event);
                tool.updateSelection(position);
                event.preventDefault();
                event.stopPropagation();
                return [];
            }
        }
        return super.mouseMove(target, event);
    }

    /**
     * Handle mouse up event.
     */
    override mouseUp(target: SModelElementImpl, event: MouseEvent): (Action | Promise<Action>)[] {
        if (this.ctrlMouseDownOnCanvas) {
            const tool = this.getMarqueeSelectionTool();
            let selectedIds: string[] = [];
            if (tool && tool.isSelectionActive()) {
                selectedIds = tool.completeSelection();
            }
            if (tool) {
                tool.cancelSelection();
                tool.hide();
            }

            const shouldFit = this.fitAfterSelect && selectedIds.length > 0;
            this.fitAfterSelect = false;
            this.ctrlMouseDownOnCanvas = false;

            // Re-enable scrolling
            if (this.scrollListener) {
                this.scrollListener.preventScrolling = false;
            }

            event.preventDefault();
            event.stopPropagation();

            // Ctrl+Shift+Drag: fit to screen on the selected elements
            // Dispatch after a short delay to let the SelectAction from completeSelection()
            // propagate through the model first
            if (shouldFit) {
                const fitAction = FitDiagramAction.create(selectedIds);
                return [new Promise<Action>(resolve => setTimeout(() => resolve(fitAction), 50))];
            }
            return [];
        }
        return super.mouseUp(target, event);
    }

    /**
     * Get position relative to the parent container from client coordinates.
     */
    protected getPositionFromEvent(event: MouseEvent): { x: number; y: number } {
        const tool = this.getMarqueeSelectionTool();
        if (tool) {
            const parent = tool.getParentContainer();
            if (parent) {
                const rect = parent.getBoundingClientRect();
                return { x: event.clientX - rect.left, y: event.clientY - rect.top };
            }
        }
        return { x: event.clientX, y: event.clientY };
    }
}
