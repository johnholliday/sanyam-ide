/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * UI Extensions Module
 *
 * Barrel export and container module for all Sprotty UI extensions.
 * Provides a complete set of professional graphical editing tools:
 * - Viewport actions for zoom/pan/fit
 * - Validation Markers for error/warning display
 * - Edit Label for inline text editing
 * - Command Palette for quick actions
 * - Edge Creation Preview
 * - Helper Lines for alignment
 * - Marquee Selection for multi-select
 * - Resize Handles for node resizing
 * - Popup/Tooltip for element info
 * - Mini-map for navigation
 *
 * @packageDocumentation
 */

import { ContainerModule, interfaces } from 'inversify';
import { configureActionHandler, TYPES } from 'sprotty';

// Base exports
export * from './base-ui-extension';

// Viewport (zoom, center, fit actions)
export * from './viewport';

// Validation
export * from './validation';

// Edit Label
export * from './edit-label';

// Command Palette
export * from './command-palette';

// Edge Creation
export * from './edge-creation';

// Helper Lines
export * from './helper-lines';

// Selection
export * from './selection';

// Resize
export * from './resize';

// Popup
export * from './popup';

// Minimap
export * from './minimap';

// Export
export * from './export';

// Snap to Grid
export * from './snap-to-grid';

// Quick Menu
export * from './quick-menu';

// Import specific classes for DI binding
import {
    UIExtensionRegistry,
    UI_EXTENSION_REGISTRY,
    DIAGRAM_CONTAINER_ID,
} from './base-ui-extension';

import {
    ViewportActionHandler,
    ZoomInAction,
    ZoomOutAction,
    ResetZoomAction,
    CenterDiagramAction,
    FitDiagramAction,
} from './viewport';

import {
    ValidationMarkersExtension,
    ValidationActionHandler,
    RequestValidationAction,
    SetMarkersAction,
    ClearMarkersAction,
    ValidationCompletedAction,
    NavigateToMarkerAction,
    ShowMarkerDetailsAction,
} from './validation';

import {
    SanyamEditLabelUI,
    ApplyLabelEditHandler,
    EditLabelAction,
    ApplyLabelEditAction,
    CancelLabelEditAction,
    ValidateLabelEditAction,
    EditLabelCompleteAction,
    LabelEditMouseListener,
} from './edit-label';

import {
    SanyamCommandPalette,
} from './command-palette';

import {
    EdgeCreationFeedbackExtension,
} from './edge-creation';

import {
    HelperLinesExtension,
} from './helper-lines';

import {
    MarqueeSelectionTool,
    MarqueeSelectionActionHandler,
    EnableMarqueeSelectAction,
    MarqueeMouseListener,
} from './selection';

import {
    ResizeHandlesExtension,
} from './resize';

import {
    SanyamPopupExtension,
} from './popup';

import {
    MinimapUIExtension,
    MinimapActionHandler,
    ToggleMinimapAction,
    SetViewportFromMinimapAction,
} from './minimap';

import {
    ExportSvgActionHandler,
    RequestExportSvgAction,
} from './export';

import {
    SnapGridTool,
    SnapGridActionHandler,
    ToggleSnapToGridActionKind,
    UpdateSnapGridConfigActionKind,
    ToggleGridVisibilityActionKind,
} from './snap-to-grid';

import {
    QuickMenuUIExtension,
    QuickMenuActionHandler,
    CanvasDoubleClickTool,
    ShowQuickMenuAction,
    HideQuickMenuAction,
    SelectQuickMenuItemAction,
} from './quick-menu';

/**
 * Options for creating the UI extensions module.
 */
