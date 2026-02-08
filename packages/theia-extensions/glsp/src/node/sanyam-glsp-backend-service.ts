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

import { createLogger, type SanyamLogger } from '@sanyam/logger';
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
    protected readonly theiaLogger: ILogger | undefined;

    protected readonly logger: SanyamLogger = createLogger({ name: 'GlspBackendService' });

    /** Promise that resolves when initialization completes */
    protected initPromise: Promise<void> | null = null;

    @postConstruct()
    protected init(): void {
        this.toDispose.push(this.onModelUpdatedEmitter);
        this.log('[SanyamGlspBackendService] Initializing...');
        this.startInitialization();
    }

    /**
     * Start initialization if not already started.
     * Can be called from @postConstruct or lazily from ensureInitialized.
     */
    protected startInitialization(): void {
        if (this.initPromise) {
            return;
        }
        this.initPromise = this.initializeAsync().catch(error => {
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
                    await this.createLanguageServices(contribution, langiumLsp.createDefaultModule);

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
     * Load grammar contributions from the application's generated grammars module.
     *
     * ## Architecture Overview
     *
     * The Sanyam IDE uses a grammar-agnostic architecture where:
     * - Grammar packages (`@sanyam-grammar/*`) are dependencies of APPLICATIONS, not extensions
     * - The GLSP extension (`@sanyam-ide/glsp`) must remain grammar-agnostic
     * - Applications declare which grammars they support via package.json dependencies
     *
     * ## Why Not Hardcode Grammar Imports?
     *
     * Previously, this service hardcoded `@sanyam-grammar/spdevkit`:
     * ```typescript
     * const spdevkit = await import('@sanyam-grammar/spdevkit/contribution');
     * ```
     *
     * This violated grammar-agnosticism — changing grammars required modifying
     * the GLSP extension source code instead of just updating application dependencies.
     *
     * ## Why Not Scan package.json at Runtime?
     *
     * We considered dynamically scanning the application's package.json and importing
     * grammar contributions at runtime:
     * ```typescript
     * const mod = await import('@sanyam-grammar/ecml/contribution');
     * ```
     *
     * **This fails due to Node.js module resolution context:**
     * - This code runs inside `@sanyam-ide/glsp` package
     * - Node.js resolves imports starting from `@sanyam-ide/glsp/node_modules/`
     * - Grammar packages are NOT dependencies of `@sanyam-ide/glsp`
     * - With pnpm's strict isolation, the import fails with "Cannot find module"
     *
     * ## The Solution: Generated File in Application's lib/
     *
     * The application generates `lib/language-server/grammars.js` at build time:
     * ```javascript
     * import { contribution as ecml } from '@sanyam-grammar/ecml/contribution';
     * export const GrammarContributions = [ecml];
     * ```
     *
     * When this service calls `require(appRoot/lib/language-server/grammars.js)`:
     * 1. Node.js loads the file from the APPLICATION directory
     * 2. The `import` statements resolve from the APPLICATION's node_modules
     * 3. Grammar packages ARE installed there (they're app dependencies)
     * 4. Module resolution succeeds ✓
     *
     * ## File Generation
     *
     * The `grammars.js` file is generated by `@sanyam/grammar-scanner`:
     * - Command: `pnpm generate:grammars` (or automatically during `pnpm build`)
     * - Generator: `packages/grammar-scanner/src/generate-app-grammars.ts`
     * - Output: `applications/{browser,electron}/lib/language-server/grammars.js`
     *
     * The generator scans the application's package.json for `@sanyam-grammar/*`
     * dependencies and creates appropriate import statements.
     *
     * @returns Array of grammar contributions, empty array if loading fails
     */
    protected async loadGrammarContributions(): Promise<LanguageContribution[]> {
        try {
            const grammarsPath = this.resolveGrammarsModule();

            if (!grammarsPath) {
                this.log('[SanyamGlspBackendService] Could not resolve grammars module path');
                return [];
            }

            const fs = await import('fs');
            if (!fs.existsSync(grammarsPath)) {
                this.log(`[SanyamGlspBackendService] Grammars module not found at ${grammarsPath}`);
                this.log('[SanyamGlspBackendService] Run `pnpm generate:grammars` to generate the grammars module');
                return [];
            }

            // Use dynamic import() to load the ESM grammars module.
            // The grammars.js file is ESM (grammar packages are "type": "module")
            // and their exports only define "import" conditions, not "require".
            // We use file:// URL with cache-busting query to bypass Node's module cache
            // during development (allows hot-reloading when grammars.js is regenerated).
            const { pathToFileURL } = await this.dynamicImport('node:url') as { pathToFileURL: (path: string) => URL };
            const moduleUrl = pathToFileURL(grammarsPath).href + `?t=${Date.now()}`;
            const grammarsModule = await this.dynamicImport(moduleUrl) as Record<string, unknown>;

            // Support both export names for compatibility:
            // - GrammarContributions: preferred name for GLSP service
            // - ENABLED_GRAMMARS: original name used by language server
            const contributions =
                (grammarsModule.GrammarContributions ??
                grammarsModule.ENABLED_GRAMMARS ??
                []) as LanguageContribution[];

            if (contributions.length === 0) {
                this.log('[SanyamGlspBackendService] No grammar contributions found in grammars module');
                return [];
            }

            this.log(
                `[SanyamGlspBackendService] Loaded ${contributions.length} grammar contribution(s): ` +
                contributions.map(c => c.languageId).join(', ')
            );

            return contributions;
        } catch (error) {
            this.logError('[SanyamGlspBackendService] Failed to load grammar contributions', error);

            if (error instanceof Error) {
                if (error.message.includes('Cannot find module')) {
                    this.logError(
                        '[SanyamGlspBackendService] Module resolution failed. Ensure:\n' +
                        '  1. Run `pnpm generate:grammars` to generate the grammars module\n' +
                        '  2. Run `pnpm build` to compile grammar packages\n' +
                        '  3. At least one @sanyam-grammar/* package is in application dependencies'
                    );
                }
            }

            return [];
        }
    }

    /**
     * Resolve the path to the application's generated grammars module.
     *
     * ## Why Walk Up the Directory Tree?
     *
     * At runtime, this code executes from within the bundled Theia backend:
     * ```
     * applications/browser/lib/backend/main.js
     *   └── includes bundled @sanyam-ide/glsp code
     * ```
     *
     * We need to find the APPLICATION root to locate `lib/language-server/grammars.js`.
     * The application root is identified by having a `package.json` with Theia
     * configuration (`theia.frontend` or `theia.target`).
     *
     * ## Directory Structure
     *
     * ```
     * applications/browser/
     * ├── package.json          ← Has "theia" config (APPLICATION ROOT)
     * ├── lib/
     * │   ├── backend/
     * │   │   └── main.js       ← __dirname when this code runs
     * │   └── language-server/
     * │       └── grammars.js   ← What we're looking for
     * └── node_modules/
     *     └── @sanyam-grammar/  ← Grammar packages installed here
     * ```
     *
     * @returns Absolute path to grammars.js, or undefined if not found
     */
    protected resolveGrammarsModule(): string | undefined {
        const path = require('path');
        const fs = require('fs');

        // Start from this module's location and walk up to find the application root.
        // In the bundled Theia backend, __dirname is typically:
        //   applications/browser/lib/backend/
        // We need to find:
        //   applications/browser/lib/language-server/grammars.js
        let dir = __dirname;
        const maxDepth = 15; // Prevent infinite loops
        let depth = 0;

        while (dir !== path.dirname(dir) && depth < maxDepth) {
            const pkgPath = path.join(dir, 'package.json');

            if (fs.existsSync(pkgPath)) {
                try {
                    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

                    // Theia applications have "theia" configuration in package.json.
                    // This distinguishes the application root from other packages
                    // in the monorepo (extensions, grammars, etc.).
                    if (pkg.theia?.frontend || pkg.theia?.target) {
                        // Found the application root!
                        const grammarsPath = path.join(dir, 'lib', 'language-server', 'grammars.js');
                        this.debug(`[SanyamGlspBackendService] Resolved grammars module: ${grammarsPath}`);
                        return grammarsPath;
                    }
                } catch {
                    // Ignore JSON parse errors and continue searching
                }
            }

            dir = path.dirname(dir);
            depth++;
        }

        this.log('[SanyamGlspBackendService] Could not find Theia application root');
        return undefined;
    }

    /**
     * Create Langium services for a language contribution.
     */
    protected async createLanguageServices(
        contribution: LanguageContribution,
        createDefaultModule: (context: { shared: unknown }) => unknown
    ): Promise<void> {
        if (!this.sharedServices) {
            throw new Error('Shared services not initialized');
        }

        const langium = await this.dynamicImport('langium') as LangiumModule;
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
    }

    /**
     * Get a Langium document by URI.
     *
     * @param uri - Document URI
     * @param forceReload - If true, invalidate the cached document and re-read from disk
     */
    protected async getDocument(uri: string, forceReload?: boolean): Promise<{ document: unknown; contribution: LanguageContribution } | null> {
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

            // If forceReload, invalidate the cached document so we re-read from disk
            if (forceReload && langiumDocuments.hasDocument?.(parsedUri)) {
                langiumDocuments.deleteDocument?.(parsedUri);
            }

            let document = langiumDocuments.getDocument(parsedUri);

            // If document not loaded, create and build it through Langium's full pipeline
            // (parse → index → link → validate) so cross-references are resolved.
            if (!document) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const fileSystemProvider = (this.sharedServices as any).workspace.FileSystemProvider;
                const content = await fileSystemProvider.readFile(parsedUri);
                const textContent = typeof content === 'string' ? content : new TextDecoder().decode(content);

                this.log(`[SanyamGlspBackendService] Building document via DocumentBuilder...`);

                // Create a TextDocument for Langium
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { TextDocument } = await this.dynamicImport('vscode-languageserver-textdocument') as any;
                const textDocument = TextDocument.create(uri, contribution.languageId, 1, textContent);

                // Use LangiumDocuments to create a proper document
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const documentFactory = (this.sharedServices as any).workspace.LangiumDocumentFactory;
                document = documentFactory.fromTextDocument(textDocument, parsedUri);

                // Add to document store so the builder can process it
                langiumDocuments.addDocument(document);

                // Build the document through the full pipeline (parse → index → link → validate)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const documentBuilder = (this.sharedServices as any).workspace.DocumentBuilder;
                await documentBuilder.build([document]);

                this.log(`[SanyamGlspBackendService] Document built, state: ${document.state}`);
                this.log(`[SanyamGlspBackendService] Parse result: value=${!!document.parseResult?.value}, type=${document.parseResult?.value?.$type}`);
                this.log(`[SanyamGlspBackendService] Parse errors: ${document.parseResult?.parserErrors?.length ?? 0}`);
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
     * Log a message at info level.
     */
    protected log(message: string, ..._args: unknown[]): void {
        this.logger.info(message);
    }

    /**
     * Log a debug message.
     */
    protected debug(message: string, ..._args: unknown[]): void {
        this.logger.debug(message);
    }

    /**
     * Log an error message.
     */
    protected logError(message: string, ...args: unknown[]): void {
        const err = args.length > 0 ? args[0] : undefined;
        if (err instanceof Error || (err !== undefined && typeof err === 'object')) {
            this.logger.error({ err }, message);
        } else {
            this.logger.error(message);
        }
    }

    /**
     * Ensure the service is initialized before processing a request.
     * If not ready, the request is queued for later execution.
     */
    protected async ensureInitialized<T>(execute: () => Promise<T>): Promise<T> {
        // Lazily trigger initialization if @postConstruct didn't fire.
        // This can happen when Theia's RPC layer creates the service instance
        // outside of Inversify's normal lifecycle.
        if (this.state === 'uninitialized' && !this.initPromise) {
            this.log('[SanyamGlspBackendService] Lazy initialization triggered (postConstruct did not fire)');
            this.startInitialization();
        }

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
                // Get document (force reload from disk to pick up text editor changes)
                const result = await this.getDocument(uri, true);
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
                this.log(`[SanyamGlspBackendService] GModel child count: ${context.gModel?.children?.length ?? 0}`);

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
                    edits: opResult?.textEdits,
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

                if (this.glspServer.updateProperty) {
                    const updateResult = this.glspServer.updateProperty(context, elementIds, property, value);

                    // Apply text edits to the Langium document so Theia's
                    // document sync propagates changes to the Monaco editor.
                    if (updateResult.edits && updateResult.edits.length > 0) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const langiumDoc = result.document as any;
                        const textDoc = langiumDoc.textDocument;
                        if (textDoc && typeof textDoc.update === 'function') {
                            // TextDocument.update expects VersionedTextDocumentIdentifier changes
                            const changes = updateResult.edits.map((edit: { range: { start: { line: number; character: number }; end: { line: number; character: number } }; newText: string }) => ({
                                range: edit.range,
                                text: edit.newText,
                            }));
                            textDoc.update(changes, textDoc.version + 1);
                        }
                    }

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

    // =========================================================================
    // Workspace Command Execution
    // =========================================================================

    /**
     * Execute a workspace command.
     *
     * Routes `sanyam.operation.{languageId}.{operationId}` commands to
     * the appropriate operation handler registered in the grammar contribution.
     *
     * @param command - Full command name (e.g., 'sanyam.operation.ecml.generate-powershell')
     * @param args - Command arguments array
     * @returns Command execution result
     */
    async executeCommand(command: string, args: unknown[]): Promise<unknown> {
        return this.ensureInitialized(async () => {
            this.log(`[SanyamGlspBackendService] executeCommand: ${command}`);

            // Parse command: sanyam.operation.{languageId}.{operationId}
            const match = command.match(/^sanyam\.operation\.([^.]+)\.(.+)$/);
            if (!match) {
                return { success: false, error: `Unknown command: ${command}` };
            }

            const [, languageId, operationId] = match;
            const contribution = this.contributions.get(languageId);

            if (!contribution) {
                return { success: false, error: `Unknown language: ${languageId}` };
            }

            const handler = contribution.operationHandlers?.[operationId];
            if (!handler) {
                return { success: false, error: `Unknown operation: ${operationId}` };
            }

            // Parse arguments
            const cmdArgs = (args[0] ?? {}) as {
                uri?: string;
                selectedIds?: string[];
                input?: Record<string, unknown>;
            };

            if (!cmdArgs.uri) {
                return { success: false, error: 'Missing uri argument' };
            }

            // Get Langium document
            const langium = await this.dynamicImport('langium') as { URI: { parse: (uri: string) => unknown } };
            const docUri = langium.URI.parse(cmdArgs.uri);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const document = (this.sharedServices as any)?.workspace?.LangiumDocuments?.getDocument(docUri);

            if (!document) {
                return { success: false, error: `Document not found: ${cmdArgs.uri}` };
            }

            // Build operation context
            const context: import('@sanyam/types').OperationContext = {
                document,
                selectedIds: cmdArgs.selectedIds,
                input: cmdArgs.input,
                correlationId: `cmd-${Date.now()}`,
                languageId,
                documentUri: cmdArgs.uri,
            };

            // Execute handler
            try {
                const result = await handler(context);
                return { success: true, result };
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.logError(`[SanyamGlspBackendService] executeCommand error:`, error);
                return { success: false, error: message };
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
