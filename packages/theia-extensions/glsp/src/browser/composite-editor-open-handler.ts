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
} from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { GrammarRegistry } from '@sanyam-ide/product/lib/browser/grammar-registry';
import {
    CompositeEditorWidget,
    COMPOSITE_EDITOR_WIDGET_FACTORY_ID,
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

    /**
     * Return a serializable URI string for WidgetManager to store and restore.
     *
     * During layout persistence, WidgetManager saves this value via
     * `getDescription()`. On restart, it passes this same string back to the
     * WidgetFactory's `createWidget()`, which reconstructs the full
     * `CompositeEditorWidget.Options` (including the manifest) from the URI.
     */
    protected createWidgetOptions(uri: URI, _options?: WidgetOpenerOptions): string {
        return uri.withoutFragment().toString();
    }
}