export interface UIExtensionsModuleOptions {
    /** Diagram container element ID */
    diagramContainerId: string;
    /** Enable validation markers (default: true) */
    enableValidation?: boolean;
    /** Enable edit label (default: true) */
    enableEditLabel?: boolean;
    /** Enable command palette (default: true) */
    enableCommandPalette?: boolean;
    /** Enable edge creation feedback (default: true) */
    enableEdgeCreation?: boolean;
    /** Enable helper lines (default: true) */
    enableHelperLines?: boolean;
    /** Enable marquee selection (default: true) */
    enableMarqueeSelection?: boolean;
    /** Enable resize handles (default: true) */
    enableResizeHandles?: boolean;
    /** Enable popup/tooltip (default: true) */
    enablePopup?: boolean;
    /** Enable minimap (default: true) */
    enableMinimap?: boolean;
    /** Enable quick menu (default: true) */
    enableQuickMenu?: boolean;
    /** Existing SnapGridTool instance from parent container (to avoid creating duplicate) */
    snapGridTool?: SnapGridTool;
}

/**
 * Create the UI extensions container module.
 *
 * @param options - Module configuration options
 * @returns Inversify container module with UI extension bindings
 */
export function createUIExtensionsModule(options: UIExtensionsModuleOptions): ContainerModule {
    return new ContainerModule((bind, unbind, isBound, rebind) => {
        const context = { bind, unbind, isBound, rebind };

        // Bind diagram container ID
        bind(DIAGRAM_CONTAINER_ID).toConstantValue(options.diagramContainerId);

        // Bind UI Extension Registry
        bind(UIExtensionRegistry).toSelf().inSingletonScope();
        bind(UI_EXTENSION_REGISTRY).toService(UIExtensionRegistry);

        // Viewport actions (zoom, center, fit) - always enabled
        bind(ViewportActionHandler).toSelf().inSingletonScope();
        configureActionHandler(context, ZoomInAction.KIND, ViewportActionHandler);
        configureActionHandler(context, ZoomOutAction.KIND, ViewportActionHandler);
        configureActionHandler(context, ResetZoomAction.KIND, ViewportActionHandler);
        configureActionHandler(context, CenterDiagramAction.KIND, ViewportActionHandler);
        configureActionHandler(context, FitDiagramAction.KIND, ViewportActionHandler);

        // Validation Markers
        if (options.enableValidation !== false) {
            bind(ValidationMarkersExtension).toSelf().inSingletonScope();
            bind(ValidationActionHandler).toSelf().inSingletonScope();

            configureActionHandler(context, RequestValidationAction.KIND, ValidationActionHandler);
            configureActionHandler(context, SetMarkersAction.KIND, ValidationActionHandler);
            configureActionHandler(context, ClearMarkersAction.KIND, ValidationActionHandler);
            configureActionHandler(context, ValidationCompletedAction.KIND, ValidationActionHandler);
            configureActionHandler(context, NavigateToMarkerAction.KIND, ValidationActionHandler);
            configureActionHandler(context, ShowMarkerDetailsAction.KIND, ValidationActionHandler);
        }

        // Edit Label
        if (options.enableEditLabel !== false) {
            bind(SanyamEditLabelUI).toSelf().inSingletonScope();
            bind(ApplyLabelEditHandler).toSelf().inSingletonScope();

            configureActionHandler(context, EditLabelAction.KIND, ApplyLabelEditHandler);
            configureActionHandler(context, ApplyLabelEditAction.KIND, ApplyLabelEditHandler);
            configureActionHandler(context, CancelLabelEditAction.KIND, ApplyLabelEditHandler);
            configureActionHandler(context, ValidateLabelEditAction.KIND, ApplyLabelEditHandler);
            configureActionHandler(context, EditLabelCompleteAction.KIND, ApplyLabelEditHandler);

            // Label edit mouse listener for double-click handling
            bind(LabelEditMouseListener).toSelf().inSingletonScope();
            bind(TYPES.MouseListener).toService(LabelEditMouseListener);
        }

        // Command Palette
        if (options.enableCommandPalette !== false) {
            bind(SanyamCommandPalette).toSelf().inSingletonScope();
        }

        // Edge Creation Feedback
        if (options.enableEdgeCreation !== false) {
            bind(EdgeCreationFeedbackExtension).toSelf().inSingletonScope();
        }

        // Helper Lines
        if (options.enableHelperLines !== false) {
            bind(HelperLinesExtension).toSelf().inSingletonScope();
        }

        // Marquee Selection
        if (options.enableMarqueeSelection !== false) {
            bind(MarqueeSelectionTool).toSelf().inSingletonScope();
            bind(MarqueeSelectionActionHandler).toSelf().inSingletonScope();
            configureActionHandler(context, EnableMarqueeSelectAction.KIND, MarqueeSelectionActionHandler);

            // Mouse listener for Ctrl+drag marquee selection
            bind(MarqueeMouseListener).toSelf().inSingletonScope();
            bind(TYPES.MouseListener).toService(MarqueeMouseListener);
        }

        // Resize Handles
        if (options.enableResizeHandles !== false) {
            bind(ResizeHandlesExtension).toSelf().inSingletonScope();
        }

        // Popup
        if (options.enablePopup !== false) {
            bind(SanyamPopupExtension).toSelf().inSingletonScope();
        }

        // Minimap
        if (options.enableMinimap !== false) {
            bind(MinimapUIExtension).toSelf().inSingletonScope();
            bind(MinimapActionHandler).toSelf().inSingletonScope();
            configureActionHandler(context, ToggleMinimapAction.KIND, MinimapActionHandler);
            configureActionHandler(context, SetViewportFromMinimapAction.KIND, MinimapActionHandler);
        }

        // Export (always enabled - no UI extension, just action handler)
        bind(ExportSvgActionHandler).toSelf().inSingletonScope();
        configureActionHandler(context, RequestExportSvgAction.KIND, ExportSvgActionHandler);

        // Snap to Grid (always enabled)
        // Use existing instance from parent container if provided, otherwise create new
        if (options.snapGridTool) {
            bind(SnapGridTool).toConstantValue(options.snapGridTool);
        } else {
            bind(SnapGridTool).toSelf().inSingletonScope();
        }
        bind(SnapGridActionHandler).toSelf().inSingletonScope();
        configureActionHandler(context, ToggleSnapToGridActionKind, SnapGridActionHandler);
        configureActionHandler(context, UpdateSnapGridConfigActionKind, SnapGridActionHandler);
        configureActionHandler(context, ToggleGridVisibilityActionKind, SnapGridActionHandler);

        // Quick Menu
        if (options.enableQuickMenu !== false) {
            bind(QuickMenuUIExtension).toSelf().inSingletonScope();
            bind(QuickMenuActionHandler).toSelf().inSingletonScope();
            bind(CanvasDoubleClickTool).toSelf().inSingletonScope();
            bind(TYPES.MouseListener).toService(CanvasDoubleClickTool);

            configureActionHandler(context, ShowQuickMenuAction.KIND, QuickMenuActionHandler);
            configureActionHandler(context, HideQuickMenuAction.KIND, QuickMenuActionHandler);
            configureActionHandler(context, SelectQuickMenuItemAction.KIND, QuickMenuActionHandler);
        }
    });
}

