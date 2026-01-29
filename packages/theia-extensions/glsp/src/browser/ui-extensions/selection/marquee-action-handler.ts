/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Marquee Selection Action Handler
 *
 * Handles marquee selection actions.
 *
 * @packageDocumentation
 */

import { createLogger } from '@sanyam/logger';
import { injectable, inject, optional } from 'inversify';
import { IActionHandler, ICommand } from 'sprotty';
import { Action } from 'sprotty-protocol';
import {
    MarqueeSelectionTool,
    EnableMarqueeSelectAction,
    MARQUEE_SELECTION_ID,
} from './marquee-selection-tool';
import { UI_EXTENSION_REGISTRY, UIExtensionRegistry } from '../base-ui-extension';

/**
 * Action handler for marquee selection operations.
 */
@injectable()
export class MarqueeSelectionActionHandler implements IActionHandler {
    protected readonly logger = createLogger({ name: 'MarqueeActions' });

    @inject(UI_EXTENSION_REGISTRY) @optional()
    protected readonly uiExtensionRegistry?: UIExtensionRegistry;

    /**
     * Handle marquee selection actions.
     */
    handle(action: Action): void | ICommand | Action {
        switch (action.kind) {
            case EnableMarqueeSelectAction.KIND:
                this.handleEnableMarqueeSelect();
                break;
        }
    }

    /**
     * Get the marquee selection tool.
     */
    protected getMarqueeSelectionTool(): MarqueeSelectionTool | undefined {
        if (this.uiExtensionRegistry) {
            return this.uiExtensionRegistry.get(MARQUEE_SELECTION_ID) as MarqueeSelectionTool | undefined;
        }
        return undefined;
    }

    /**
     * Handle enable marquee select action.
     */
    protected handleEnableMarqueeSelect(): void {
        const tool = this.getMarqueeSelectionTool();
        if (tool) {
            this.logger.info('Enabling marquee selection mode');
            // Ensure the tool has a parent container before enabling
            if (!tool['parentContainerElement']) {
                // Try to find the diagram container
                const diagramContainer = document.querySelector('.sprotty-graph')?.parentElement?.parentElement;
                if (diagramContainer instanceof HTMLElement) {
                    this.logger.info('Setting parent container from DOM');
                    tool.setParentContainer(diagramContainer);
                }
            }
            tool.enableMarqueeMode();
        } else {
            this.logger.warn('Marquee selection tool not found in registry');
            // List what's in the registry for debugging
            if (this.uiExtensionRegistry) {
                this.logger.warn({ registryContents: this.uiExtensionRegistry.getAll().map(e => e.id()) }, 'Registry contents');
            }
        }
    }
}
