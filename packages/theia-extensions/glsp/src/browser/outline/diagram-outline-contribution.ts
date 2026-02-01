/**
 * Diagram Outline Contribution
 *
 * Publishes document symbols to the outline panel when a CompositeEditorWidget
 * is active. The built-in MonacoOutlineContribution only tracks editors managed
 * by EditorManager.currentEditor, which does not include embedded editors inside
 * composite widgets.
 *
 * This contribution watches for active widget changes on the ApplicationShell
 * and, when a CompositeEditorWidget is detected, fetches DocumentSymbol[] from
 * the language server via Monaco's ILanguageFeaturesService and publishes them
 * to OutlineViewService.
 *
 * @packageDocumentation
 */

import { injectable, inject, optional } from '@theia/core/shared/inversify';
import {
    FrontendApplicationContribution,
    FrontendApplication,
    ApplicationShell,
    Widget,
} from '@theia/core/lib/browser';
import { DisposableCollection, Disposable } from '@theia/core';
import { EditorManager } from '@theia/editor/lib/browser';
import { OutlineViewService } from '@theia/outline-view/lib/browser/outline-view-service';
import { OutlineSymbolInformationNode } from '@theia/outline-view/lib/browser/outline-view-widget';
import URI from '@theia/core/lib/common/uri';
import * as monaco from '@theia/monaco-editor-core';
import { ILanguageFeaturesService } from '@theia/monaco-editor-core/esm/vs/editor/common/services/languageFeatures';
import { StandaloneServices } from '@theia/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';
import { ITextModel } from '@theia/monaco-editor-core/esm/vs/editor/common/model';
import { IModelService } from '@theia/monaco-editor-core/esm/vs/editor/common/services/model';
import type { DocumentSymbol } from '@theia/monaco-editor-core/esm/vs/editor/common/languages';
import { createLogger } from '@sanyam/logger';
import type { Range } from '@theia/editor/lib/browser';

import { CompositeEditorWidget } from '../composite-editor-widget';
import { type OutlineSyncService, OutlineSyncServiceSymbol } from './outline-sync-types';

// =============================================================================
// Outline node types
// =============================================================================

/**
 * Minimal outline node with URI and range, shared by both DiagramOutlineNode
 * and MonacoOutlineSymbolInformationNode.
 */
interface OutlineNodeWithRange {
    uri: URI;
    range: Range;
}

// =============================================================================
// Extended outline node with navigation metadata
// =============================================================================

/**
 * Outline node enriched with URI, range, and symbol path for navigation
 * back to the text editor or diagram.
 */
export interface DiagramOutlineNode extends OutlineSymbolInformationNode {
    /** Document URI this symbol belongs to */
    uri: URI;
    /** Selection range (name location) — 0-based LSP coordinates */
    range: Range;
    /** Full range of the symbol (for containment checks) */
    fullRange: Range;
    /** Optional detail string (e.g. type signature) */
    detail?: string;
    /** Chain of ancestor symbol names for OutlineSyncService lookups */
    symbolPath: string[];
    /** Typed parent */
    parent: DiagramOutlineNode | undefined;
    /** Typed children */
    children: DiagramOutlineNode[];
}

export namespace DiagramOutlineNode {
    /** Type guard */
    export function is(node: unknown): node is DiagramOutlineNode {
        return OutlineSymbolInformationNode.is(node as never)
            && 'uri' in (node as object)
            && 'range' in (node as object)
            && 'symbolPath' in (node as object);
    }

    /** Insert node in sorted order by range start position */
    export function insert(nodes: DiagramOutlineNode[], node: DiagramOutlineNode): void {
        const index = nodes.findIndex(current => compare(node, current) < 0);
        if (index === -1) {
            nodes.push(node);
        } else {
            nodes.splice(index, 0, node);
        }
    }

    /** Compare two nodes by range position */
    export function compare(a: DiagramOutlineNode, b: DiagramOutlineNode): number {
        const startLine = a.range.start.line - b.range.start.line;
        if (startLine !== 0) { return startLine; }
        const startChar = a.range.start.character - b.range.start.character;
        if (startChar !== 0) { return startChar; }
        const endLine = b.range.end.line - a.range.end.line;
        if (endLine !== 0) { return endLine; }
        return b.range.end.character - a.range.end.character;
    }
}

// =============================================================================
// Contribution
// =============================================================================

/** Debounce delay for outline updates (ms). */
const OUTLINE_UPDATE_DEBOUNCE_MS = 200;

