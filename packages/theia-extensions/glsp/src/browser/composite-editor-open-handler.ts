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
    WidgetOpenHandler,
    WidgetOpenerOptions,
    ApplicationShell,
} from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { GrammarRegistry } from '@sanyam-ide/product/lib/browser/grammar-registry';
import {
    CompositeEditorWidget,
    COMPOSITE_EDITOR_WIDGET_FACTORY_ID,
    CompositeEditorWidgetFactory,
} from './composite-editor-widget';

export interface CompositeEditorOpenerOptions extends WidgetOpenerOptions {
    forceTextMode?: boolean;
}

@injectable()
export class CompositeEditorOpenHandler extends WidgetOpenHandler<CompositeEditorWidget> {
    readonly id = COMPOSITE_EDITOR_WIDGET_FACTORY_ID;
    readonly label = 'Composite Grammar Editor';

    @inject(GrammarRegistry)
    protected readonly grammarRegistry: GrammarRegistry;

    @inject(CompositeEditorWidgetFactory)
    protected readonly compositeEditorFactory: CompositeEditorWidgetFactory;

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    canHandle(uri: URI, options?: CompositeEditorOpenerOptions): number {
        if (options?.forceTextMode) {
            return 0;
        }

        const manifest = this.grammarRegistry.getManifestByFilePath(uri.path.toString());

        if (manifest && manifest.diagrammingEnabled) {
            return 200;
        }

        return 0;
    }

    protected createWidgetOptions(uri: URI, options?: WidgetOpenerOptions): CompositeEditorWidget.Options {
        const manifest = this.grammarRegistry.getManifestByFilePath(uri.path.toString());

        if (!manifest) {
            throw new Error(`No grammar manifest found for ${uri.toString()}`);
        }

        return { uri, manifest };
    }

    async open(uri: URI, options?: CompositeEditorOpenerOptions): Promise<CompositeEditorWidget> {
        const widget = await this.getOrCreateWidget(uri, options);
        await this.doOpen(widget, uri, options);
        return widget;
    }

    protected async getOrCreateWidget(uri: URI, options?: WidgetOpenerOptions): Promise<CompositeEditorWidget> {
        const widgetId = `${COMPOSITE_EDITOR_WIDGET_FACTORY_ID}:${uri.toString()}`;

        let widget = this.shell.widgets.find(w => w.id === widgetId) as CompositeEditorWidget | undefined;

        if (!widget) {
            const widgetOptions = this.createWidgetOptions(uri, options);
            widget = this.compositeEditorFactory.createWidget(widgetOptions);
        }

        return widget;
    }

    protected async doOpen(widget: CompositeEditorWidget, uri: URI, options?: WidgetOpenerOptions): Promise<void> {
        if (!widget.isAttached) {
            await this.shell.addWidget(widget, { area: 'main' });
        }

        if (options?.mode === 'reveal') {
            await this.shell.revealWidget(widget.id);
        } else {
            await this.shell.activateWidget(widget.id);
        }
    }
}