/**
 * Initialize all UI extensions in a container.
 *
 * Call this after container creation to register extensions with the registry.
 *
 * @param container - The Inversify container
 * @param options - Module options used during creation
 */
export function initializeUIExtensions(
    container: interfaces.Container,
    options: UIExtensionsModuleOptions
): void {
    const registry = container.get<UIExtensionRegistry>(UI_EXTENSION_REGISTRY);

    if (options.enableValidation !== false && container.isBound(ValidationMarkersExtension)) {
        registry.register(container.get(ValidationMarkersExtension));
    }

    if (options.enableEditLabel !== false && container.isBound(SanyamEditLabelUI)) {
        registry.register(container.get(SanyamEditLabelUI));
    }

    if (options.enableCommandPalette !== false && container.isBound(SanyamCommandPalette)) {
        registry.register(container.get(SanyamCommandPalette));
    }

    if (options.enableEdgeCreation !== false && container.isBound(EdgeCreationFeedbackExtension)) {
        registry.register(container.get(EdgeCreationFeedbackExtension));
    }

    if (options.enableHelperLines !== false && container.isBound(HelperLinesExtension)) {
        registry.register(container.get(HelperLinesExtension));
    }

    if (options.enableMarqueeSelection !== false && container.isBound(MarqueeSelectionTool)) {
        registry.register(container.get(MarqueeSelectionTool));
    }

    if (options.enableResizeHandles !== false && container.isBound(ResizeHandlesExtension)) {
        registry.register(container.get(ResizeHandlesExtension));
    }

    if (options.enablePopup !== false && container.isBound(SanyamPopupExtension)) {
        registry.register(container.get(SanyamPopupExtension));
    }

    if (options.enableMinimap !== false && container.isBound(MinimapUIExtension)) {
        const minimap = container.get(MinimapUIExtension);
        registry.register(minimap);
        // Show minimap by default (it has showByDefault: true in config)
        minimap.show();
    }

    // Snap to Grid (always initialized)
    if (container.isBound(SnapGridTool)) {
        registry.register(container.get(SnapGridTool));
    }

    // Quick Menu
    if (options.enableQuickMenu !== false && container.isBound(QuickMenuUIExtension)) {
        registry.register(container.get(QuickMenuUIExtension));
    }
}

