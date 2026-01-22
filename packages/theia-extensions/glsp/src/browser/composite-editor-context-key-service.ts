/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import {
    FrontendApplicationContribution,
    FrontendApplication,
    ApplicationShell,
} from '@theia/core/lib/browser';
import { ContextKeyService, ContextKey } from '@theia/core/lib/browser/context-key-service';
import { DisposableCollection } from '@theia/core/lib/common';
import { CompositeEditorWidget } from './composite-editor-widget';

@injectable()
export class CompositeEditorContextKeyService implements FrontendApplicationContribution {

    @inject(ContextKeyService)
    protected readonly contextKeyService: ContextKeyService;

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    protected compositeEditorActive: ContextKey<boolean>;
    protected diagrammingEnabled: ContextKey<boolean>;
    protected activeView: ContextKey<string>;

    protected readonly toDispose = new DisposableCollection();

    @postConstruct()
    protected init(): void {
        this.compositeEditorActive = this.contextKeyService.createKey<boolean>(
            'sanyam.compositeEditor.active',
            false
        );
        this.diagrammingEnabled = this.contextKeyService.createKey<boolean>(
            'sanyam.compositeEditor.diagrammingEnabled',
            false
        );
        this.activeView = this.contextKeyService.createKey<string>(
            'sanyam.compositeEditor.activeView',
            'text'
        );
    }

    onStart(app: FrontendApplication): void {
        this.toDispose.push(
            this.shell.onDidChangeActiveWidget(() => this.updateContextKeys())
        );

        this.toDispose.push(
            this.shell.onDidChangeCurrentWidget(() => this.updateContextKeys())
        );

        this.updateContextKeys();
    }

    protected updateContextKeys(): void {
        const activeWidget = this.shell.activeWidget;

        if (activeWidget instanceof CompositeEditorWidget) {
            this.compositeEditorActive.set(true);
            this.diagrammingEnabled.set(activeWidget.manifest.diagrammingEnabled);
            this.activeView.set(activeWidget.activeView);

            this.toDispose.push(
                activeWidget.onActiveViewChanged((view) => {
                    this.activeView.set(view);
                })
            );
        } else {
            this.compositeEditorActive.set(false);
            this.diagrammingEnabled.set(false);
            this.activeView.set('text');
        }
    }

    onStop(): void {
        this.toDispose.dispose();
    }
}
