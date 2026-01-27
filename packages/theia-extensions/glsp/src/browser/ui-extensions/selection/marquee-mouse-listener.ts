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

import { injectable, inject, optional } from 'inversify';
import { MouseListener, SModelElementImpl, SModelRootImpl, TYPES, IActionDispatcher } from 'sprotty';
import { Action } from 'sprotty-protocol';
import { MarqueeSelectionTool, MARQUEE_SELECTION_ID, EnableMarqueeSelectAction } from './marquee-selection-tool';
import { UI_EXTENSION_REGISTRY, UIExtensionRegistry } from '../base-ui-extension';

/**
 * Mouse listener that enables marquee selection when Ctrl+drag is detected on the canvas.
 */
@injectable()
export class MarqueeMouseListener extends MouseListener {
    @inject(UI_EXTENSION_REGISTRY) @optional()
    protected readonly registry?: UIExtensionRegistry;

    @inject(TYPES.IActionDispatcher)
    protected actionDispatcher!: IActionDispatcher;

    /** Track if we started a potential marquee selection */
    protected ctrlMouseDownOnCanvas: boolean = false;

    /**
     * Handle mouse down event.
     * If Ctrl is pressed and target is the root (canvas), start marquee selection.
     */
    override mouseDown(target: SModelElementImpl, event: MouseEvent): (Action | Promise<Action>)[] {
        debugger; // TRACE: Is mouseDown being called?
        // Check if Ctrl (or Cmd on Mac) is pressed and we're clicking on the canvas (root)
        const isCtrlPressed = event.ctrlKey || event.metaKey;
        console.log('[MarqueeMouseListener] mouseDown', { isCtrlPressed, isRoot: target instanceof SModelRootImpl, targetType: target.type });

        if (isCtrlPressed && target instanceof SModelRootImpl) {
            console.log('[MarqueeMouseListener] Ctrl+click detected on canvas, enabling marquee mode');
            this.ctrlMouseDownOnCanvas = true;

            // Dispatch enable marquee select action
            this.actionDispatcher.dispatch(EnableMarqueeSelectAction.create());

            // Also directly start selection if we have access to the tool
            const tool = this.getMarqueeSelectionTool();
            if (tool) {
                // Get position relative to the diagram container
                const position = { x: event.offsetX, y: event.offsetY };

                // Determine selection mode from modifiers
                let mode: 'replace' | 'add' | 'remove' | 'toggle' = 'add'; // Ctrl+drag defaults to add
                if (event.altKey) mode = 'remove';
                if (event.shiftKey) mode = 'toggle';

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
                // Get position relative to the diagram container
                const position = { x: event.offsetX, y: event.offsetY };
                tool.updateSelection(position);
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
            if (tool && tool.isSelectionActive()) {
                tool.completeSelection();
            }
            this.ctrlMouseDownOnCanvas = false;
            return [];
        }
        return super.mouseUp(target, event);
    }
}
