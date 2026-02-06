/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Element Palette View Contribution
 *
 * Registers the Element Palette widget as a Theia sidebar view.
 *
 * @packageDocumentation
 */

import { injectable } from 'inversify';
import {
    AbstractViewContribution,
    FrontendApplicationContribution,
    FrontendApplication,
} from '@theia/core/lib/browser';
import { Command, CommandRegistry, MenuModelRegistry } from '@theia/core/lib/common';
import { ElementPaletteWidget, ELEMENT_PALETTE_WIDGET_ID } from './element-palette-widget';

/**
 * Command to toggle the Element Palette view.
 */
export namespace ElementPaletteCommands {
    export const TOGGLE: Command = {
        id: 'elementPalette:toggle',
        label: 'Tools',
        category: 'View',
    };
}

/**
 * Element Palette View Contribution.
 *
 * Registers the Element Palette as a sidebar view in Theia.
 */
@injectable()
export class ElementPaletteViewContribution
    extends AbstractViewContribution<ElementPaletteWidget>
    implements FrontendApplicationContribution
{
    constructor() {
        super({
            widgetId: ELEMENT_PALETTE_WIDGET_ID,
            widgetName: ElementPaletteWidget.LABEL,
            defaultWidgetOptions: {
                area: 'left',
                rank: 200, // After file explorer (100)
            },
            toggleCommandId: ElementPaletteCommands.TOGGLE.id,
        });
    }

    /**
     * Initialize on application start.
     */
    async initializeLayout(app: FrontendApplication): Promise<void> {
        // Widget will be opened on demand
    }

    /**
     * Register commands.
     */
    registerCommands(commands: CommandRegistry): void {
        super.registerCommands(commands);
        commands.registerCommand(ElementPaletteCommands.TOGGLE, {
            execute: () => this.toggleView(),
        });
    }

    /**
     * Register menus.
     */
    registerMenus(menus: MenuModelRegistry): void {
        super.registerMenus(menus);
        // View menu registration is handled by AbstractViewContribution
    }
}
