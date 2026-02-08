/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { injectable, inject } from '@theia/core/shared/inversify';
import {
    CommandContribution,
    CommandRegistry,
    Command,
    MenuContribution,
    MenuModelRegistry,
} from '@theia/core/lib/common';
import {
    FrontendApplicationContribution,
    KeybindingContribution,
    KeybindingRegistry,
    ApplicationShell,
} from '@theia/core/lib/browser';
import { EditorManager, EditorWidget } from '@theia/editor/lib/browser';
import { createLogger } from '@sanyam/logger';
import { CompositeEditorWidget } from './composite-editor-widget';
import { CompositeEditorOpenHandler } from './composite-editor-open-handler';

export namespace CompositeEditorCommands {
    const COMPOSITE_EDITOR_CATEGORY = 'Composite Editor';

    export const SHOW_TEXT_VIEW: Command = {
        id: 'sanyam.compositeEditor.showText',
        label: 'Show Text View',
        category: COMPOSITE_EDITOR_CATEGORY,
    };

    export const SHOW_DIAGRAM_VIEW: Command = {
        id: 'sanyam.compositeEditor.showDiagram',
        label: 'Show Diagram View',
        category: COMPOSITE_EDITOR_CATEGORY,
    };

    export const TOGGLE_VIEW: Command = {
        id: 'sanyam.compositeEditor.toggleView',
        label: 'Toggle Text/Diagram View',
        category: COMPOSITE_EDITOR_CATEGORY,
    };

    export const OPEN_AS_TEXT: Command = {
        id: 'sanyam.editor.openAsText',
        label: 'Open as Text Editor',
        category: COMPOSITE_EDITOR_CATEGORY,
    };
}

@injectable()
export class CompositeEditorContribution
    implements CommandContribution, KeybindingContribution, MenuContribution, FrontendApplicationContribution {

    protected readonly logger = createLogger({ name: 'CompositeEditorContribution' });

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    @inject(CompositeEditorOpenHandler)
    protected readonly openHandler: CompositeEditorOpenHandler;

    /**
     * On application start, check if any grammar files were restored as plain
     * text editors (because the GrammarRegistry was not yet initialized during
     * widget restoration). If so, close them and reopen via the composite editor.
     */
    async onStart(): Promise<void> {
        // Wait a short delay to ensure all widget restoration is complete
        await new Promise(resolve => setTimeout(resolve, 500));

        const allWidgets = this.shell.widgets;
        for (const widget of allWidgets) {
            if (!(widget instanceof EditorWidget)) {
                continue;
            }
            // Skip if already a composite editor (embedded text editor has a different class)
            if (widget instanceof CompositeEditorWidget) {
                continue;
            }
            const uri = widget.getResourceUri();
            if (!uri) {
                continue;
            }
            // Check if the composite editor can handle this URI
            const canHandle = this.openHandler.canHandle(uri);
            if (canHandle <= 0) {
                continue;
            }
            // This file should be in a composite editor but was opened as plain text
            this.logger.info({ uri: uri.toString() }, 'Reopening grammar file in composite editor');
            try {
                widget.close();
                await this.openHandler.open(uri, { mode: 'activate' });
            } catch (error) {
                this.logger.error({ error, uri: uri.toString() }, 'Failed to reopen grammar file in composite editor');
            }
        }
    }

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(CompositeEditorCommands.SHOW_TEXT_VIEW, {
            isEnabled: () => this.getActiveCompositeEditor() !== undefined,
            isVisible: () => this.getActiveCompositeEditor() !== undefined,
            execute: () => {
                const editor = this.getActiveCompositeEditor();
                if (editor) {
                    editor.switchView('text');
                }
            },
        });

        registry.registerCommand(CompositeEditorCommands.SHOW_DIAGRAM_VIEW, {
            isEnabled: () => {
                const editor = this.getActiveCompositeEditor();
                return editor !== undefined && editor.manifest.diagrammingEnabled;
            },
            isVisible: () => {
                const editor = this.getActiveCompositeEditor();
                return editor !== undefined && editor.manifest.diagrammingEnabled;
            },
            execute: () => {
                const editor = this.getActiveCompositeEditor();
                if (editor) {
                    editor.switchView('diagram');
                }
            },
        });

        registry.registerCommand(CompositeEditorCommands.TOGGLE_VIEW, {
            isEnabled: () => {
                const editor = this.getActiveCompositeEditor();
                return editor !== undefined && editor.manifest.diagrammingEnabled;
            },
            isVisible: () => {
                const editor = this.getActiveCompositeEditor();
                return editor !== undefined && editor.manifest.diagrammingEnabled;
            },
            execute: () => {
                const editor = this.getActiveCompositeEditor();
                if (editor) {
                    const newView = editor.activeView === 'text' ? 'diagram' : 'text';
                    editor.switchView(newView);
                }
            },
        });

        registry.registerCommand(CompositeEditorCommands.OPEN_AS_TEXT, {
            isEnabled: () => this.getActiveCompositeEditor() !== undefined,
            isVisible: () => this.getActiveCompositeEditor() !== undefined,
            execute: async () => {
                const editor = this.getActiveCompositeEditor();
                if (editor) {
                    const uri = editor.uri;
                    await this.editorManager.open(uri, { mode: 'activate' });
                }
            },
        });
    }

    registerKeybindings(registry: KeybindingRegistry): void {
        registry.registerKeybinding({
            command: CompositeEditorCommands.SHOW_TEXT_VIEW.id,
            keybinding: 'ctrlcmd+shift+1',
            when: 'sanyam.compositeEditor.active',
        });

        registry.registerKeybinding({
            command: CompositeEditorCommands.SHOW_DIAGRAM_VIEW.id,
            keybinding: 'ctrlcmd+shift+2',
            when: 'sanyam.compositeEditor.active && sanyam.compositeEditor.diagrammingEnabled',
        });

        registry.registerKeybinding({
            command: CompositeEditorCommands.TOGGLE_VIEW.id,
            keybinding: 'ctrlcmd+shift+`',
            when: 'sanyam.compositeEditor.active && sanyam.compositeEditor.diagrammingEnabled',
        });
    }

    registerMenus(registry: MenuModelRegistry): void {
        // View menu - composite editor submenu
        const COMPOSITE_EDITOR_VIEW_MENU = ['menubar', 'view', 'composite-editor'];

        registry.registerSubmenu(COMPOSITE_EDITOR_VIEW_MENU, 'Editor View');

        registry.registerMenuAction(COMPOSITE_EDITOR_VIEW_MENU, {
            commandId: CompositeEditorCommands.SHOW_TEXT_VIEW.id,
            label: 'Show Text View',
            order: '1',
        });

        registry.registerMenuAction(COMPOSITE_EDITOR_VIEW_MENU, {
            commandId: CompositeEditorCommands.SHOW_DIAGRAM_VIEW.id,
            label: 'Show Diagram View',
            order: '2',
        });

        registry.registerMenuAction(COMPOSITE_EDITOR_VIEW_MENU, {
            commandId: CompositeEditorCommands.OPEN_AS_TEXT.id,
            label: 'Open in Plain Text Editor',
            order: '3',
        });
    }

    protected getActiveCompositeEditor(): CompositeEditorWidget | undefined {
        const activeWidget = this.shell.activeWidget;
        if (activeWidget instanceof CompositeEditorWidget) {
            return activeWidget;
        }
        return undefined;
    }
}
