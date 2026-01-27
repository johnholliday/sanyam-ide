/********************************************************************************
 * Copyright (C) 2024 Sanyam IDE contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/**
 * Sanyam GLSP Backend Service Implementation
 *
 * This service provides the backend implementation of the SanyamGlspService interface.
 * It bridges the Theia frontend to the unified language server's GLSP capabilities.
 *
 * Phase 3 (US1) Implementation:
 * - T012: loadModel() with AST-to-GModel conversion
 * - T013: getToolPalette() implementation
 * - T014: validate() implementation
 * - T015: getSupportedOperations() implementation
 * - T018: Error handling for uninitialized state
 * - T019: Debug logging for model operations
 *
 * NOTE: This service uses dynamic imports to work with ESM packages (langium,
 * language-server) from a CommonJS context. The actual GLSP server integration
 * is performed at runtime.
 *
 * @packageDocumentation
 */

import { injectable, postConstruct, inject, optional } from '@theia/core/shared/inversify';
import { Emitter, DisposableCollection } from '@theia/core';
import type { ILogger } from '@theia/core/lib/common/logger';
import type {
    SanyamGlspServiceInterface,
    LoadModelResponse,
    SaveModelResponse,
    ExecuteOperationResponse,
    LayoutResponse,
    ToolPaletteResponse,
    ContextMenuResponse,
    ValidationResponse,
    DiagramOperation,
    LayoutOptions,
    GlspPoint,
    LanguageContribution,
    DiagramLanguageInfo,
    GetPropertiesResponse,
    UpdatePropertyResponse,
} from '@sanyam/types';

/**
 * Backend service state for tracking initialization.
 */
type ServiceState = 'uninitialized' | 'initializing' | 'ready' | 'failed';

/**
 * Pending request that was queued during initialization.
 */
interface PendingRequest {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    execute: () => Promise<unknown>;
}

// Type definitions for dynamically loaded modules
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GlspServer = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LangiumSharedServices = any;

/**
 * Interface for the langium module (ESM).
 */
interface LangiumModule {
    inject: (...modules: unknown[]) => LangiumSharedServices;
}

/**
 * Interface for the langium/lsp module (ESM).
 */
interface LangiumLspModule {
    createDefaultSharedModule: (fileSystem: unknown) => unknown;
    createDefaultModule: (config: unknown) => unknown;
}

/**
 * Interface for the langium/node module (ESM).
 */
interface LangiumNodeModule {
    NodeFileSystem: Record<string, unknown>;
}

/**
 * Interface for the sanyam-language-server/server-factory module (ESM).
 */
interface ServerFactoryModule {
    createGlspServer: (sharedServices: LangiumSharedServices, config: {
        autoLayout?: boolean;
        validation?: boolean;
        logResolution?: boolean;
    }) => GlspServer;
}

/**
 * Sanyam GLSP Backend Service Implementation.
 *
 * This service implements the SanyamGlspService interface and provides
 * the backend logic for GLSP diagram operations.
 *
 * Features:
 * - Lazy initialization with request queuing (T007)
 * - Grammar contribution loading (T008)
 * - Direct GLSP server integration (T012-T015)
 * - Error handling for uninitialized state (T018)
 * - Debug logging for model operations (T019)
 */
@injectable()
export class SanyamGlspBackendServiceImpl implements SanyamGlspServiceInterface {
    protected readonly toDispose = new DisposableCollection();

    /** Current service state */
    protected state: ServiceState = 'uninitialized';

    /** Pending requests queued during initialization */
    protected pendingRequests: PendingRequest[] = [];

    /** Error message if initialization failed */
    protected initError: string | null = null;

    /** Shared Langium services (dynamically loaded) */
    protected sharedServices: LangiumSharedServices | null = null;

    /** GLSP server instance (dynamically loaded) */
    protected glspServer: GlspServer | null = null;

    /** Loaded language contributions */
    protected contributions: Map<string, LanguageContribution> = new Map();

