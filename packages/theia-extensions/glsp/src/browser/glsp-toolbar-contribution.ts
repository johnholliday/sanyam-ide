/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * GLSP Diagram Toolbar Contribution
 *
 * Adds toolbar buttons to the diagram editor title bar for common operations.
 *
 * @packageDocumentation
 */

import { injectable, inject } from 'inversify';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { Widget } from '@theia/core/lib/browser';
import { CommandRegistry } from '@theia/core/lib/common';
import { DiagramWidget } from './diagram-widget';
import { DiagramCommands } from './glsp-commands';

/**
 * Toolbar contribution for diagram widgets.
 * Adds buttons for zoom, layout, minimap, and refresh operations.
 */
@injectable()
export class GlspDiagramToolbarContribution implements TabBarToolbarContribution {
    @inject(CommandRegistry)
    protected readonly commandRegistry: CommandRegistry;

    /**
     * Register toolbar items.
     */
    registerToolbarItems(registry: TabBarToolbarRegistry): void {
        // isVisible checks if the widget is a diagram widget or composite showing diagram
        const isVisible = (widget: Widget | undefined) => this.isDiagramWidgetOrComposite(widget);

        // Zoom In
        registry.registerItem({
            id: 'sanyam.diagram.toolbar.zoomIn',
            command: DiagramCommands.ZOOM_IN.id,
            tooltip: 'Zoom In',
            icon: 'codicon codicon-zoom-in',
            priority: 100,
            isVisible,
        });

        // Zoom Out
        registry.registerItem({
            id: 'sanyam.diagram.toolbar.zoomOut',
            command: DiagramCommands.ZOOM_OUT.id,
            tooltip: 'Zoom Out',
            icon: 'codicon codicon-zoom-out',
            priority: 101,
            isVisible,
        });

        // Zoom to Fit
        registry.registerItem({
            id: 'sanyam.diagram.toolbar.zoomToFit',
            command: DiagramCommands.ZOOM_TO_FIT.id,
            tooltip: 'Fit to Screen',
            icon: 'codicon codicon-screen-full',
            priority: 102,
            isVisible,
        });

        // Center View
        registry.registerItem({
            id: 'sanyam.diagram.toolbar.center',
            command: DiagramCommands.CENTER_VIEW.id,
            tooltip: 'Center View',
            icon: 'codicon codicon-target',
            priority: 103,
            isVisible,
        });

        // Auto-Layout
        registry.registerItem({
            id: 'sanyam.diagram.toolbar.layout',
            command: DiagramCommands.LAYOUT_DIAGRAM.id,
            tooltip: 'Auto-Layout',
            icon: 'codicon codicon-layout',
            priority: 110,
            isVisible,
        });

        // Toggle Minimap
        registry.registerItem({
            id: 'sanyam.diagram.toolbar.minimap',
            command: DiagramCommands.TOGGLE_MINIMAP.id,
            tooltip: 'Toggle Minimap',
            icon: 'codicon codicon-map',
            priority: 120,
            isVisible,
        });

        // Refresh
        registry.registerItem({
            id: 'sanyam.diagram.toolbar.refresh',
            command: DiagramCommands.REFRESH_DIAGRAM.id,
            tooltip: 'Refresh Diagram',
            icon: 'codicon codicon-refresh',
            priority: 130,
            isVisible,
        });

        // Export SVG
        registry.registerItem({
            id: 'sanyam.diagram.toolbar.exportSvg',
            command: DiagramCommands.EXPORT_SVG.id,
            tooltip: 'Export as SVG',
            icon: 'codicon codicon-file-media',
            priority: 140,
            isVisible,
        });

        // Edge Routing: Orthogonal
        registry.registerItem({
            id: 'sanyam.diagram.toolbar.edgeRouteOrthogonal',
            command: DiagramCommands.EDGE_ROUTING_ORTHOGONAL.id,
            tooltip: 'Orthogonal Edge Routing',
            icon: 'codicon codicon-type-hierarchy',
            priority: 116,
            isVisible,
        });

        // Edge Routing: Straight
        registry.registerItem({
            id: 'sanyam.diagram.toolbar.edgeRouteStraight',
            command: DiagramCommands.EDGE_ROUTING_STRAIGHT.id,
            tooltip: 'Straight Edge Routing',
            icon: 'codicon codicon-type-hierarchy-sub',
            priority: 117,
            isVisible,
        });

        // Edge Routing: Bezier
        registry.registerItem({
            id: 'sanyam.diagram.toolbar.edgeRouteBezier',
            command: DiagramCommands.EDGE_ROUTING_BEZIER.id,
            tooltip: 'Bezier Edge Routing',
            icon: 'codicon codicon-git-compare',
            priority: 118,
            isVisible,
        });

    }

    /**
     * Check if the widget is a standalone diagram widget (not embedded in composite editor).
     * FR-007: Toolbar items are removed from the composite editor's tab bar area
     * since the diagram now has its own embedded toolbar.
     */
    protected isDiagramWidgetOrComposite(widget: Widget | undefined): boolean {
        if (widget instanceof DiagramWidget) {
            // Only show tab bar toolbar for standalone diagram widgets
            return true;
        }
        // FR-007: Do NOT show tab bar toolbar for composite editors —
        // the embedded toolbar within the diagram view handles these controls.
        return false;
    }
}