@injectable()
export class DiagramOutlineContribution implements FrontendApplicationContribution {

    protected readonly logger = createLogger({ name: 'DiagramOutline' });

    @inject(OutlineViewService) @optional()
    protected readonly outlineViewService: OutlineViewService | undefined;

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    @inject(OutlineSyncServiceSymbol) @optional()
    protected readonly outlineSyncService: OutlineSyncService | undefined;

    /** Disposables scoped to the currently tracked composite editor */
    protected readonly toDisposeOnWidget = new DisposableCollection();

    /** Currently tracked composite widget */
    protected currentComposite: CompositeEditorWidget | undefined;

    /** Whether a composite editor is currently being tracked. */
    get isTrackingComposite(): boolean {
        return this.currentComposite !== undefined;
    }

    /** Whether we can update (prevents cyclic outline→editor→outline) */
    protected canUpdate = true;

    /** Cancellation source for in-flight symbol requests */
    protected tokenSource = new monaco.CancellationTokenSource();

    /** Debounce timer handle */
    protected debounceTimer: ReturnType<typeof setTimeout> | undefined;

    /** Cached roots — invalidated on content change */
    protected cachedRoots: DiagramOutlineNode[] | undefined;

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    onStart(_app: FrontendApplication): void {
        this.logger.info('DiagramOutlineContribution started');

        // Track active widget changes
        this.shell.onDidChangeCurrentWidget(({ newValue }) => {
            this.handleActiveWidgetChanged(newValue ?? undefined);
        });

        // When MonacoOutlineContribution responds to currentEditor changes it
        // may publish [] because the composite's embedded editor is not tracked
        // as currentEditor.  Re-publish our symbols shortly afterwards.
        this.editorManager.onCurrentEditorChanged(() => {
            if (this.currentComposite) {
                this.scheduleUpdate();
            }
        });

        if (this.outlineViewService) {
            // Handle outline select (single-click) — navigate / sync
            this.outlineViewService.onDidSelect(node => {
                if (this.currentComposite && this.isOutlineNodeWithRange(node)) {
                    this.handleOutlineSelect(node as OutlineNodeWithRange);
                }
            });

            // Handle outline open (double-click) — open in text editor
            this.outlineViewService.onDidOpen(node => {
                if (this.currentComposite && this.isOutlineNodeWithRange(node)) {
                    this.handleOutlineOpen(node as OutlineNodeWithRange);
                }
            });
        } else {
            this.logger.warn('OutlineViewService not available — outline will not be published');
        }

        // If a composite widget is already active at start-up, handle it
        this.handleActiveWidgetChanged(this.shell.currentWidget ?? undefined);
    }

    // -------------------------------------------------------------------------
    // Active widget tracking
    // -------------------------------------------------------------------------

    protected handleActiveWidgetChanged(widget: Widget | undefined): void {
        if (widget instanceof CompositeEditorWidget) {
            if (widget === this.currentComposite) {
                return; // Already tracking
            }
            this.trackCompositeEditor(widget);
        } else if (this.currentComposite) {
            // Only release when the newly active widget is in the main area
            // (i.e. another editor). Side panels (outline, explorer, etc.)
            // should not cause the composite tracking to stop.
            if (widget && this.shell.getAreaFor(widget) === 'main') {
                this.releaseCompositeEditor();
            }
        }
    }

    protected trackCompositeEditor(composite: CompositeEditorWidget): void {
        this.releaseCompositeEditor();
        this.currentComposite = composite;

        // Re-publish when user switches between text / diagram tab
        this.toDisposeOnWidget.push(
            composite.onActiveViewChanged(() => this.scheduleUpdate())
        );

        // Track content changes on the underlying text model so the outline
        // refreshes as the user types.
        this.trackDocumentChanges(composite.uri);

        // Re-publish when the composite is disposed
        this.toDisposeOnWidget.push(
            Disposable.create(() => {
                if (this.currentComposite === composite) {
                    this.currentComposite = undefined;
                }
            })
        );
        composite.disposed.connect(() => this.releaseCompositeEditor());

        // Also re-publish when document symbol providers change
        this.toDisposeOnWidget.push(
            StandaloneServices.get(ILanguageFeaturesService)
                .documentSymbolProvider.onDidChange(() => {
                    if (this.currentComposite === composite) {
                        this.scheduleUpdate();
                    }
                })
        );

        // Initial publish
        this.scheduleUpdate();
    }