    /** Event emitter for model updates */
    protected readonly onModelUpdatedEmitter = new Emitter<{
        uri: string;
        gModel: unknown;
        metadata: unknown;
    }>();

    /** Event for model updates (text → diagram sync) */
    readonly onModelUpdated = this.onModelUpdatedEmitter.event;

    @inject('ILogger') @optional()
    protected readonly logger: ILogger | undefined;

    @postConstruct()
    protected init(): void {
        this.toDispose.push(this.onModelUpdatedEmitter);
        this.log('[SanyamGlspBackendService] Initializing...');

        // Start lazy initialization
        this.initializeAsync().catch(error => {
            this.logError('[SanyamGlspBackendService] Initialization failed:', error);
            this.state = 'failed';
            this.initError = error instanceof Error ? error.message : String(error);
            // Reject all pending requests
            this.rejectPendingRequests(new Error(`Service initialization failed: ${this.initError}`));
        });
    }

    /**
     * Async initialization logic.
     *
     * Uses dynamic imports to load ESM modules at runtime.
     */
    protected async initializeAsync(): Promise<void> {
        this.state = 'initializing';

        try {
            this.log('[SanyamGlspBackendService] Loading GLSP server components...');

            // Dynamic import of ESM modules
            // These are loaded at runtime to avoid TypeScript module resolution issues
            const langium = await this.dynamicImport('langium') as LangiumModule;
            const langiumLsp = await this.dynamicImport('langium/lsp') as LangiumLspModule;
            const langiumNode = await this.dynamicImport('langium/node') as LangiumNodeModule;
            const serverFactory = await this.dynamicImport('sanyam-language-server/server-factory') as ServerFactoryModule;

            // Load grammar contributions
            const contributions = await this.loadGrammarContributions();

            if (contributions.length === 0) {
                this.log('[SanyamGlspBackendService] No grammar contributions found - running in stub mode');
                this.state = 'ready';
                this.processPendingRequests();
                return;
            }

            this.log(`[SanyamGlspBackendService] Found ${contributions.length} grammar contribution(s)`);

            // Create shared Langium services
            const sharedModules: unknown[] = [
                langiumLsp.createDefaultSharedModule({ ...langiumNode.NodeFileSystem }),
            ];

            // Add each contribution's shared module
            for (const contribution of contributions) {
                if (contribution.generatedSharedModule) {
                    sharedModules.push(contribution.generatedSharedModule);
                }
            }

            // Compose shared services
            this.sharedServices = langium.inject(...(sharedModules as [unknown, ...unknown[]]));

            // Initialize GLSP server
            this.glspServer = serverFactory.createGlspServer(this.sharedServices, {
                autoLayout: true,
                validation: true,
                logResolution: false,
            });

            // Register each contribution
            for (const contribution of contributions) {
                try {
                    // Create language services
                    this.createLanguageServices(contribution, langiumLsp.createDefaultModule);

                    // Register with GLSP server
                    this.glspServer.registerLanguage(contribution);

                    // Store contribution
                    this.contributions.set(contribution.languageId, contribution);

                    this.log(`[SanyamGlspBackendService] Registered language: ${contribution.languageId}`);
                } catch (error) {
                    this.logError(`[SanyamGlspBackendService] Failed to register ${contribution.languageId}:`, error);
                }
            }

            this.state = 'ready';
            this.log('[SanyamGlspBackendService] Ready with GLSP server');

            // Process all pending requests
            this.processPendingRequests();
        } catch (error) {
            // If dynamic imports fail (e.g., ESM not supported), fall back to stub mode
            this.logError('[SanyamGlspBackendService] Failed to load GLSP components:', error);
            this.log('[SanyamGlspBackendService] Running in stub mode due to module loading failure');

            // Don't fail completely - run in stub mode
            this.state = 'ready';
            this.processPendingRequests();
        }
    }

