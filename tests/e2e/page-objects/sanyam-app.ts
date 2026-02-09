import { type Page, type Locator } from '@playwright/test';

/**
 * Top-level page object for a running Sanyam IDE browser instance.
 *
 * Wraps a Playwright {@link Page} and provides helpers for common
 * application-level operations (shell readiness, file opening, command
 * palette, sidebar toggling).
 */
export class SanyamApp {
    readonly page: Page;

    /** Locator for the Theia application shell. */
    readonly shell: Locator;

    constructor(page: Page) {
        this.page = page;
        this.shell = page.locator('#theia-app-shell');
    }

    /* ------------------------------------------------------------------ */
    /*  Lifecycle                                                          */
    /* ------------------------------------------------------------------ */

    /** Wait until the Theia shell is rendered and interactive. */
    async waitForShellReady(timeout = 30_000): Promise<void> {
        await this.shell.waitFor({ state: 'visible', timeout });
        // Wait for Theia's loading indicator to disappear
        await this.page.locator('#theia-preload').waitFor({ state: 'hidden', timeout }).catch(() => {
            // Preload indicator may already be gone
        });
    }

    /**
     * Wait until the workspace is loaded and the file explorer shows content.
     *
     * The test fixture navigates with `/#<workspace-path>` so Theia opens a
     * workspace folder.  This method:
     * 1. Expands the left sidebar (it starts collapsed)
     * 2. Activates the Explorer view
     * 3. Waits for the file tree to show at least one node
     */
    async waitForWorkspaceReady(timeout = 30_000): Promise<void> {
        // The sidebar starts collapsed (48px activity bar only).
        // `#theia-left-side-panel` is the content panel next to the activity bar.
        // It has class `lm-mod-hidden` when collapsed.
        // Clicking the Explorer activity bar tab toggles the panel open.
        const explorerTab = this.page.locator('#shell-tab-explorer-view-container');
        await explorerTab.waitFor({ state: 'visible', timeout: 10_000 });
        await explorerTab.click();

        // Wait for the sidebar content panel to expand (lose lm-mod-hidden class)
        const sidePanel = this.page.locator('#theia-left-side-panel');
        await this.page.waitForFunction(
            (selector) => {
                const panel = document.querySelector(selector);
                return panel !== null && !panel.classList.contains('lm-mod-hidden');
            },
            '#theia-left-side-panel',
            { timeout, polling: 250 },
        );

        // Now wait for #files to become visible inside the expanded sidebar
        const filesView = this.page.locator('#files');
        await filesView.waitFor({ state: 'visible', timeout });

        // Wait for at least one tree node to appear (workspace files loaded)
        const treeNode = filesView.locator('.theia-TreeNode').first();
        await treeNode.waitFor({ state: 'visible', timeout });
    }

    /**
     * Wait until the language server extension is fully activated.
     *
     * Each fresh page creates a new Theia frontend connection which triggers
     * plugin host restart and extension reactivation.  The status bar shows
     * "Activating Sanyam Language Server" during startup — we wait until
     * that text disappears, indicating the server is ready.
     *
     * Uses short timeouts to avoid wasting test budget — if the server is
     * already active (common when reusing a running app), this completes
     * nearly instantly.
     */
    async waitForBackendReady(timeout = 15_000): Promise<void> {
        // Poll until "Activating" is NOT in the status bar text.
        // If the server is already active, this returns immediately.
        // If the status bar never shows "Activating" (fast startup), also passes.
        await this.page.waitForFunction(
            () => {
                const statusBar = document.querySelector('#theia-statusBar');
                const text = statusBar?.textContent ?? '';
                return !text.includes('Activating');
            },
            { timeout, polling: 500 },
        ).catch(() => {
            // Proceed even if the indicator doesn't clear — some test scenarios
            // may not trigger the language server at all.
        });
    }

    /* ------------------------------------------------------------------ */
    /*  Command palette                                                    */
    /* ------------------------------------------------------------------ */