    /**
     * Subscribe to content changes on the Monaco text model so that the
     * outline refreshes when the user edits the document.
     */
    protected trackDocumentChanges(uri: URI): void {
        const model = this.getTextModel(uri);
        if (model) {
            this.toDisposeOnWidget.push(
                model.onDidChangeContent(() => {
                    this.cachedRoots = undefined;
                    this.scheduleUpdate();
                })
            );
            return;
        }
        // Text model not ready yet — retry after a delay
        const retryTimer = setTimeout(() => {
            if (this.currentComposite) {
                this.trackDocumentChanges(uri);
            }
        }, 500);
        this.toDisposeOnWidget.push(Disposable.create(() => clearTimeout(retryTimer)));
    }

    protected releaseCompositeEditor(): void {
        this.toDisposeOnWidget.dispose();
        this.currentComposite = undefined;
        this.cachedRoots = undefined;
        if (this.debounceTimer !== undefined) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = undefined;
        }
    }

    // -------------------------------------------------------------------------
    // Outline update
    // -------------------------------------------------------------------------

    protected scheduleUpdate(): void {
        if (this.debounceTimer !== undefined) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.debounceTimer = undefined;
            this.updateOutline().catch(err =>
                this.logger.error({ err }, 'Error updating outline')
            );
        }, OUTLINE_UPDATE_DEBOUNCE_MS);
    }

    /** Number of remaining retries when the text model is not yet available */
    protected modelRetries = 0;

    protected async updateOutline(): Promise<void> {
        if (!this.canUpdate || !this.currentComposite) {
            return;
        }

        // Cancel any in-flight request
        this.tokenSource.cancel();
        this.tokenSource = new monaco.CancellationTokenSource();
        const token = this.tokenSource.token;

        const uri = this.currentComposite.uri;

        // We need a Monaco ITextModel for the document. The embedded text
        // editor inside the composite editor should already have one.
        const model = this.getTextModel(uri);
        if (token.isCancellationRequested) {
            return;
        }
        if (!model) {
            // Text model may not be ready yet (composite editor creates it
            // asynchronously). Retry a few times before giving up.
            if (this.modelRetries < 5) {
                this.modelRetries++;
                this.logger.debug({ retries: this.modelRetries }, 'Text model not ready, retrying');
                this.scheduleUpdate();
            } else {
                this.outlineViewService?.publish([]);
            }
            return;
        }
        this.modelRetries = 0;

        const roots = await this.createRoots(uri, model, token);
        if (token.isCancellationRequested) {
            return;
        }

        this.outlineViewService?.publish(roots);
    }

    /**
     * Obtain the Monaco ITextModel for the given URI.
     *
     * Uses Monaco's IModelService directly to look up the text model by URI.
     * This avoids depending on EditorManager to track the embedded editor
     * inside the composite widget (which it may not, since the editor is
     * attached to the composite's internal DockPanel, not the shell).
     */
    protected getTextModel(uri: URI): ITextModel | undefined {
        try {
            const modelService = StandaloneServices.get(IModelService);
            const monacoUri = monaco.Uri.parse(uri.toString());
            return modelService.getModel(monacoUri) ?? undefined;
        } catch (err) {
            this.logger.debug({ err }, 'Failed to get text model from IModelService');
            return undefined;
        }
    }

    // -------------------------------------------------------------------------
    // Symbol → Node conversion
    // -------------------------------------------------------------------------

    protected async createRoots(
        uri: URI,
        model: ITextModel,
        token: monaco.CancellationToken,
    ): Promise<DiagramOutlineNode[]> {
        const roots: DiagramOutlineNode[] = [];
        const providers = StandaloneServices.get(ILanguageFeaturesService)
            .documentSymbolProvider.all(model);

        if (token.isCancellationRequested) {
            return [];
        }

        for (const provider of providers) {
            try {
                const symbols = await provider.provideDocumentSymbols(model, token) ?? [];
                if (token.isCancellationRequested) {
                    return [];
                }
                const ids = new Map<string, number>();
                for (const symbol of symbols as DocumentSymbol[]) {
                    DiagramOutlineNode.insert(
                        roots,
                        this.createNode(uri, symbol, ids, [], undefined),
                    );
                }
            } catch (err) {
                this.logger.error({ err }, 'Error collecting symbols from provider');
            }
        }

        return roots;
    }

    protected createNode(
        uri: URI,
        symbol: DocumentSymbol,
        ids: Map<string, number>,
        parentPath: string[],
        parent: DiagramOutlineNode | undefined,
    ): DiagramOutlineNode {
        const id = this.createId(symbol.name, ids);
        const symbolPath = [...parentPath, symbol.name];
        const children: DiagramOutlineNode[] = [];

        const node: DiagramOutlineNode = {
            children,
            id,
            iconClass: monaco.languages.SymbolKind[symbol.kind].toString().toLowerCase(),
            name: symbol.name,
            detail: symbol.detail || undefined,
            parent,
            uri,
            range: this.asRange(symbol.selectionRange),
            fullRange: this.asRange(symbol.range),
            symbolPath,
            selected: false,
            expanded: this.shouldExpand(symbol.kind),
        };

        if (symbol.children) {
            for (const child of symbol.children) {
                DiagramOutlineNode.insert(
                    children,
                    this.createNode(uri, child, ids, symbolPath, node),
                );
            }
        }

        return node;
    }

    /** Convert 1-based Monaco IRange to 0-based LSP Range. */
    protected asRange(range: monaco.IRange): Range {
        return {
            start: { line: range.startLineNumber - 1, character: range.startColumn - 1 },
            end: { line: range.endLineNumber - 1, character: range.endColumn - 1 },
        };
    }

    protected createId(name: string, ids: Map<string, number>): string {
        const counter = ids.get(name);
        const index = typeof counter === 'number' ? counter + 1 : 0;
        ids.set(name, index);
        return `diagram_${name}_${index}`;
    }

    protected shouldExpand(kind: number): boolean {
        return [
            monaco.languages.SymbolKind.Class,
            monaco.languages.SymbolKind.Enum,
            monaco.languages.SymbolKind.File,
            monaco.languages.SymbolKind.Interface,
            monaco.languages.SymbolKind.Module,
            monaco.languages.SymbolKind.Namespace,
            monaco.languages.SymbolKind.Object,
            monaco.languages.SymbolKind.Package,
            monaco.languages.SymbolKind.Struct,
        ].includes(kind as monaco.languages.SymbolKind);
    }

    // -------------------------------------------------------------------------
    // Outline event handlers
    // -------------------------------------------------------------------------

    /**
     * Check if an outline tree node has the uri and range properties needed for navigation.
     */
    protected isOutlineNodeWithRange(node: unknown): node is OutlineNodeWithRange {
        return !!node
            && typeof node === 'object'
            && 'uri' in node
            && 'range' in node;
    }

    protected async handleOutlineSelect(node: OutlineNodeWithRange): Promise<void> {
        if (!this.currentComposite) {
            return;
        }

        // Sync to diagram via OutlineSyncService (if available)
        if (this.outlineSyncService && DiagramOutlineNode.is(node)) {
            const elementId = this.outlineSyncService.lookupElement(
                node.uri.toString(),
                node.symbolPath,
            );
            if (elementId) {
                this.outlineSyncService.handleSelectionChange(
                    node.uri.toString(),
                    [elementId],
                    'outline',
                );
            }
        }

        // Reveal in the embedded text editor within the composite widget
        this.revealInEmbeddedEditor(node, false);
    }

    protected async handleOutlineOpen(node: OutlineNodeWithRange): Promise<void> {
        // Reveal and set cursor in the embedded text editor
        this.revealInEmbeddedEditor(node, true);
    }

    /**
     * Reveal a symbol range in the embedded Monaco editor inside the composite widget,
     * without opening a new editor tab.
     */
    protected revealInEmbeddedEditor(node: OutlineNodeWithRange, setCursor: boolean): void {
        if (!this.currentComposite) {
            return;
        }

        // Find the Monaco editor instance that has the matching URI
        const targetUri = node.uri.toString();
        const editors = monaco.editor.getEditors();
        const codeEditor = editors.find(e => {
            const model = e.getModel();
            return model && model.uri.toString() === targetUri;
        });

        if (!codeEditor) {
            return;
        }

        this.canUpdate = false;
        try {
            // Convert 0-based LSP range to 1-based Monaco range
            const monacoRange = new monaco.Range(
                node.range.start.line + 1,
                node.range.start.character + 1,
                node.range.end.line + 1,
                node.range.end.character + 1,
            );
            if (setCursor) {
                codeEditor.setSelection(monacoRange);
                codeEditor.revealRangeInCenter(monacoRange);
            } else {
                codeEditor.setSelection(monacoRange);
                codeEditor.revealRangeInCenterIfOutsideViewport(monacoRange);
            }

            // Activate the composite widget so it stays focused
            this.shell.activateWidget(this.currentComposite.id);
        } finally {
            this.canUpdate = true;
        }
    }
}