    /**
     * Dynamic import helper for ESM modules.
     * Uses eval to avoid TypeScript's static analysis.
     */
    protected async dynamicImport(modulePath: string): Promise<unknown> {
        // Use dynamic import() which works at runtime
        // The Function constructor avoids TypeScript's module resolution
        const importFn = new Function('modulePath', 'return import(modulePath)');
        return importFn(modulePath);
    }

    /**
     * Load grammar contributions from available packages.
     */
    protected async loadGrammarContributions(): Promise<LanguageContribution[]> {
        const contributions: LanguageContribution[] = [];

        // Try to load spdevkit contribution
        try {
            const spdevkit = await this.dynamicImport('@sanyam-grammar/spdevkit/contribution');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((spdevkit as any)?.contribution) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                contributions.push((spdevkit as any).contribution as LanguageContribution);
                this.log('[SanyamGlspBackendService] Loaded spdevkit contribution');
            }
        } catch {
            this.log('[SanyamGlspBackendService] spdevkit contribution not available');
        }

        return contributions;
    }

    /**
     * Create Langium services for a language contribution.
     */
    protected createLanguageServices(
        contribution: LanguageContribution,
        createDefaultModule: (context: { shared: unknown }) => unknown
    ): void {
        if (!this.sharedServices) {
            throw new Error('Shared services not initialized');
        }

        // Import langium for injection
        // This is called after langium is already loaded
        this.dynamicImport('langium').then(langium => {
            const modules: unknown[] = [
                createDefaultModule({ shared: this.sharedServices }),
                contribution.generatedModule,
            ];

            if (contribution.customModule) {
                modules.push(contribution.customModule);
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const services = (langium as any).inject(...(modules as [unknown, ...unknown[]]));

            // Register with shared service registry
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (this.sharedServices as any).ServiceRegistry.register(services);
        }).catch(error => {
            this.logError('[SanyamGlspBackendService] Failed to create language services:', error);
        });
    }

    /**
     * Get a Langium document by URI.
     */
    protected async getDocument(uri: string): Promise<{ document: unknown; contribution: LanguageContribution } | null> {
        if (!this.sharedServices) {
            return null;
        }

        // Find contribution by URI extension
        const path = uri.replace(/^file:\/\//, '');
        const ext = path.substring(path.lastIndexOf('.'));

        let contribution: LanguageContribution | undefined;
        for (const c of this.contributions.values()) {
            if (c.fileExtensions.some(e => e === ext || `.${e}` === ext)) {
                contribution = c;
                break;
            }
        }

        if (!contribution) {
            this.log(`[SanyamGlspBackendService] No language for extension: ${ext}`);
            return null;
        }

        this.log(`[SanyamGlspBackendService] Found contribution: ${contribution.languageId}`);

        try {
            // Get vscode-uri for parsing
            const vscodeUri = await this.dynamicImport('vscode-uri');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const parsedUri = (vscodeUri as any).URI.parse(uri);

            this.log(`[SanyamGlspBackendService] Parsed URI: ${parsedUri.toString()}`);

            // Get document from Langium document service
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const langiumDocuments = (this.sharedServices as any).workspace.LangiumDocuments;
            let document = langiumDocuments.getDocument(parsedUri);
            this.log(`[SanyamGlspBackendService] Existing document found: ${!!document}`);

            // If document not loaded, try to load from file system
            if (!document) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const fileSystemProvider = (this.sharedServices as any).workspace.FileSystemProvider;
                const content = await fileSystemProvider.readFile(parsedUri);
                const textContent = typeof content === 'string' ? content : new TextDecoder().decode(content);

                // Create text document
                const textDocument = {
                    uri,
                    languageId: contribution.languageId,
                    version: 1,
                    getText: () => textContent,
                    positionAt: (offset: number) => ({ line: 0, character: offset }),
                    offsetAt: (position: { line: number; character: number }) => position.character,
                    lineCount: textContent.split('\n').length,
                };

                // Parse the document
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const serviceRegistry = (this.sharedServices as any).ServiceRegistry;
                const languageServices = serviceRegistry.getServices(parsedUri);

                if (languageServices) {
                    this.log(`[SanyamGlspBackendService] Language services found, parsing document...`);
                    const parseResult = languageServices.parser.LangiumParser.parse(textContent);
                    this.log(`[SanyamGlspBackendService] Parse result: value=${!!parseResult?.value}, type=${parseResult?.value?.$type}`);
                    this.log(`[SanyamGlspBackendService] Parse errors: ${parseResult?.parserErrors?.length ?? 0}`);
                    document = {
                        uri: parsedUri,
                        textDocument,
                        parseResult,
                        state: 2, // DocumentState.Parsed
                    };
                } else {
                    this.log(`[SanyamGlspBackendService] No language services found!`);
                }
            }

            if (!document) {
                this.log(`[SanyamGlspBackendService] Document is null after processing`);
                return null;
            }

            this.log(`[SanyamGlspBackendService] Returning document with parseResult.value type: ${document.parseResult?.value?.$type}`);
            return { document, contribution };
        } catch (error) {
            this.logError(`[SanyamGlspBackendService] Failed to load document: ${uri}`, error);
            return null;
        }
    }

    /**
     * Log a message using the logger if available, otherwise console.
     */
    protected log(message: string, ...args: unknown[]): void {
        if (this.logger) {
            this.logger.info(message, ...args);
        } else {
            console.log(message, ...args);
        }
    }

    /**
     * Log a debug message.
     */
    protected debug(message: string, ...args: unknown[]): void {
        if (this.logger) {
            this.logger.debug(message, ...args);
        } else {
            console.debug(message, ...args);
        }
    }

    /**
     * Log an error using the logger if available, otherwise console.
     */
    protected logError(message: string, ...args: unknown[]): void {
        if (this.logger) {
            this.logger.error(message, ...args);
        } else {
            console.error(message, ...args);
        }
    }

    /**
     * Ensure the service is initialized before processing a request.
     * If not ready, the request is queued for later execution.
     */
    protected async ensureInitialized<T>(execute: () => Promise<T>): Promise<T> {
        if (this.state === 'ready') {
            return execute();
        }

        if (this.state === 'failed') {
            throw new Error(`Service initialization failed: ${this.initError}`);
        }

        // Queue the request for later execution (T018: request queuing)
        return new Promise<T>((resolve, reject) => {
            this.pendingRequests.push({
                resolve: resolve as (value: unknown) => void,
                reject,
                execute: execute as () => Promise<unknown>,
            });
        });
    }

    /**
     * Process all pending requests after initialization.
     */
    protected processPendingRequests(): void {
        const requests = this.pendingRequests;
        this.pendingRequests = [];

        for (const request of requests) {
            request.execute()
                .then(result => request.resolve(result))
                .catch(error => request.reject(error));
        }
    }

    /**
     * Reject all pending requests with an error.
     */
    protected rejectPendingRequests(error: Error): void {
        const requests = this.pendingRequests;
        this.pendingRequests = [];

        for (const request of requests) {
            request.reject(error);
        }
    }

    // =========================================================================
    // SanyamGlspService Implementation (Phase 3 - US1)
    // =========================================================================

    /**
     * Load the diagram model for a file.
     *
     * T012: Implements AST-to-GModel conversion using the GLSP server.
     * T019: Includes debug logging for model load operations.
     */
    async loadModel(uri: string): Promise<LoadModelResponse> {
        return this.ensureInitialized(async () => {
            this.log(`[SanyamGlspBackendService] loadModel called for: ${uri}`);
            const startTime = Date.now();

            // T018: Check if GLSP server is available
            if (!this.glspServer) {
                this.log(`[SanyamGlspBackendService] loadModel: GLSP server not available for ${uri}`);
                return {
                    success: false,
                    error: 'GLSP server not initialized. Running in stub mode.',
                };
            }

            try {
                // Get document
                const result = await this.getDocument(uri);
                if (!result) {
                    return {
                        success: false,
                        error: `Document not found or no language registered for: ${uri}`,
                    };
                }

                const { document, contribution } = result;
                const doc = document as any;

                // Debug: log document structure
                this.log(`[SanyamGlspBackendService] Document structure:`);
                this.log(`  - URI: ${doc.uri?.toString?.() ?? doc.uri}`);
                this.log(`  - Has parseResult: ${!!doc.parseResult}`);
                this.log(`  - parseResult.value type: ${doc.parseResult?.value?.$type ?? 'none'}`);
                this.log(`  - Contribution languageId: ${contribution.languageId}`);

                // Get CancellationToken
                const vscodeLanguageserver = await this.dynamicImport('vscode-languageserver');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const CancellationToken = (vscodeLanguageserver as any).CancellationToken;

                // Load model using GLSP server
                this.log(`[SanyamGlspBackendService] Calling glspServer.loadModel...`);
                const context = await this.glspServer.loadModel(document, CancellationToken.None);
                this.log(`[SanyamGlspBackendService] glspServer.loadModel returned`);
                this.log(`  - context.root type: ${context.root?.$type ?? 'none'}`);
                this.log(`  - context.gModel exists: ${!!context.gModel}`);

                const elapsed = Date.now() - startTime;
                this.log(`[SanyamGlspBackendService] loadModel completed in ${elapsed}ms for ${uri}`);

                // Debug: log GModel details
                const childCount = context.gModel?.children?.length ?? 0;
                this.log(`[SanyamGlspBackendService] GModel for ${uri}:`);
                this.log(`  - ID: ${context.gModel?.id}`);
                this.log(`  - Type: ${context.gModel?.type}`);
                this.log(`  - Children count: ${childCount}`);
                if (childCount > 0 && childCount <= 10) {
                    context.gModel?.children?.forEach((child: any, i: number) => {
                        this.log(`  - Child[${i}]: ${child.id} (type: ${child.type})`);
                    });
                }

                return {
                    success: true,
                    gModel: context.gModel,
                    metadata: {
                        positions: context.metadata?.positions
                            ? Object.fromEntries(context.metadata.positions)
                            : {},
                        sizes: context.metadata?.sizes
                            ? Object.fromEntries(context.metadata.sizes)
                            : {},
                        routingPoints: context.metadata?.routingPoints
                            ? Object.fromEntries(context.metadata.routingPoints)
                            : undefined,
                    },
                };
            } catch (error) {
                this.logError(`[SanyamGlspBackendService] loadModel error for ${uri}:`, error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        });
    }

    /**
     * Save the current model state.
     */
    async saveModel(uri: string): Promise<SaveModelResponse> {
        return this.ensureInitialized(async () => {
            this.debug(`[SanyamGlspBackendService] saveModel: ${uri}`);

            if (!this.glspServer) {
                return {
                    success: false,
                    error: 'GLSP server not initialized',
                };
            }

            try {
                const result = await this.getDocument(uri);
                if (!result) {
                    return {
                        success: false,
                        error: `Document not found: ${uri}`,
                    };
                }

                const vscodeLanguageserver = await this.dynamicImport('vscode-languageserver');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const CancellationToken = (vscodeLanguageserver as any).CancellationToken;

                const context = this.glspServer.createContext(result.document, CancellationToken.None);
                const success = await this.glspServer.saveModel(context);

                return { success };
            } catch (error) {
                this.logError(`[SanyamGlspBackendService] saveModel error:`, error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        });
    }

    /**
     * Execute a diagram operation.
     *
     * Phase 4 (US2) will fully implement this.
     */
    async executeOperation(
        uri: string,
        operation: DiagramOperation
    ): Promise<ExecuteOperationResponse> {
        return this.ensureInitialized(async () => {
            this.debug(`[SanyamGlspBackendService] executeOperation: ${uri}`, operation.kind);

            if (!this.glspServer) {
                return {
                    success: false,
                    error: 'GLSP server not initialized',
                };
            }

            try {
                const result = await this.getDocument(uri);
                if (!result) {
                    return {
                        success: false,
                        error: `Document not found: ${uri}`,
                    };
                }

                const vscodeLanguageserver = await this.dynamicImport('vscode-languageserver');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const CancellationToken = (vscodeLanguageserver as any).CancellationToken;

                const context = this.glspServer.createContext(result.document, CancellationToken.None);
                const opResult = this.glspServer.executeOperation(context, operation);

                return {
                    success: opResult?.success ?? true,
                    error: opResult?.error,
                    edits: opResult?.edits,
                    updatedModel: context.gModel,
                };
            } catch (error) {
                this.logError(`[SanyamGlspBackendService] executeOperation error:`, error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        });
    }

    /**
     * Request automatic layout computation.
     */
    async requestLayout(uri: string, options?: LayoutOptions): Promise<LayoutResponse> {
        return this.ensureInitialized(async () => {
            this.debug(`[SanyamGlspBackendService] requestLayout: ${uri}`);

            if (!this.glspServer) {
                return {
                    positions: {},
                    sizes: {},
                    routingPoints: {},
                    bounds: { width: 800, height: 600 },
                };
            }

            try {
                const result = await this.getDocument(uri);
                if (!result) {
                    return {
                        positions: {},
                        sizes: {},
                        routingPoints: {},
                        bounds: { width: 800, height: 600 },
                        error: `Document not found: ${uri}`,
                    };
                }

                const vscodeLanguageserver = await this.dynamicImport('vscode-languageserver');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const CancellationToken = (vscodeLanguageserver as any).CancellationToken;

                const context = this.glspServer.createContext(result.document, CancellationToken.None);
                const layoutResult = this.glspServer.applyLayout(context, options);

                return {
                    positions: Object.fromEntries(layoutResult.positions),
                    sizes: Object.fromEntries(layoutResult.sizes ?? new Map()),
                    routingPoints: Object.fromEntries(layoutResult.routingPoints),
                    bounds: layoutResult.bounds,
                };
            } catch (error) {
                this.logError(`[SanyamGlspBackendService] requestLayout error:`, error);
                return {
                    positions: {},
                    sizes: {},
                    routingPoints: {},
                    bounds: { width: 800, height: 600 },
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        });
    }

    /**
     * Get the tool palette for a file.
     *
     * T013: Returns tool palette from GLSP server based on manifest.
     */
    async getToolPalette(uri: string): Promise<ToolPaletteResponse> {
        return this.ensureInitialized(async () => {
            this.debug(`[SanyamGlspBackendService] getToolPalette: ${uri}`);

            if (!this.glspServer) {
                return { groups: [] };
            }

            try {
                const result = await this.getDocument(uri);
                if (!result) {
                    return {
                        groups: [],
                        error: `Document not found: ${uri}`,
                    };
                }

                const vscodeLanguageserver = await this.dynamicImport('vscode-languageserver');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const CancellationToken = (vscodeLanguageserver as any).CancellationToken;

                const context = this.glspServer.createContext(result.document, CancellationToken.None);
                const palette = this.glspServer.getToolPalette(context);

                return {
                    groups: palette.groups ?? [],
                };
            } catch (error) {
                this.logError(`[SanyamGlspBackendService] getToolPalette error:`, error);
                return {
                    groups: [],
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        });
    }

    /**
     * Get context menu items for selected elements.
     */
    async getContextMenu(
        uri: string,
        selectedIds: string[],
        position?: GlspPoint
    ): Promise<ContextMenuResponse> {
        return this.ensureInitialized(async () => {
            this.debug(`[SanyamGlspBackendService] getContextMenu: ${uri}`);

            if (!this.glspServer) {
                return { items: [] };
            }

            try {
                const result = await this.getDocument(uri);
                if (!result) {
                    return {
                        items: [],
                        error: `Document not found: ${uri}`,
                    };
                }

                const vscodeLanguageserver = await this.dynamicImport('vscode-languageserver');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const CancellationToken = (vscodeLanguageserver as any).CancellationToken;

                const context = this.glspServer.createContext(result.document, CancellationToken.None);
                const menu = this.glspServer.getContextMenu(context, selectedIds, position);

                return {
                    items: menu.items ?? [],
                };
            } catch (error) {
                this.logError(`[SanyamGlspBackendService] getContextMenu error:`, error);
                return {
                    items: [],
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        });
    }

    /**
     * Validate the diagram model.
     *
     * T014: Returns validation markers from GLSP server.
     */
    async validate(uri: string): Promise<ValidationResponse> {
        return this.ensureInitialized(async () => {
            this.debug(`[SanyamGlspBackendService] validate: ${uri}`);

            if (!this.glspServer) {
                return {
                    markers: [],
                    isValid: true,
                    errorCount: 0,
                    warningCount: 0,
                };
            }

            try {
                const result = await this.getDocument(uri);
                if (!result) {
                    return {
                        markers: [],
                        isValid: false,
                        errorCount: 1,
                        warningCount: 0,
                    };
                }

                const vscodeLanguageserver = await this.dynamicImport('vscode-languageserver');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const CancellationToken = (vscodeLanguageserver as any).CancellationToken;

                const context = this.glspServer.createContext(result.document, CancellationToken.None);
                const validationResult = this.glspServer.validate(context);

                return {
                    markers: validationResult.markers ?? [],
                    isValid: validationResult.isValid ?? (validationResult.errorCount === 0),
                    errorCount: validationResult.errorCount ?? 0,
                    warningCount: validationResult.warningCount ?? 0,
                };
            } catch (error) {
                this.logError(`[SanyamGlspBackendService] validate error:`, error);
                return {
                    markers: [],
                    isValid: false,
                    errorCount: 1,
                    warningCount: 0,
                };
            }
        });
    }

    /**
     * Synchronize document content from frontend.
     *
     * Phase 5 (US3) will fully implement this.
     */
    async syncDocument(uri: string, content: string, version: number): Promise<void> {
        return this.ensureInitialized(async () => {
            this.debug(`[SanyamGlspBackendService] syncDocument: ${uri} v${version}`);

            // Document sync will be implemented in Phase 5 (US3)
            // For now, this is a no-op
            void content;
        });
    }

    /**
     * Get list of supported operations.
     *
     * T015: Returns supported operations from GLSP server.
     */
    async getSupportedOperations(): Promise<{ operations: string[] }> {
        return this.ensureInitialized(async () => {
            this.debug('[SanyamGlspBackendService] getSupportedOperations');

            if (!this.glspServer) {
                return {
                    operations: [
                        'createNode',
                        'deleteElement',
                        'changeBounds',
                        'createEdge',
                        'reconnectEdge',
                        'editLabel',
                    ],
                };
            }

            return {
                operations: this.glspServer.getSupportedOperations(),
            };
        });
    }

    /**
     * Get list of diagram-enabled languages.
     *
     * Returns languages that have diagrammingEnabled=true in their manifest.
     */
    async getDiagramLanguages(): Promise<DiagramLanguageInfo[]> {
        return this.ensureInitialized(async () => {
            this.debug('[SanyamGlspBackendService] getDiagramLanguages');

            const languages: DiagramLanguageInfo[] = [];

            for (const contribution of this.contributions.values()) {
                // Check if this language has diagramming enabled
                const manifest = contribution.manifest;
                if (manifest?.diagrammingEnabled !== false) {
                    // Ensure file extensions are in proper format (with leading dot)
                    const fileExtensions = contribution.fileExtensions.map(ext =>
                        ext.startsWith('.') ? ext : `.${ext}`
                    );

                    languages.push({
                        languageId: contribution.languageId,
                        displayName: manifest?.displayName ?? contribution.languageId,
                        fileExtensions,
                        iconClass: 'fa fa-project-diagram',
                    });
                }
            }

            this.log(`[SanyamGlspBackendService] Found ${languages.length} diagram-enabled language(s)`);
            return languages;
        });
    }

    // =========================================================================
    // Properties Panel Methods (FR-009 to FR-013)
    // =========================================================================

    /**
     * Get properties for selected diagram elements.
     *
     * FR-009, FR-010: Extracts editable properties from AST nodes.
     * For multi-select, returns only common properties.
     */
    async getProperties(uri: string, elementIds: string[]): Promise<GetPropertiesResponse> {
        return this.ensureInitialized(async () => {
            this.debug(`[SanyamGlspBackendService] getProperties: ${uri}, elements: ${elementIds.join(', ')}`);

            if (!this.glspServer) {
                return {
                    success: false,
                    elementIds,
                    properties: [],
                    typeLabel: '',
                    isMultiSelect: elementIds.length > 1,
                    error: 'GLSP server not initialized',
                };
            }

            try {
                const result = await this.getDocument(uri);
                if (!result) {
                    return {
                        success: false,
                        elementIds,
                        properties: [],
                        typeLabel: '',
                        isMultiSelect: elementIds.length > 1,
                        error: `Document not found: ${uri}`,
                    };
                }

                const vscodeLanguageserver = await this.dynamicImport('vscode-languageserver');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const CancellationToken = (vscodeLanguageserver as any).CancellationToken;

                const context = this.glspServer.createContext(result.document, CancellationToken.None);

                // TODO: Phase 6 (US4) - Implement actual property extraction
                // For now, return stub response
                if (this.glspServer.getProperties) {
                    const propsResult = this.glspServer.getProperties(context, elementIds);
                    return {
                        success: true,
                        ...propsResult,
                    };
                }

                return {
                    success: true,
                    elementIds,
                    properties: [],
                    typeLabel: elementIds.length === 1 ? 'Element' : `${elementIds.length} Elements`,
                    isMultiSelect: elementIds.length > 1,
                };
            } catch (error) {
                this.logError(`[SanyamGlspBackendService] getProperties error:`, error);
                return {
                    success: false,
                    elementIds,
                    properties: [],
                    typeLabel: '',
                    isMultiSelect: elementIds.length > 1,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        });
    }

    /**
     * Update a property value for selected elements.
     *
     * FR-012: Modifies AST text to reflect the new property value.
     * For multi-select, applies the change to all selected elements.
     */
    async updateProperty(
        uri: string,
        elementIds: string[],
        property: string,
        value: unknown
    ): Promise<UpdatePropertyResponse> {
        return this.ensureInitialized(async () => {
            this.debug(`[SanyamGlspBackendService] updateProperty: ${uri}, elements: ${elementIds.join(', ')}, property: ${property}`);

            if (!this.glspServer) {
                return {
                    success: false,
                    error: 'GLSP server not initialized',
                };
            }

            try {
                const result = await this.getDocument(uri);
                if (!result) {
                    return {
                        success: false,
                        error: `Document not found: ${uri}`,
                    };
                }

                const vscodeLanguageserver = await this.dynamicImport('vscode-languageserver');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const CancellationToken = (vscodeLanguageserver as any).CancellationToken;

                const context = this.glspServer.createContext(result.document, CancellationToken.None);

                // TODO: Phase 6 (US4) - Implement actual property update
                // For now, return stub response
                if (this.glspServer.updateProperty) {
                    const updateResult = this.glspServer.updateProperty(context, elementIds, property, value);
                    return {
                        success: true,
                        ...updateResult,
                    };
                }

                return {
                    success: true,
                };
            } catch (error) {
                this.logError(`[SanyamGlspBackendService] updateProperty error:`, error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        });
    }

    /**
     * Check if the service is ready.
     */
    isReady(): boolean {
        return this.state === 'ready';
    }

    /**
     * Get the current service state.
     */
    getState(): ServiceState {
        return this.state;
    }

    /**
     * Dispose of resources.
     */
    dispose(): void {
        this.log('[SanyamGlspBackendService] Disposing...');
        this.toDispose.dispose();
        this.pendingRequests = [];
        this.glspServer = null;
        this.sharedServices = null;
        this.contributions.clear();
    }
}