    /** Open the quick-command palette and type a query. */
    async openCommandPalette(query?: string): Promise<Locator> {
        await this.page.keyboard.press('Control+Shift+P');
        const palette = this.page.locator('.quick-input-widget');
        await palette.waitFor({ state: 'visible', timeout: 5_000 });

        if (query) {
            // Ctrl+Shift+P opens Theia's quick-input in command mode.
            // Use fill() with ">" prefix to ensure command mode is active
            // (fill replaces any existing content including the initial ">").
            const input = palette.locator('.quick-input-box input');
            await input.fill(`>${query}`);
        }
        return palette;
    }

    /** Execute a command via the command palette. */
    async executeCommand(command: string): Promise<void> {
        await this.openCommandPalette(command);
        // Wait for the command list to settle
        await this.page.waitForTimeout(300);
        await this.page.keyboard.press('Enter');
    }

    /**
     * Execute a Theia command by its ID using the Inversify container.
     *
     * Bypasses the command palette entirely — iterates all container
     * bindings with `executeCommand`, trying each until one succeeds.
     * The RPC proxy throws; the real CommandRegistry works.
     */
    async executeCommandById(commandId: string): Promise<void> {
        await this.page.evaluate(async (id: string) => {
            const theia = (window as unknown as Record<string, unknown>).theia as Record<string, unknown> | undefined;
            if (!theia) throw new Error('window.theia not available');

            const container = theia.container as {
                _bindingDictionary?: {
                    _map?: Map<unknown, Array<{ cache?: Record<string, unknown> }>>;
                };
            };
            const bindingMap = container?._bindingDictionary?._map;
            if (!bindingMap) throw new Error('Inversify binding map not found');

            // Try ALL services with executeCommand until one succeeds.
            // RPC proxies throw "this.target[method] is not a function";
            // the real CommandRegistry succeeds.
            const errors: string[] = [];
            for (const [, bindings] of bindingMap) {
                for (const binding of bindings) {
                    const cache = binding.cache;
                    if (cache && typeof cache.executeCommand === 'function') {
                        try {
                            await (cache.executeCommand as (cmdId: string) => Promise<unknown>)(id);
                            return; // Success
                        } catch (e: unknown) {
                            errors.push(String(e).substring(0, 80));
                        }
                    }
                }
            }
            throw new Error(
                `No service could execute command "${id}". Tried ${errors.length} services: ${errors.join('; ')}`,
            );
        }, commandId);
    }

    /* ------------------------------------------------------------------ */
    /*  File operations                                                    */
    /* ------------------------------------------------------------------ */

    /**
     * Open a file from the explorer by double-clicking its tree node.
     * Assumes the sidebar is already expanded (done by `waitForWorkspaceReady`).
     *
     * @param relativePath - Path relative to the workspace root (e.g. `'test.ecml'`)
     */
    async openFile(relativePath: string): Promise<void> {
        // Ensure the sidebar is open by checking if #files is visible;
        // if not, click the Explorer tab to expand it.
        const filesView = this.page.locator('#files');
        const filesVisible = await filesView.isVisible().catch(() => false);
        if (!filesVisible) {
            const explorerTab = this.page.locator('#shell-tab-explorer-view-container');
            await explorerTab.click();
            await filesView.waitFor({ state: 'visible', timeout: 10_000 });
        }

        // Find the file tree node by its label text
        const fileName = relativePath.split('/').pop() ?? relativePath;
        const fileNode = filesView.locator('.theia-TreeNode', { hasText: fileName }).first();
        await fileNode.waitFor({ state: 'visible', timeout: 10_000 });
        await fileNode.dblclick();

        // Wait for an editor tab to open
        await this.page.locator('.theia-editor-container, .sanyam-composite-editor').first()
            .waitFor({ state: 'visible', timeout: 15_000 });
    }

    /* ------------------------------------------------------------------ */
    /*  Sidebar                                                            */
    /* ------------------------------------------------------------------ */

    /**
     * Toggle the element palette (Tools) sidebar view.
     *
     * Uses the Inversify container to execute the toggle command directly,
     * bypassing the command palette (whose fuzzy matching is unreliable).
     */
    async toggleElementPalette(): Promise<Locator> {
        await this.executeCommandById('elementPalette:toggle');

        const palette = this.page.locator('.sanyam-element-palette').first();
        await palette.waitFor({ state: 'visible', timeout: 10_000 });
        return palette;
    }
}
