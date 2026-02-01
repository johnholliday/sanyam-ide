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
import type { DocumentSymbol as LspDocumentSymbol } from 'vscode-languageserver-types';
import { createLogger } from '@sanyam/logger';
import type { Range } from '@theia/editor/lib/browser';

import { CompositeEditorWidget, type DiagramWidgetCapabilities } from '../composite-editor-widget';
import { type OutlineSyncService, type OutlineSelectionEvent, OutlineSyncServiceSymbol } from './outline-sync-types';
import { ElementSymbolMapper } from './element-symbol-mapper';

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

    @inject(ElementSymbolMapper) @optional()
    protected readonly symbolMapper: ElementSymbolMapper | undefined;

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

        // Disable the sync service's own text editor navigation — we handle
        // text reveal ourselves via revealInEmbeddedEditor, and the sync
        // service's editorManager.open() would open a separate editor tab.
        if (this.outlineSyncService) {
            this.outlineSyncService.setConfig({ syncOutlineToTextEditor: false });
        }

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

        // Wire up diagram ↔ outline selection sync
        this.wireDiagramOutlineSync(composite);

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

    /**
     * Wire up bidirectional selection sync between diagram and outline.
     * If the diagram widget isn't available yet, polls periodically until it is.
     */
    protected wireDiagramOutlineSync(composite: CompositeEditorWidget): void {
        if (!this.outlineSyncService || !this.symbolMapper) {
            return;
        }

        const diagramWidget = composite.getDiagramWidget();
        if (diagramWidget) {
            this.wireDiagramOutlineSyncForWidget(composite, diagramWidget);
            return;
        }

        // Diagram widget not created yet — poll until it appears.
        // We also hook onActiveViewChanged as a secondary trigger.
        const tryWire = (): void => {
            const dw = composite.getDiagramWidget();
            if (dw && !this.diagramSyncWired) {
                this.wireDiagramOutlineSyncForWidget(composite, dw);
                if (pollTimer !== undefined) {
                    clearInterval(pollTimer);
                }
            }
        };

        this.toDisposeOnWidget.push(
            composite.onActiveViewChanged(() => tryWire())
        );

        const pollTimer = setInterval(() => tryWire(), 1000);
        this.toDisposeOnWidget.push(Disposable.create(() => clearInterval(pollTimer)));
    }

    /** Whether diagram sync subscriptions have been wired for the current composite */
    protected diagramSyncWired = false;

    /** Guard flag to suppress diagram→outline sync when we caused the selection */
    protected suppressDiagramSync = false;

    /**
     * Wire sync subscriptions for a specific diagram widget.
     */
    protected wireDiagramOutlineSyncForWidget(
        composite: CompositeEditorWidget,
        diagramWidget: DiagramWidgetCapabilities,
    ): void {
        if (!this.outlineSyncService || !this.symbolMapper) {
            return;
        }
        if (this.diagramSyncWired) {
            return;
        }
        this.diagramSyncWired = true;

        const uri = composite.uri.toString();
        const syncService = this.outlineSyncService;

        // (a) Diagram selection → outline highlight
        if (diagramWidget.onSelectionChanged) {
            this.toDisposeOnWidget.push(
                diagramWidget.onSelectionChanged(selection => {
                    // Skip if we just caused this selection from outline→diagram
                    if (this.suppressDiagramSync) {
                        return;
                    }
                    syncService.handleSelectionChange(uri, selection.selectedIds, 'diagram');
                })
            );
        }

        // Subscribe to outline selection events from sync service (for diagram→outline direction)
        this.toDisposeOnWidget.push(
            syncService.onOutlineSelection((event: OutlineSelectionEvent) => {
                if (event.source === 'diagram' && this.cachedRoots && this.outlineViewService) {
                    // Mark matching node as selected and re-publish
                    this.clearSelection(this.cachedRoots);
                    for (const symbolPath of event.selectedSymbolPaths) {
                        const node = this.findNodeBySymbolPath(this.cachedRoots, symbolPath as string[]);
                        if (node) {
                            node.selected = true;
                            // Expand ancestors so the node is visible
                            let parent = node.parent;
                            while (parent) {
                                parent.expanded = true;
                                parent = parent.parent;
                            }
                            break;
                        }
                    }
                    this.canUpdate = false;
                    try {
                        this.outlineViewService.publish(this.cachedRoots);
                    } finally {
                        this.canUpdate = true;
                    }
                }
            })
        );

        // (b) Outline click → diagram selection
        // The OutlineSyncServiceImpl fires onDiagramSelectionRequest when outline triggers it.
        // Use suppressDiagramSync to prevent the resulting onSelectionChanged from
        // bouncing back into diagram→outline sync.
        if ('onDiagramSelectionRequest' in syncService) {
            const impl = syncService as { onDiagramSelectionRequest(cb: (event: { uri: string; elementIds: string[] }) => void): { dispose(): void } };
            this.toDisposeOnWidget.push(
                impl.onDiagramSelectionRequest(event => {
                    const selectElementFn = diagramWidget.selectElement;
                    if (event.uri === uri && selectElementFn) {
                        this.suppressDiagramSync = true;
                        // Clear existing selection first, then select and center
                        const doSelect = async (): Promise<void> => {
                            try {
                                // Clear previous selection
                                if (typeof diagramWidget.dispatchAction === 'function') {
                                    await diagramWidget.dispatchAction({
                                        kind: 'elementSelected',
                                        selectedElementsIDs: [],
                                        deselectedElementsIDs: diagramWidget.getSelection?.() ?? [],
                                    });
                                }
                                // Select new elements
                                for (const elementId of event.elementIds) {
                                    await selectElementFn.call(diagramWidget, elementId, false);
                                }
                                // Center the view on the selected elements
                                if (diagramWidget.center && event.elementIds.length > 0) {
                                    await diagramWidget.center(event.elementIds);
                                }
                            } finally {
                                this.suppressDiagramSync = false;
                            }
                        };
                        doSelect();
                    }
                })
            );
        }

        // (c) Build mappings when model changes (debounced)
        if (diagramWidget.onModelChanged) {
            this.toDisposeOnWidget.push(
                diagramWidget.onModelChanged(() => {
                    this.scheduleRebuildMappings(composite);
                })
            );
        }

        // (d) Build mappings immediately if model is already loaded
        this.scheduleRebuildMappings(composite);
    }

    /** Debounce timer for rebuildMappings */
    protected rebuildMappingsTimer: ReturnType<typeof setTimeout> | undefined;

    /**
     * Schedule a rebuild of element↔symbol mappings (debounced).
     */
    protected scheduleRebuildMappings(composite: CompositeEditorWidget): void {
        if (this.rebuildMappingsTimer !== undefined) {
            clearTimeout(this.rebuildMappingsTimer);
        }
        this.rebuildMappingsTimer = setTimeout(() => {
            this.rebuildMappingsTimer = undefined;
            this.rebuildMappings(composite);
        }, 100);
    }

    /**
     * Rebuild element↔symbol mappings from current diagram model and cached outline roots.
     *
     * Prefers source-range-based mapping (grammar-agnostic) when sourceRanges are
     * available from the server. Falls back to name-based matching otherwise.
     */
    protected rebuildMappings(composite: CompositeEditorWidget): void {
        if (!this.outlineSyncService || !this.symbolMapper) {
            this.logger.debug('rebuildMappings: missing sync service or symbol mapper');
            return;
        }
        if (!this.cachedRoots) {
            return;
        }

        const diagramWidget = composite.getDiagramWidget();
        if (!diagramWidget) {
            return;
        }
        const gModel = diagramWidget.getModel?.() as { id: string; children?: unknown[] } | undefined;
        if (!gModel) {
            return;
        }

        const uri = composite.uri.toString();

        // Convert cached outline nodes to DocumentSymbol format
        const symbols = this.outlineNodesToDocumentSymbols(this.cachedRoots);

        // Prefer range-based mapping if sourceRanges are available
        const sourceRanges = diagramWidget.getSourceRanges?.();
        let mappings: import('./outline-sync-types').ElementSymbolMapping[];

        if (sourceRanges && sourceRanges.size > 0) {
            mappings = this.symbolMapper.buildMappingsFromRanges(symbols, sourceRanges);
            this.logger.debug({ mappingCount: mappings.length, method: 'sourceRanges' }, 'rebuildMappings complete');
        } else {
            // Fallback: name-based matching
            const elementIds = this.collectElementIds(gModel);
            mappings = this.symbolMapper.buildMappingsFromSymbols(symbols, elementIds);
            this.logger.debug({ mappingCount: mappings.length, method: 'nameBased' }, 'rebuildMappings complete');
        }

        this.outlineSyncService.registerMappings(uri, mappings);
    }

    /**
     * Recursively collect element IDs from a GModel tree.
     */
    protected collectElementIds(element: { id: string; children?: unknown[] }): string[] {
        const ids: string[] = [element.id];
        if (element.children) {
            for (const child of element.children) {
                if (child && typeof child === 'object' && 'id' in child) {
                    ids.push(...this.collectElementIds(child as { id: string; children?: unknown[] }));
                }
            }
        }
        return ids;
    }

    /**
     * Convert DiagramOutlineNode[] to DocumentSymbol[] format for buildMappingsFromSymbols.
     */
    protected outlineNodesToDocumentSymbols(nodes: DiagramOutlineNode[]): LspDocumentSymbol[] {
        return nodes.map(node => ({
            name: node.name,
            kind: this.symbolKindFromIconClass(node.iconClass),
            range: {
                start: { line: node.fullRange.start.line, character: node.fullRange.start.character },
                end: { line: node.fullRange.end.line, character: node.fullRange.end.character },
            },
            selectionRange: {
                start: { line: node.range.start.line, character: node.range.start.character },
                end: { line: node.range.end.line, character: node.range.end.character },
            },
            children: node.children.length > 0 ? this.outlineNodesToDocumentSymbols(node.children) : undefined,
        } as LspDocumentSymbol));
    }

    /**
     * Approximate SymbolKind from the icon class string.
     */
    protected symbolKindFromIconClass(iconClass: string): number {
        // Monaco SymbolKind enum values; iconClass is the lowercase name
        const kindMap: Record<string, number> = {
            file: 0, module: 1, namespace: 2, package: 3, class: 4,
            method: 5, property: 6, field: 7, constructor: 8, enum: 9,
            interface: 10, function: 11, variable: 12, constant: 13, string: 14,
            number: 15, boolean: 16, array: 17, object: 18, key: 19,
            null: 20, enummember: 21, struct: 22, event: 23, operator: 24,
            typeparameter: 25,
        };
        return kindMap[iconClass] ?? 4; // Default to Class
    }

    /**
     * Clear selection on all outline nodes recursively.
     */
    protected clearSelection(nodes: DiagramOutlineNode[]): void {
        for (const node of nodes) {
            node.selected = false;
            if (node.children.length > 0) {
                this.clearSelection(node.children);
            }
        }
    }

    /**
     * Find a DiagramOutlineNode by its symbolPath.
     */
    protected findNodeBySymbolPath(
        nodes: DiagramOutlineNode[],
        symbolPath: string[],
    ): DiagramOutlineNode | undefined {
        for (const node of nodes) {
            if (this.arraysEqual(node.symbolPath, symbolPath)) {
                return node;
            }
            if (node.children.length > 0) {
                const found = this.findNodeBySymbolPath(node.children, symbolPath);
                if (found) {
                    return found;
                }
            }
        }
        return undefined;
    }

    /**
     * Compare two string arrays for equality.
     */
    protected arraysEqual(a: string[], b: string[]): boolean {
        if (a.length !== b.length) {
            return false;
        }
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) {
                return false;
            }
        }
        return true;
    }

    protected releaseCompositeEditor(): void {
        // Restore sync config and clear mappings
        if (this.outlineSyncService) {
            this.outlineSyncService.setConfig({ syncOutlineToTextEditor: true });
            if (this.currentComposite) {
                this.outlineSyncService.clearMappings(this.currentComposite.uri.toString());
            }
        }

        this.toDisposeOnWidget.dispose();
        this.currentComposite = undefined;
        this.cachedRoots = undefined;
        this.diagramSyncWired = false;
        this.suppressDiagramSync = false;
        if (this.debounceTimer !== undefined) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = undefined;
        }
        if (this.rebuildMappingsTimer !== undefined) {
            clearTimeout(this.rebuildMappingsTimer);
            this.rebuildMappingsTimer = undefined;
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

        this.cachedRoots = roots;
        this.outlineViewService?.publish(roots);

        // Rebuild element↔symbol mappings after outline updates (debounced)
        if (this.currentComposite) {
            this.scheduleRebuildMappings(this.currentComposite);
        }
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
     * Resolve a DiagramOutlineNode from an outline tree node.
     * Theia's tree widget may reconstruct nodes on re-render, losing our custom
     * properties (uri, range, symbolPath). Fall back to looking up by name
     * in cachedRoots (Theia preserves the `name` property but may regenerate IDs).
     */
    protected resolveDiagramOutlineNode(node: unknown): DiagramOutlineNode | undefined {
        if (DiagramOutlineNode.is(node)) {
            return node;
        }
        // Fall back to cachedRoots lookup by name
        if (this.cachedRoots && node && typeof node === 'object' && 'name' in node) {
            return this.findNodeByName(this.cachedRoots, (node as { name: string }).name);
        }
        return undefined;
    }

    /**
     * Find a DiagramOutlineNode by its name in the cached tree.
     */
    protected findNodeByName(
        nodes: DiagramOutlineNode[],
        name: string,
    ): DiagramOutlineNode | undefined {
        for (const node of nodes) {
            if (node.name === name) {
                return node;
            }
            if (node.children.length > 0) {
                const found = this.findNodeByName(node.children, name);
                if (found) {
                    return found;
                }
            }
        }
        return undefined;
    }

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

        // Resolve the DiagramOutlineNode — either the node itself has our
        // custom properties, or we look it up from cachedRoots by node ID
        // (Theia's tree widget may reconstruct nodes and lose custom props).
        const diagramNode = this.resolveDiagramOutlineNode(node);

        // Sync to diagram via OutlineSyncService (if available)
        if (this.outlineSyncService && diagramNode) {
            const uri = diagramNode.uri.toString();
            const elementId = this.outlineSyncService.lookupElement(uri, diagramNode.symbolPath);
            if (elementId) {
                this.outlineSyncService.handleSelectionChange(uri, [elementId], 'outline');
            }
        }

        // Reveal in the embedded text editor within the composite widget
        this.revealInEmbeddedEditor(diagramNode ?? node, false);
    }

    protected async handleOutlineOpen(node: OutlineNodeWithRange): Promise<void> {
        const diagramNode = this.resolveDiagramOutlineNode(node);
        this.revealInEmbeddedEditor(diagramNode ?? node, true);
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
