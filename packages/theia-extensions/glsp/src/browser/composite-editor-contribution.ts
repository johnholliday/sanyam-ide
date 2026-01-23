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
    KeybindingContribution,
    KeybindingRegistry,
    ApplicationShell,
} from '@theia/core/lib/browser';
import { EditorManager } from '@theia/editor/lib/browser';
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
    implements CommandContribution, KeybindingContribution, MenuContribution {

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    @inject(CompositeEditorOpenHandler)
    protected readonly openHandler: CompositeEditorOpenHandler;

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