/**
 * Set parent container for all UI extensions.
 *
 * @param container - The Inversify container
 * @param parentElement - The parent HTML element for extensions
 * @param options - Module options used during creation
 */
export function setUIExtensionsParentContainer(
    container: interfaces.Container,
    parentElement: HTMLElement,
    options: UIExtensionsModuleOptions
): void {
    if (options.enableValidation !== false && container.isBound(ValidationMarkersExtension)) {
        container.get(ValidationMarkersExtension).setParentContainer(parentElement);
    }

    if (options.enableEditLabel !== false && container.isBound(SanyamEditLabelUI)) {
        container.get(SanyamEditLabelUI).setParentContainer(parentElement);
    }

    if (options.enableCommandPalette !== false && container.isBound(SanyamCommandPalette)) {
        container.get(SanyamCommandPalette).setParentContainer(parentElement);
    }

    if (options.enableEdgeCreation !== false && container.isBound(EdgeCreationFeedbackExtension)) {
        container.get(EdgeCreationFeedbackExtension).setParentContainer(parentElement);
    }

    if (options.enableHelperLines !== false && container.isBound(HelperLinesExtension)) {
        container.get(HelperLinesExtension).setParentContainer(parentElement);
    }

    if (options.enableMarqueeSelection !== false && container.isBound(MarqueeSelectionTool)) {
        container.get(MarqueeSelectionTool).setParentContainer(parentElement);
    }

    if (options.enableResizeHandles !== false && container.isBound(ResizeHandlesExtension)) {
        container.get(ResizeHandlesExtension).setParentContainer(parentElement);
    }

    if (options.enablePopup !== false && container.isBound(SanyamPopupExtension)) {
        container.get(SanyamPopupExtension).setParentContainer(parentElement);
    }

    if (options.enableMinimap !== false && container.isBound(MinimapUIExtension)) {
        container.get(MinimapUIExtension).setParentContainer(parentElement);
    }

    // Snap to Grid (always set parent)
    if (container.isBound(SnapGridTool)) {
        container.get(SnapGridTool).setParentContainer(parentElement);
    }

    // Quick Menu
    if (options.enableQuickMenu !== false && container.isBound(QuickMenuUIExtension)) {
        container.get(QuickMenuUIExtension).setParentContainer(parentElement);
    }
}
